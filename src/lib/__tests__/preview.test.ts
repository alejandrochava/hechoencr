import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * La busqueda de la vista previa de un proyecto.
 *
 * fetch va doble: lo que se prueba es la cascada —la og:image que el sitio
 * declara, si no un screenshot automatico, si no nada— y que cada respuesta
 * posible caiga en el escalon correcto. Con un sitio de verdad la prueba
 * dependeria de que ese sitio no cambie sus metadatos.
 */

import { findPreviewImage, screenshotUrl } from "@/lib/preview";

type Cuerpo = { html?: string; ok?: boolean; type?: string; url?: string };

/** Respuesta de fetch con lo justo que mira findPreviewImage. */
function pagina({ html = "", ok = true, type = "text/html; charset=utf-8", url }: Cuerpo = {}) {
  return {
    ok,
    headers: { get: (nombre: string) => (nombre === "content-type" ? type : null) },
    text: async () => html,
    url: url ?? "",
  };
}

function conFetch(respuesta: ReturnType<typeof pagina> | Error) {
  type Fetch = (url: string, opciones?: { headers?: Record<string, string> }) => Promise<unknown>;

  const espia = vi.fn<Fetch>(async () => {
    if (respuesta instanceof Error) throw respuesta;
    return respuesta;
  });

  vi.stubGlobal("fetch", espia);
  return espia;
}

/** Una pagina con las etiquetas que se le pasen. */
function conMetas(...metas: string[]) {
  return `<html><head><title>x</title>${metas.join("")}</head><body></body></html>`;
}

const SITIO = "https://placas.cr/";

beforeEach(() => {
  conFetch(pagina());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("findPreviewImage: la og:image del sitio", () => {
  it("usa la que el sitio declara", async () => {
    conFetch(
      pagina({
        url: SITIO,
        html: conMetas('<meta property="og:image" content="https://placas.cr/portada.png">'),
      }),
    );

    expect(await findPreviewImage(SITIO)).toBe("https://placas.cr/portada.png");
  });

  it("resuelve una ruta relativa contra la pagina que contesto", async () => {
    conFetch(
      pagina({
        // Ojo: la URL final, despues de seguir los redirects.
        url: "https://www.placas.cr/es/",
        html: conMetas('<meta property="og:image" content="/img/portada.png">'),
      }),
    );

    expect(await findPreviewImage(SITIO)).toBe("https://www.placas.cr/img/portada.png");
  });

  it("prefiere la version segura cuando el sitio declara varias", async () => {
    conFetch(
      pagina({
        url: SITIO,
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
    conFetch(
      pagina({
        url: SITIO,
        html: conMetas('<meta name="twitter:image" content="https://placas.cr/t.png">'),
      }),
    );

    expect(await findPreviewImage(SITIO)).toBe("https://placas.cr/t.png");
  });

  it("acepta la etiqueta con comillas simples y con name en vez de property", async () => {
    conFetch(
      pagina({ url: SITIO, html: conMetas("<meta name='og:image' content='https://placas.cr/a.png'>") }),
    );

    expect(await findPreviewImage(SITIO)).toBe("https://placas.cr/a.png");
  });

  it("manda un user agent normal, que sin el varios sitios contestan 403", async () => {
    const espia = conFetch(pagina({ url: SITIO }));

    await findPreviewImage(SITIO);

    const headers = espia.mock.calls[0][1]?.headers ?? {};
    expect(headers["user-agent"]).toContain("HechoEnCR");
  });
});

describe("findPreviewImage: cuando no hay og:image", () => {
  it("cae al screenshot si la pagina no declara ninguna", async () => {
    conFetch(pagina({ url: SITIO, html: conMetas() }));

    expect(await findPreviewImage(SITIO)).toBe(screenshotUrl(SITIO));
  });

  it("cae al screenshot si el sitio contesta con error", async () => {
    conFetch(pagina({ ok: false, url: SITIO }));

    expect(await findPreviewImage(SITIO)).toBe(screenshotUrl(SITIO));
  });

  it("cae al screenshot si lo que devuelve no es html", async () => {
    /*
     * El cuerpo trae una etiqueta adentro a proposito. Con un `{}` pelado la
     * prueba no probaria nada: sin metadatos igual caeria al screenshot, con
     * guarda o sin ella. Asi se distingue haber mirado el content-type de
     * haberse puesto a buscar etiquetas en cualquier cosa.
     */
    conFetch(
      pagina({
        type: "application/json",
        url: SITIO,
        html: `{"nota":"<meta property='og:image' content='https://placas.cr/de-json.png'>"}`,
      }),
    );

    expect(await findPreviewImage(SITIO)).toBe(screenshotUrl(SITIO));
  });

  it("cae al screenshot si el sitio no contesta", async () => {
    conFetch(new TypeError("fetch failed"));

    expect(await findPreviewImage(SITIO)).toBe(screenshotUrl(SITIO));
  });

  it("cae al screenshot si la imagen declarada apunta a la red interna", async () => {
    conFetch(
      pagina({
        url: SITIO,
        html: conMetas('<meta property="og:image" content="http://127.0.0.1:9000/interna.png">'),
      }),
    );

    expect(await findPreviewImage(SITIO)).toBe(screenshotUrl(SITIO));
  });
});

describe("findPreviewImage: lo que no se consulta", () => {
  it("un enlace que apunta a la red interna no se visita", async () => {
    const espia = conFetch(pagina());

    expect(await findPreviewImage("http://localhost:3000")).toBeNull();
    expect(await findPreviewImage("http://10.0.0.5/")).toBeNull();
    expect(espia).not.toHaveBeenCalled();
  });

  it("un esquema que no es web tampoco", async () => {
    const espia = conFetch(pagina());

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
