import { describe, expect, it } from "vitest";

import { SORTS, TAGS, TAG_VALUES, isSortKey, tagLabel, tagsFromTopics } from "@/lib/site";

describe("categorias", () => {
  it("no tiene valores repetidos", () => {
    expect(new Set(TAG_VALUES).size).toBe(TAG_VALUES.length);
  });

  it("guarda el valor en minuscula y muestra la etiqueta con mayuscula", () => {
    for (const tag of TAGS) {
      expect(tag.value).toBe(tag.value.toLowerCase());
      expect(tag.label[0]).toBe(tag.label[0].toUpperCase());
    }
  });

  it("capitaliza categorias desconocidas en vez de romperse", () => {
    expect(tagLabel("datos")).toBe("Datos");
    expect(tagLabel("otra cosa")).toBe("Otra cosa");
  });
});

describe("orden del feed", () => {
  it("reconoce solo los modos definidos", () => {
    expect(isSortKey("destacados")).toBe(true);
    expect(isSortKey("borrar")).toBe(false);
    expect(isSortKey(undefined)).toBe(false);
  });

  it("cada modo apunta a una columna de la vista", () => {
    for (const sort of Object.values(SORTS)) {
      expect(sort.column).toMatch(/^[a-z_]+$/);
    }
  });
});

describe("tagsFromTopics", () => {
  it("acepta un topic que ya es una categoria nuestra", () => {
    expect(tagsFromTopics(["datos"])).toEqual(["datos"]);
  });

  it("traduce los topics que se pueden afirmar", () => {
    expect(tagsFromTopics(["open-data"])).toEqual(["datos"]);
    expect(tagsFromTopics(["machine-learning"])).toEqual(["ia"]);
    expect(tagsFromTopics(["openapi"])).toEqual(["api"]);
    expect(tagsFromTopics(["govtech"])).toEqual(["gobierno abierto"]);
  });

  /*
   * Lo importante es lo que NO adivina: un repo en TypeScript con React puede
   * ser cualquier cosa, y ponerle una categoria al azar es peor que dejar que
   * la elija quien publica.
   */
  it("no inventa categorias a partir de la tecnologia", () => {
    expect(tagsFromTopics(["typescript", "react", "nextjs", "docker"])).toEqual([]);
  });

  it("no repite cuando dos topics llevan a la misma categoria", () => {
    expect(tagsFromTopics(["open-data", "dataset", "data"])).toEqual(["datos"]);
  });

  it("corta en tres, que es el tope del formulario", () => {
    const topics = ["datos", "mapas", "api", "juegos", "salud"];

    expect(tagsFromTopics(topics)).toEqual(["datos", "mapas", "api"]);
  });

  it("ignora mayusculas y espacios de sobra", () => {
    expect(tagsFromTopics(["  Open-Data  ", "MAPS"])).toEqual(["datos", "mapas"]);
  });

  it("con la lista vacia devuelve vacio", () => {
    expect(tagsFromTopics([])).toEqual([]);
  });
});
