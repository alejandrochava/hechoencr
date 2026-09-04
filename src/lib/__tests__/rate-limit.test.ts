import { beforeEach, describe, expect, it } from "vitest";

import {
  AUTH_LIMIT,
  clientIp,
  hit,
  limit,
  resetLimits,
  usingSharedCounter,
} from "@/lib/rate-limit";

const LIMITE = { max: 3, windowMs: 1000 };

describe("limite de peticiones", () => {
  beforeEach(() => resetLimits());

  it("deja pasar hasta el maximo y corta despues", () => {
    const inicio = 1_000_000;
    expect(hit("a", LIMITE, inicio).allowed).toBe(true);
    expect(hit("a", LIMITE, inicio).allowed).toBe(true);
    expect(hit("a", LIMITE, inicio).allowed).toBe(true);
    expect(hit("a", LIMITE, inicio).allowed).toBe(false);
  });

  it("dice cuanto falta para poder seguir", () => {
    const inicio = 1_000_000;
    for (let i = 0; i < 4; i++) hit("b", LIMITE, inicio);
    expect(hit("b", LIMITE, inicio).retryAfterSeconds).toBe(1);
  });

  it("se reinicia cuando pasa la ventana", () => {
    const inicio = 1_000_000;
    for (let i = 0; i < 4; i++) hit("c", LIMITE, inicio);
    expect(hit("c", LIMITE, inicio + 1001).allowed).toBe(true);
  });

  it("no mezcla claves distintas: dos personas en la misma red no se estorban", () => {
    const inicio = 1_000_000;
    for (let i = 0; i < 4; i++) hit("ip:1.1.1.1|usuario:ana", LIMITE, inicio);
    expect(hit("ip:1.1.1.1|usuario:beto", LIMITE, inicio).allowed).toBe(true);
  });

  it("el limite de autenticacion es mas estricto que el de lectura", () => {
    expect(AUTH_LIMIT.max).toBeLessThan(20);
  });
});

describe("ip del visitante", () => {
  it("toma el cliente original detras de un proxy", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("cae a x-real-ip y luego a desconocido", () => {
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(new Headers())).toBe("desconocido");
  });
});

describe("contador compartido", () => {
  it("solo se activa si estan las dos variables de Upstash", () => {
    // Sin configurar, la aplicacion cae al contador local sin fallar.
    expect(usingSharedCounter).toBe(false);
  });

  it("limit() responde igual que el contador local cuando no hay Redis", async () => {
    resetLimits();
    for (let i = 0; i < 3; i++) {
      expect((await limit("compartido", LIMITE)).allowed).toBe(true);
    }
    expect((await limit("compartido", LIMITE)).allowed).toBe(false);
  });
});
