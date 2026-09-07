import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * La busqueda de la vista previa de un proyecto.
 *
 * fetch va doble: lo que se prueba es la cascada —la captura del sitio, si no
 * la og:image que declara, si no nada— y que cada respuesta posible caiga en el
 * escalon correcto. Con servicios de verdad la prueba dependeria de que
 * WordPress conteste hoy igual que ayer, y de gastarle el limite.
 *
 * Las dos peticiones no son la misma: a la captura se le pregunta con HEAD si
 * ya existe, y al sitio se le pide el HTML. El doble las distingue por la URL.
 */

import { findPreviewImage, screenshotUrl } from "@/lib/preview";

const SITIO = "https://placas.cr/";
const MSHOTS = "https://s.wordpress.com/mshots/";

/** Lo que contesta el servicio de capturas: solo se le miran status y tipo. */
function captura(status: number, type = "image/jpeg") {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (nombre: string) => (nombre === "content-type" ? type : null) },
    text: async () => "",
    url: "",
  };
}

/** Lo que contesta el sitio: de aca sale la og:image. */
function pagina({
  html = "",
  ok = true,
  type = "text/html; charset=utf-8",
  url = SITIO,
}: { html?: string; ok?: boolean; type?: string; url?: string } = {}) {
  return {
    status: ok ? 200 : 500,
    ok,
    headers: { get: (nombre: string) => (nombre === "content-type" ? type : null) },
    text: async () => html,
    url,
  };
}

type Fetch = (url: string, opciones?: { method?: string; redirect?: string; headers?: Record<string, string> }) => Promise<unknown>;
type Doble = {
  /** En orden; la ultima se repite si preguntan de mas. */
  capturas?: ReturnType<typeof captura>[];
  sitio?: ReturnType<typeof pagina> | Error;
};

function conFetch({ capturas = [captura(403)], sitio = pagina() }: Doble = {}) {
  const cola = [...capturas];

  const espia = vi.fn<Fetch>(async (url) => {
    if (url.startsWith(MSHOTS)) return cola.length > 1 ? cola.shift()! : cola[0];
    if (sitio instanceof Error) throw sitio;
    return sitio;
  });

  vi.stubGlobal("fetch", espia);
  return espia;
}

/** Una pagina con las etiquetas que se le pasen. */
function conMetas(...metas: string[]) {
  return `<html><head><title>x</title>${metas.join("")}</head><body></body></html>`;
}

/** Deja correr las esperas entre reintentos sin que la prueba tarde de verdad. */
async function sinEsperar<T>(trabajo: Promise<T>) {
  vi.useFakeTimers();
  try {
    const resultado = trabajo;
    await vi.advanceTimersByTimeAsync(30_000);
    return await resultado;
  } finally {
    vi.useRealTimers();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("findPreviewImage: la captura del sitio", () => {
  it("si la captura ya existe, esa es la vista previa", async () => {
    const espia = conFetch({ capturas: [captura(200)] });

    expect(await findPreviewImage(SITIO)).toBe(screenshotUrl(SITIO));
    // Y ni se molesta en visitar el sitio: ya tiene lo que buscaba.
    expect(espia).toHaveBeenCalledOnce();
  });

  it("pregunta con HEAD y sin seguir el redirect", async () => {
    const espia = conFetch({ capturas: [captura(200)] });

    await findPreviewImage(SITIO);

    const opciones = espia.mock.calls[0][1];
    expect(opciones?.method).toBe("HEAD");
    /*
     * Si se siguiera el redirect, el GIF de "generando" llegaria como un 200
     * con una imagen y seria indistinguible de la captura de verdad.
     */
    expect(opciones?.redirect).toBe("manual");
  });

  it("un 200 que no es imagen no cuenta como captura", async () => {
    conFetch({
      capturas: [captura(200, "text/html")],
      sitio: pagina({ html: conMetas('<meta property="og:image" content="https://placas.cr/og.png">') }),
    });

    expect(await sinEsperar(findPreviewImage(SITIO))).toBe("https://placas.cr/og.png");
  });

  it("mientras se genera insiste, y la usa apenas aparece", async () => {
    const espia = conFetch({ capturas: [captura(307), captura(307), captura(200)] });

    expect(await sinEsperar(findPreviewImage(SITIO))).toBe(screenshotUrl(SITIO));
    expect(espia).toHaveBeenCalledTimes(3);
  });

  it("si sigue generando se guarda igual: la URL va a servir la imagen despues", async () => {
    /*
     * Que tarde no es que haya fallado. Guardar la og:image aca dejaria la
     * tarjeta con el logo del sitio para siempre, cuando en un rato hay una
     * captura esperando en esa misma URL.
     */
    conFetch({
      capturas: [captura(307)],
      sitio: pagina({ html: conMetas('<meta property="og:image" content="https://placas.cr/og.png">') }),
    });

    expect(await sinEsperar(findPreviewImage(SITIO))).toBe(screenshotUrl(SITIO));
  });

  it("si el servicio corta, no se le insiste", async () => {
    // Un 403 es que nos corto por volumen: esperar no lo cambia.
    const espia = conFetch({ capturas: [captura(403)], sitio: pagina({ html: conMetas() }) });

    await sinEsperar(findPreviewImage(SITIO));

    const alServicio = espia.mock.calls.filter(([url]) => String(url).startsWith(MSHOTS));
    expect(alServicio).toHaveLength(1);
  });
});

describe("findPreviewImage: la og:image, cuando no hay captura", () => {
  /** Con el servicio de capturas caido, que es cuando se mira el sitio. */
  const sinCaptura = (sitio: ReturnType<typeof pagina> | Error) =>
    conFetch({ capturas: [captura(500)], sitio });

  it("usa la que el sitio declara", async () => {
    sinCaptura(pagina({ html: conMetas('<meta property="og:image" content="https://placas.cr/portada.png">') }));

    expect(await findPreviewImage(SITIO)).toBe("https://placas.cr/portada.png");
  });

  it("resuelve una ruta relativa contra la pagina que contesto", async () => {
    sinCaptura(
      pagina({
        // Ojo: la URL final, despues de seguir los redirects.
        url: "https://www.placas.cr/es/",
        html: conMetas('<meta property="og:image" content="/img/portada.png">'),
      }),
    );

    expect(await findPreviewImage(SITIO)).toBe("https://www.placas.cr/img/portada.png");
  });

  it("prefiere la version segura cuando el sitio declara varias", async () => {
    sinCaptura(
      pagina({
        html: conMetas(
          '<meta property="twitter:image" content="https://placas.cr/t.png">',
          '<meta property="og:image" content="https://placas.cr/og.png">',
          '<meta property="og:image:secure_url" content="https://placas.cr/segura.png">',
        ),
      }),
    );

    expect(await findPreviewImage(SITIO)).toBe("https://placas.cr/segura.png");
  });

  it("cae a twitter:image si no hay og:image", async () => {
    sinCaptura(pagina({ html: conMetas('<meta name="twitter:image" content="https://placas.cr/t.png">') }));

    expect(await findPreviewImage(SITIO)).toBe("https://placas.cr/t.png");
  });

  it("acepta la etiqueta con comillas simples y con name en vez de property", async () => {
    sinCaptura(pagina({ html: conMetas("<meta name='og:image' content='https://placas.cr/a.png'>") }));

    expect(await findPreviewImage(SITIO)).toBe("https://placas.cr/a.png");
  });

  it("manda un user agent normal, que sin el varios sitios contestan 403", async () => {
    const espia = conFetch({ capturas: [captura(500)], sitio: pagina() });

    await findPreviewImage(SITIO);

    const alSitio = espia.mock.calls.find(([url]) => !String(url).startsWith(MSHOTS));
    expect(alSitio?.[1]?.headers?.["user-agent"]).toContain("HechoEnCR");
  });
});

describe("findPreviewImage: cuando no hay nada que mostrar", () => {
  it("sin captura y sin og:image no se inventa una imagen", async () => {
    conFetch({ capturas: [captura(500)], sitio: pagina({ html: conMetas() }) });

    expect(await findPreviewImage(SITIO)).toBeNull();
  });

  it("tampoco si el sitio contesta con error", async () => {
    conFetch({ capturas: [captura(500)], sitio: pagina({ ok: false }) });

    expect(await findPreviewImage(SITIO)).toBeNull();
  });

  it("tampoco si lo que devuelve no es html", async () => {
    /*
     * El cuerpo trae una etiqueta adentro a proposito. Con un `{}` pelado la
     * prueba no probaria nada: sin metadatos igual daria null, con guarda o sin
     * ella. Asi se distingue haber mirado el content-type de haberse puesto a
     * buscar etiquetas en cualquier cosa.
     */
    conFetch({
      capturas: [captura(500)],
      sitio: pagina({
        type: "application/json",
        html: `{"nota":"<meta property='og:image' content='https://placas.cr/de-json.png'>"}`,
      }),
    });

    expect(await findPreviewImage(SITIO)).toBeNull();
  });

  it("tampoco si el sitio no contesta", async () => {
    conFetch({ capturas: [captura(500)], sitio: new TypeError("fetch failed") });

    expect(await findPreviewImage(SITIO)).toBeNull();
  });

  it("tampoco si la imagen declarada apunta a la red interna", async () => {
    conFetch({
      capturas: [captura(500)],
      sitio: pagina({ html: conMetas('<meta property="og:image" content="http://127.0.0.1:9000/interna.png">') }),
    });

    expect(await findPreviewImage(SITIO)).toBeNull();
  });
});

describe("findPreviewImage: lo que no se consulta", () => {
  it("un enlace que apunta a la red interna no se visita", async () => {
    const espia = conFetch();

    expect(await findPreviewImage("http://localhost:3000")).toBeNull();
    expect(await findPreviewImage("http://10.0.0.5/")).toBeNull();
    expect(espia).not.toHaveBeenCalled();
  });

  it("un esquema que no es web tampoco", async () => {
    const espia = conFetch();

    expect(await findPreviewImage("ftp://archivos.cr/x")).toBeNull();
    expect(espia).not.toHaveBeenCalled();
  });
});

describe("screenshotUrl", () => {
  it("codifica el sitio dentro de la URL del servicio", () => {
    const url = screenshotUrl("https://placas.cr/buscar?placa=ABC 123");

    expect(url).toContain(encodeURIComponent("https://placas.cr/buscar?placa=ABC 123"));
    // Sin codificar, el ? del sitio cortaria la query del servicio.
    expect(url.split("?")).toHaveLength(2);
  });
});
