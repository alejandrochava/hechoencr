import { describe, expect, it } from "vitest";

import {
  formatPhoneCR,
  githubOwner,
  isPublicHttpUrl,
  repoRef,
  emailDomain,
  isDisposableEmail,
  isValidCRMobile,
  isValidEmailSyntax,
  normalizeEmail,
  MAX_PROJECT_LINKS,
  normalizePhoneCR,
  sanitizeProjectLinks,
  isValidHttpUrl,
  normalizeUrl,
  safeNextPath,
  sanitizeSearch,
  slugify,
} from "@/lib/text";

describe("slugify", () => {
  it("quita acentos y normaliza separadores", () => {
    expect(slugify("Consulta de Placas")).toBe("consulta-de-placas");
    expect(slugify("Trámites Rápidos")).toBe("tramites-rapidos");
  });

  it("no deja guiones sueltos en los bordes", () => {
    expect(slugify("  ¡Hola!  ")).toBe("hola");
    expect(slugify("///")).toBe("");
  });

  it("corta a 50 caracteres", () => {
    expect(slugify("a".repeat(80))).toHaveLength(50);
  });
});

describe("sanitizeSearch", () => {
  it("conserva texto normal, con acentos", () => {
    expect(sanitizeSearch("mapas de buses")).toBe("mapas de buses");
    expect(sanitizeSearch("Ñandú")).toBe("Ñandú");
  });

  it("elimina la sintaxis de filtros de PostgREST", () => {
    // Una coma abriria otra condicion dentro del or(...).
    expect(sanitizeSearch("a,name.eq.b")).toBe("a name.eq.b");
    expect(sanitizeSearch("x),or(id.gt.0")).not.toContain(",");
    expect(sanitizeSearch("x),or(id.gt.0")).not.toContain(")");
    expect(sanitizeSearch("50% *")).toBe("50");
  });

  it("acota el largo", () => {
    expect(sanitizeSearch("a".repeat(200))).toHaveLength(60);
  });
});

describe("normalizeUrl / isValidHttpUrl", () => {
  it("agrega el esquema cuando falta", () => {
    expect(normalizeUrl("tuproyecto.cr")).toBe("https://tuproyecto.cr");
    expect(normalizeUrl("http://x.cr")).toBe("http://x.cr");
    expect(normalizeUrl("   ")).toBe("");
  });

  it("rechaza lo que no es http", () => {
    expect(isValidHttpUrl("https://hechoencr.cr")).toBe(true);
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isValidHttpUrl("ftp://x.cr")).toBe(false);
    expect(isValidHttpUrl("no-es-url")).toBe(false);
  });
});

describe("githubOwner", () => {
  it("saca el dueno del repo", () => {
    expect(githubOwner("https://github.com/Usuario/repo")).toBe("usuario");
    expect(githubOwner("https://www.github.com/otro/repo/tree/main")).toBe("otro");
  });

  it("devuelve null cuando no es un repo de github", () => {
    expect(githubOwner("https://gitlab.com/a/b")).toBeNull();
    expect(githubOwner("https://github.com/soloUsuario")).toBeNull();
    expect(githubOwner(null)).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("solo acepta rutas internas", () => {
    expect(safeNextPath("/publicar")).toBe("/publicar");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});

describe("telefono movil de Costa Rica", () => {
  it("acepta moviles de los tres operadores", () => {
    expect(isValidCRMobile("81234567")).toBe(true);
    expect(isValidCRMobile("70001234")).toBe(true);
    expect(isValidCRMobile("61234567")).toBe(true);
  });

  it("acepta el mismo numero escrito de cualquier forma", () => {
    expect(normalizePhoneCR("+506 8123 4567")).toBe("81234567");
    expect(normalizePhoneCR("506-8123-4567")).toBe("81234567");
    expect(normalizePhoneCR("8123 4567")).toBe("81234567");
    expect(normalizePhoneCR("8123-4567")).toBe("81234567");
  });

  it("rechaza fijos, VoIP y relleno", () => {
    expect(isValidCRMobile("22001234")).toBe(false); // fijo
    expect(isValidCRMobile("40001234")).toBe(false); // voip
    expect(isValidCRMobile("00000000")).toBe(false);
    expect(isValidCRMobile("88888888")).toBe(false);
  });

  it("rechaza largos que no son de ocho digitos", () => {
    expect(isValidCRMobile("8123456")).toBe(false);
    expect(isValidCRMobile("812345678")).toBe(false);
    expect(isValidCRMobile("")).toBe(false);
  });

  it("lo muestra con guion", () => {
    expect(formatPhoneCR("+50681234567")).toBe("8123-4567");
  });
});

describe("correo", () => {
  it("acepta direcciones normales", () => {
    expect(isValidEmailSyntax("vos@correo.com")).toBe(true);
    expect(isValidEmailSyntax("nombre.apellido+etiqueta@sub.dominio.cr")).toBe(true);
    expect(isValidEmailSyntax("  VOS@CORREO.COM  ")).toBe(true);
  });

  it("rechaza lo que nunca podria entregarse", () => {
    expect(isValidEmailSyntax("sin-arroba.com")).toBe(false);
    expect(isValidEmailSyntax("dos@@arrobas.com")).toBe(false);
    expect(isValidEmailSyntax("sin@dominio")).toBe(false);
    expect(isValidEmailSyntax("punto..doble@correo.com")).toBe(false);
    expect(isValidEmailSyntax("@correo.com")).toBe(false);
    expect(isValidEmailSyntax("vos@correo.c")).toBe(false);
    expect(isValidEmailSyntax("vos@-mal.com")).toBe(false);
  });

  it("detecta correos temporales", () => {
    expect(isDisposableEmail("alguien@mailinator.com")).toBe(true);
    expect(isDisposableEmail("alguien@gmail.com")).toBe(false);
  });

  it("normaliza para comparar", () => {
    expect(normalizeEmail(" Vos@Correo.COM ")).toBe("vos@correo.com");
    expect(emailDomain("vos@correo.com")).toBe("correo.com");
  });
});

describe("enlaces extra del proyecto", () => {
  it("conserva los que estan completos y normaliza la URL", () => {
    expect(
      sanitizeProjectLinks([
        { label: "Documentacion", url: "docs.tuproyecto.cr" },
        { label: "Demo", url: "https://demo.tuproyecto.cr" },
      ]),
    ).toEqual([
      { label: "Documentacion", url: "https://docs.tuproyecto.cr" },
      { label: "Demo", url: "https://demo.tuproyecto.cr" },
    ]);
  });

  it("descarta filas incompletas y esquemas peligrosos", () => {
    expect(
      sanitizeProjectLinks([
        { label: "", url: "https://x.cr" },
        { label: "Sin enlace", url: "" },
        { label: "Malicioso", url: "javascript:alert(1)" },
      ]),
    ).toEqual([]);
  });

  it("no repite el mismo enlace y respeta el tope", () => {
    const repetidos = sanitizeProjectLinks([
      { label: "Uno", url: "https://x.cr" },
      { label: "Otro", url: "https://x.cr" },
    ]);
    expect(repetidos).toHaveLength(1);

    const muchos = Array.from({ length: 12 }, (_, i) => ({
      label: `Enlace ${i}`,
      url: `https://x${i}.cr`,
    }));
    expect(sanitizeProjectLinks(muchos)).toHaveLength(MAX_PROJECT_LINKS);
  });

  it("aguanta basura sin romperse", () => {
    expect(sanitizeProjectLinks(null)).toEqual([]);
    expect(sanitizeProjectLinks("texto")).toEqual([]);
    expect(sanitizeProjectLinks([null, 42, "x"])).toEqual([]);
  });
});

describe("repoRef", () => {
  it("lee dueno y repo de GitHub", () => {
    expect(repoRef("https://github.com/alejandrochava/hechoencr")).toMatchObject({
      host: "github.com",
      label: "GitHub",
      owner: "alejandrochava",
      repo: "hechoencr",
      url: "https://github.com/alejandrochava/hechoencr",
    });
  });

  it("completa el esquema, saca el www y normaliza el dueno a minuscula", () => {
    expect(repoRef("www.GitHub.com/AlejandroChava/HechoEnCR")).toMatchObject({
      owner: "alejandrochava",
      repo: "HechoEnCR",
      url: "https://github.com/AlejandroChava/HechoEnCR",
    });
  });

  it("saca el .git del final", () => {
    expect(repoRef("https://github.com/usuario/repo.git")?.url).toBe(
      "https://github.com/usuario/repo",
    );
  });

  it("corta la subruta que viene pegada de la barra de direcciones", () => {
    expect(repoRef("https://github.com/usuario/repo/tree/main/src")?.url).toBe(
      "https://github.com/usuario/repo",
    );
    expect(repoRef("https://github.com/usuario/repo/issues/12")?.repo).toBe("repo");
  });

  it("acepta subgrupos de GitLab", () => {
    expect(repoRef("https://gitlab.com/grupo/subgrupo/repo")?.url).toBe(
      "https://gitlab.com/grupo/subgrupo/repo",
    );
  });

  it("acepta el ~usuario de SourceHut", () => {
    expect(repoRef("https://git.sr.ht/~usuario/repo")).toMatchObject({
      owner: "usuario",
      url: "https://git.sr.ht/~usuario/repo",
    });
  });

  it("rechaza lo que no es una forja conocida", () => {
    expect(repoRef("https://miservidor.cr/git/repo")).toBeNull();
    expect(repoRef("https://gitlab.miempresa.cr/grupo/repo")).toBeNull();
  });

  it("rechaza una forja sin repositorio", () => {
    expect(repoRef("https://github.com/usuario")).toBeNull();
    expect(repoRef("https://github.com")).toBeNull();
    expect(repoRef("https://github.com/usuario/repo/tree")).toMatchObject({ repo: "repo" });
  });

  it("no se cae con basura", () => {
    expect(repoRef("")).toBeNull();
    expect(repoRef(null)).toBeNull();
    expect(repoRef("no es una url")).toBeNull();
  });
});

describe("isPublicHttpUrl", () => {
  it("acepta http y https publicos", () => {
    expect(isPublicHttpUrl("https://hechoencr.vercel.app")).toBe(true);
    expect(isPublicHttpUrl("http://ejemplo.cr/algo?x=1")).toBe(true);
    expect(isPublicHttpUrl("https://8.8.8.8")).toBe(true);
  });

  it("rechaza esquemas que no son web", () => {
    expect(isPublicHttpUrl("ftp://ejemplo.cr")).toBe(false);
    expect(isPublicHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isPublicHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isPublicHttpUrl("no es una url")).toBe(false);
  });

  it("rechaza nombres de la red local", () => {
    expect(isPublicHttpUrl("http://localhost:3000")).toBe(false);
    expect(isPublicHttpUrl("http://api.localhost")).toBe(false);
    expect(isPublicHttpUrl("http://impresora.local")).toBe(false);
    expect(isPublicHttpUrl("http://db.internal")).toBe(false);
    expect(isPublicHttpUrl("http://router.home.arpa")).toBe(false);
  });

  it("rechaza direcciones privadas escritas como IP", () => {
    for (const host of [
      "127.0.0.1",
      "10.0.0.1",
      "192.168.1.1",
      "172.16.0.1",
      "172.31.255.255",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "239.255.255.250",
    ]) {
      expect(isPublicHttpUrl(`http://${host}/`), host).toBe(false);
    }
  });

  it("acepta rangos publicos que se parecen a los privados", () => {
    expect(isPublicHttpUrl("http://172.15.0.1/")).toBe(true);
    expect(isPublicHttpUrl("http://172.32.0.1/")).toBe(true);
    expect(isPublicHttpUrl("http://100.63.0.1/")).toBe(true);
  });

  it("rechaza IPv6 local y la v4 mapeada adentro", () => {
    expect(isPublicHttpUrl("http://[::1]/")).toBe(false);
    expect(isPublicHttpUrl("http://[fe80::1]/")).toBe(false);
    expect(isPublicHttpUrl("http://[fc00::1]/")).toBe(false);
    // new URL normaliza la parte v4 a hexadecimal: ::ffff:7f00:1
    expect(isPublicHttpUrl("http://[::ffff:127.0.0.1]/")).toBe(false);
    expect(isPublicHttpUrl("http://[::ffff:7f00:1]/")).toBe(false);
    expect(isPublicHttpUrl("http://[::ffff:808:808]/")).toBe(true);
  });
});
