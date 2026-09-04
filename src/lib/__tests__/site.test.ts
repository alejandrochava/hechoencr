import { describe, expect, it } from "vitest";

import { SORTS, TAGS, TAG_VALUES, isSortKey, tagLabel } from "@/lib/site";

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
