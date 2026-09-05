import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * La comprobacion de enlaces contra la red.
 *
 * El DNS y fetch van dobles, y es lo unico razonable: con la red de verdad la
 * prueba diria si un dominio ajeno esta arriba hoy, no si nuestro codigo
 * decide bien. Lo que se afirma es la decision ante cada respuesta posible:
 * que un dominio que resuelve a una direccion privada no se consulte, que un
 * 404 rechace y un 403 no, que un fallo de TLS se distinga de un timeout, y
 * que cuando el fallo puede ser nuestro se deje pasar sin reescribir el enlace.
 *
 * La parte pura —isPublicHttpUrl, isPrivateAddress— vive en text.ts con sus
 * propias pruebas.
 */

vi.mock("node:dns", () => ({ promises: { lookup: vi.fn() } }));

import { promises as dns } from "node:dns";

import { checkProjectLinks, checkRepo, checkSite } from "@/lib/link-check";

/** Respuesta de fetch con lo justo que mira `request`. */
function respuesta({ status = 200, url }: { status?: number; url?: string } = {}) {
  return { ok: status >= 200 && status < 300, status, url: url ?? "" };
}

/** Un fallo de red: fetch lanza, con el codigo en `cause` como en Node. */
function falla(code?: string) {
  const error = new TypeError("fetch failed");
  return Object.assign(error, code ? { cause: { code } } : {});
}

function conFetch(...respuestas: (ReturnType<typeof respuesta> | Error)[]) {
  /*
   * El tipo se declara en vi.fn y no como argumentos de la implementacion: la
   * implementacion no los necesita, pero el tipo es lo que deja afirmar sobre
   * `mock.calls`, que es la mitad de lo que interesa aca —a que URL se le
   * pregunto, y en que orden—.
   */
  type Fetch = (url: string, opciones?: unknown) => Promise<ReturnType<typeof respuesta>>;

  const espia = vi.fn<Fetch>(async () => {
    const siguiente = respuestas.shift();
    if (siguiente instanceof Error) throw siguiente;
    return siguiente ?? respuesta();
  });
  vi.stubGlobal("fetch", espia);
  return espia;
}

/** Direcciones que devolveria el DNS. */
function resuelveA(...direcciones: string[]) {
  vi.mocked(dns.lookup).mockResolvedValue(
    direcciones.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })) as never,
  );
}

function dnsFalla(code: string) {
  vi.mocked(dns.lookup).mockRejectedValue(Object.assign(new Error("dns"), { code }));
}

beforeEach(() => {
  resuelveA("190.10.1.1");
  conFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("checkSite: lo que se descarta sin tocar la red", () => {
  it("lo que no es una URL", async () => {
    const espia = conFetch();

    expect(await checkSite("no es una url")).toEqual({ ok: false, reason: "invalida" });
    expect(espia).not.toHaveBeenCalled();
    expect(dns.lookup).not.toHaveBeenCalled();
  });

  it("un esquema que no es web", async () => {
    expect(await checkSite("ftp://archivos.cr/x")).toEqual({ ok: false, reason: "invalida" });
    expect(dns.lookup).not.toHaveBeenCalled();
  });

  it("un nombre de la red local", async () => {
    expect(await checkSite("http://localhost:3000")).toEqual({ ok: false, reason: "privada" });
    expect(await checkSite("http://impresora.local/")).toEqual({ ok: false, reason: "privada" });
    expect(dns.lookup).not.toHaveBeenCalled();
  });

  it("una direccion privada escrita como IP", async () => {
    const espia = conFetch();

    expect(await checkSite("http://169.254.169.254/latest/meta-data")).toEqual({
      ok: false,
      reason: "privada",
    });
    expect(espia).not.toHaveBeenCalled();
  });
});

describe("checkSite: lo que dice el DNS", () => {
  it("un dominio que no existe se rechaza", async () => {
    const espia = conFetch();
    dnsFalla("ENOTFOUND");

    expect(await checkSite("https://asdasd-inventado.cr")).toEqual({
      ok: false,
      reason: "no-existe",
    });
    expect(espia).not.toHaveBeenCalled();
  });

  /*
   * La razon de resolver el DNS: un dominio con toda la pinta de normal puede
   * apuntar a la red interna, y mirando solo el texto del host no se ve.
   */
  it("un dominio publico que resuelve a una direccion privada se rechaza", async () => {
    const espia = conFetch();
    resuelveA("127.0.0.1");

    expect(await checkSite("http://localtest.me/panel")).toEqual({
      ok: false,
      reason: "privada",
    });
    expect(espia).not.toHaveBeenCalled();
  });

  it("basta una direccion privada entre varias", async () => {
    resuelveA("190.10.1.1", "10.0.0.5");

    expect(await checkSite("https://mixto.cr")).toEqual({ ok: false, reason: "privada" });
  });

  it("un DNS sin respuesta no bloquea: el fallo puede ser nuestro", async () => {
    dnsFalla("ETIMEOUT");
    conFetch(respuesta({ url: "https://placas.cr/" }));

    expect(await checkSite("https://placas.cr")).toEqual({ ok: true, url: "https://placas.cr/" });
  });
});

describe("checkSite: lo que contesta el sitio", () => {
  it("si responde por https, pasa", async () => {
    const espia = conFetch(respuesta({ url: "https://placas.cr/" }));

    expect(await checkSite("https://placas.cr")).toEqual({ ok: true, url: "https://placas.cr/" });
    expect(espia).toHaveBeenCalledOnce();
    expect(espia.mock.calls[0][0]).toBe("https://placas.cr/");
  });

  it("un enlace escrito con http se asciende si https contesta", async () => {
    const espia = conFetch(respuesta({ url: "https://placas.cr/" }));

    expect(await checkSite("http://placas.cr/")).toEqual({ ok: true, url: "https://placas.cr/" });
    // Se probo https, no lo que se escribio.
    expect(espia.mock.calls[0][0]).toBe("https://placas.cr/");
  });

  it("si https no carga pero http si, se rechaza por inseguro", async () => {
    const espia = conFetch(falla(), respuesta({ url: "http://viejo.cr/" }));

    expect(await checkSite("http://viejo.cr/")).toEqual({ ok: false, reason: "sin-https" });
    expect(espia).toHaveBeenCalledTimes(2);
    expect(espia.mock.calls[1][0]).toBe("http://viejo.cr/");
  });

  it("un certificado vencido es sin-https, no un timeout", async () => {
    const espia = conFetch(falla("CERT_HAS_EXPIRED"));

    expect(await checkSite("https://vencido.cr")).toEqual({ ok: false, reason: "sin-https" });
    // No se reintenta por http: el sitio contesto, su TLS es el problema.
    expect(espia).toHaveBeenCalledOnce();
  });

  it("un 404 es el sitio diciendo que esa pagina no existe", async () => {
    conFetch(respuesta({ status: 404, url: "https://placas.cr/nada" }));

    expect(await checkSite("https://placas.cr/nada")).toEqual({
      ok: false,
      reason: "no-existe",
    });
  });

  it("un 403 no: casi siempre es el sitio bloqueando bots", async () => {
    conFetch(respuesta({ status: 403, url: "https://placas.cr/" }));

    expect(await checkSite("https://placas.cr/")).toEqual({ ok: true, url: "https://placas.cr/" });
  });

  it("un redirect que termina en la red interna se rechaza", async () => {
    // El origen era publico, el destino no: por eso se revisa el final.
    conFetch(respuesta({ url: "http://127.0.0.1:8080/panel" }));

    expect(await checkSite("https://acortador.cr/x")).toEqual({
      ok: false,
      reason: "no-existe",
    });
  });

  it("guarda la URL pedida, no el destino del redirect", async () => {
    conFetch(respuesta({ url: "https://www.google.com/" }));

    // Seguir el redirect sirve para comprobar; guardarlo cambiaria el enlace
    // por detras de quien lo escribio.
    expect(await checkSite("https://google.com")).toEqual({ ok: true, url: "https://google.com/" });
  });

  it("si nada contesta se deja pasar, con el enlace tal como se escribio", async () => {
    conFetch(falla(), falla());

    /*
     * El dominio existe y no contesta ni por https ni por http: el fallo bien
     * puede ser nuestro y no se castiga a la persona. Lo que no se hace es
     * ascender el esquema, que guardaria una direccion que no carga.
     */
    expect(await checkSite("http://neverssl.com")).toEqual({
      ok: true,
      url: "http://neverssl.com",
    });
  });
});

describe("checkRepo", () => {
  it("rechaza lo que no es una forja conocida, sin consultar", async () => {
    const espia = conFetch();

    expect(await checkRepo("https://miservidor.cr/git/repo")).toEqual({
      ok: false,
      reason: "no-es-forja",
    });
    expect(espia).not.toHaveBeenCalled();
  });

  it("consulta la URL canonica, no la que venia pegada", async () => {
    const espia = conFetch(respuesta({ url: "https://github.com/usuario/repo" }));

    const resultado = await checkRepo("https://github.com/usuario/repo/tree/main/src");

    expect(espia.mock.calls[0][0]).toBe("https://github.com/usuario/repo");
    expect(resultado).toMatchObject({
      ok: true,
      ref: { host: "github.com", owner: "usuario", repo: "repo" },
    });
  });

  it("un repositorio que da 404 no existe o es privado", async () => {
    conFetch(respuesta({ status: 404, url: "https://github.com/usuario/no-existe" }));

    expect(await checkRepo("https://github.com/usuario/no-existe")).toEqual({
      ok: false,
      reason: "no-existe",
    });
  });

  it("si la forja no contesta, no se culpa al repositorio", async () => {
    conFetch(falla());

    expect(await checkRepo("https://github.com/usuario/repo")).toMatchObject({ ok: true });
  });
});

describe("checkProjectLinks", () => {
  it("devuelve un resultado por enlace, en el mismo orden", async () => {
    conFetch(
      respuesta({ url: "https://docs.placas.cr/" }),
      respuesta({ status: 404, url: "https://placas.cr/roto" }),
    );

    const resultado = await checkProjectLinks([
      { label: "Docs", url: "https://docs.placas.cr/" },
      { label: "Roto", url: "https://placas.cr/roto" },
    ]);

    expect(resultado).toEqual([
      {
        link: { label: "Docs", url: "https://docs.placas.cr/" },
        check: { ok: true, url: "https://docs.placas.cr/" },
      },
      {
        link: { label: "Roto", url: "https://placas.cr/roto" },
        check: { ok: false, reason: "no-existe" },
      },
    ]);
  });

  it("sin enlaces no consulta nada", async () => {
    const espia = conFetch();

    expect(await checkProjectLinks([])).toEqual([]);
    expect(espia).not.toHaveBeenCalled();
  });
});
