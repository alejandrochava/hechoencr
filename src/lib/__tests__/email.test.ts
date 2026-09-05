import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * La comprobacion de que un dominio reciba correo.
 *
 * El DNS va doble: con el de verdad la prueba diria si gmail.com tiene MX hoy,
 * que no es lo que se quiere saber. Lo que se afirma es la decision ante cada
 * respuesta: que un dominio sin MX se rechace, que un fallo de red nuestro deje
 * pasar, y que no se pregunte dos veces por el mismo dominio.
 */

// En un holder para que sobreviva a resetModules: sin esto, cada recarga del
// modulo crearia un vi.fn nuevo y la referencia de arriba quedaria vieja.
const dobles = vi.hoisted(() => ({ resolveMx: vi.fn() }));

vi.mock("node:dns", () => ({ promises: { resolveMx: dobles.resolveMx } }));

/**
 * La cache de email.ts vive en el modulo, asi que cada prueba lo carga de nuevo
 * para arrancar con ella vacia.
 */
async function cargar() {
  vi.resetModules();
  const { domainAcceptsMail } = await import("@/lib/email");
  return domainAcceptsMail;
}

function conMx(...hosts: string[]) {
  dobles.resolveMx.mockResolvedValue(hosts.map((exchange, i) => ({ exchange, priority: i * 10 })));
}

function sinMx(code: string) {
  dobles.resolveMx.mockRejectedValue(Object.assign(new Error("dns"), { code }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("domainAcceptsMail", () => {
  it("un dominio con MX pasa, y se pregunta por el dominio, no por el correo", async () => {
    const domainAcceptsMail = await cargar();
    conMx("mx.ejemplo.cr");

    expect(await domainAcceptsMail("alejandra@ejemplo.cr")).toBe(true);
    expect(dobles.resolveMx).toHaveBeenCalledWith("ejemplo.cr");
  });

  it("rechaza cuando el dominio contesta que no tiene correo", async () => {
    for (const code of ["ENOTFOUND", "ENODATA", "NXDOMAIN"]) {
      const domainAcceptsMail = await cargar();
      sinMx(code);

      expect(await domainAcceptsMail("alguien@gmial.com"), code).toBe(false);
    }
  });

  it("rechaza un dominio que declara cero MX", async () => {
    const domainAcceptsMail = await cargar();
    conMx();

    expect(await domainAcceptsMail("alguien@ejemplo.cr")).toBe(false);
  });

  /*
   * La otra mitad de la politica: un fallo que es nuestro no se le cobra a la
   * persona. Igual va a tropezar con el enlace de acceso si el correo no
   * existe, asi que dejar pasar no abre nada.
   */
  it("deja pasar si el fallo es de red y no del dominio", async () => {
    const domainAcceptsMail = await cargar();
    sinMx("ESERVFAIL");

    expect(await domainAcceptsMail("alejandra@ejemplo.cr")).toBe(true);
  });

  it("deja pasar si el DNS no contesta a tiempo", async () => {
    const domainAcceptsMail = await cargar();
    // Una consulta que nunca termina; lo que corta es el reloj.
    dobles.resolveMx.mockReturnValue(new Promise(() => {}));
    vi.useFakeTimers();

    const pendiente = domainAcceptsMail("alejandra@ejemplo.cr");
    await vi.advanceTimersByTimeAsync(3000);

    expect(await pendiente).toBe(true);
  });

  it("un correo sin dominio se rechaza sin consultar el DNS", async () => {
    const domainAcceptsMail = await cargar();

    expect(await domainAcceptsMail("arroba-perdida")).toBe(false);
    expect(dobles.resolveMx).not.toHaveBeenCalled();
  });

  it("no pregunta dos veces por el mismo dominio", async () => {
    const domainAcceptsMail = await cargar();
    conMx("mx.ejemplo.cr");

    await domainAcceptsMail("alejandra@ejemplo.cr");
    await domainAcceptsMail("alejandra@ejemplo.cr");

    expect(dobles.resolveMx).toHaveBeenCalledOnce();
  });

  it("la cache es por dominio, no por correo", async () => {
    const domainAcceptsMail = await cargar();
    conMx("mx.ejemplo.cr");

    await domainAcceptsMail("alejandra@ejemplo.cr");
    await domainAcceptsMail("otro@ejemplo.cr");

    // Dos correos, un solo dominio: una sola consulta.
    expect(dobles.resolveMx).toHaveBeenCalledOnce();
  });

  it("dominios distintos se preguntan por separado", async () => {
    const domainAcceptsMail = await cargar();
    conMx("mx.ejemplo.cr");

    await domainAcceptsMail("alejandra@ejemplo.cr");
    await domainAcceptsMail("alejandra@otro.cr");

    expect(dobles.resolveMx).toHaveBeenCalledTimes(2);
  });

  it("tambien recuerda el no, para no repetir la consulta que ya fallo", async () => {
    const domainAcceptsMail = await cargar();
    sinMx("ENOTFOUND");

    expect(await domainAcceptsMail("alguien@gmial.com")).toBe(false);
    expect(await domainAcceptsMail("otro@gmial.com")).toBe(false);
    expect(dobles.resolveMx).toHaveBeenCalledOnce();
  });

  it("el correo se normaliza antes de sacarle el dominio", async () => {
    const domainAcceptsMail = await cargar();
    conMx("mx.ejemplo.cr");

    await domainAcceptsMail("  Alejandra@Ejemplo.CR  ");

    expect(dobles.resolveMx).toHaveBeenCalledWith("ejemplo.cr");
  });
});
