/**
 * Doble del cliente de Supabase para probar las acciones.
 *
 * No pretende parecerse a la libreria: implementa exactamente lo que las
 * acciones usan —auth.getUser, un constructor de consultas encadenable y rpc—
 * y registra lo que se escribio, que es sobre lo que se afirma.
 *
 * No termina en .test.ts a proposito: vitest solo recoge esos.
 */

export type Respuesta = { data: unknown; error?: ErrorFalso | null };

export type ErrorFalso = { message: string; code?: string; details?: string };

export type Escritura = {
  table: string;
  op: "insert" | "update" | "delete";
  payload: Record<string, unknown>;
  filters: [string, unknown][];
};

export type Identidad = {
  provider: string;
  identity_data?: Record<string, unknown>;
};

export type Usuario = { id: string; identities?: Identidad[] };

export type ConfigFake = {
  user?: Usuario | null;
  /** Respuestas de maybeSingle, en orden de llamada. */
  singles?: Respuesta[];
  /** Lo que devuelve cualquier escritura. */
  writeError?: ErrorFalso | null;
  /** Lo que devuelve rpc(). */
  rpc?: Respuesta;
};

export function fakeSupabase(config: ConfigFake = {}) {
  const cola = [...(config.singles ?? [])];
  const escrituras: Escritura[] = [];
  const rpcCalls: { name: string; args: unknown }[] = [];

  function from(table: string) {
    const filters: [string, unknown][] = [];
    let op: "select" | "insert" | "update" | "delete" = "select";
    let payload: Record<string, unknown> = {};

    const chain = {
      select: () => chain,
      order: () => chain,
      limit: () => chain,
      not: () => chain,
      contains: () => chain,
      eq: (columna: string, valor: unknown) => {
        filters.push([columna, valor]);
        return chain;
      },
      insert: (data: Record<string, unknown>) => {
        op = "insert";
        payload = data;
        return chain;
      },
      update: (data: Record<string, unknown>) => {
        op = "update";
        payload = data;
        return chain;
      },
      delete: () => {
        op = "delete";
        return chain;
      },
      maybeSingle: async () => cola.shift() ?? { data: null, error: null },
      // Esperar la cadena es lo que dispara la escritura, igual que en
      // supabase-js: la consulta se manda cuando alguien la awaitea.
      then: (ok: (valor: Respuesta) => unknown, fail?: (motivo: unknown) => unknown) => {
        if (op !== "select") escrituras.push({ table, op, payload, filters });
        return Promise.resolve({ data: null, error: config.writeError ?? null }).then(ok, fail);
      },
    };

    return chain;
  }

  const client = {
    auth: { getUser: async () => ({ data: { user: config.user ?? null } }) },
    from,
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return config.rpc ?? { data: null, error: null };
    },
  };

  return { client, escrituras, rpcCalls };
}

/**
 * Ejecuta una accion que puede terminar en redirect y devuelve el destino.
 * El doble de redirect lanza, igual que el de Next, asi que hay que atraparlo.
 */
export async function correr<T>(accion: () => Promise<T>) {
  try {
    return { resultado: await accion(), destino: null as string | null };
  } catch (error) {
    const destino = (error as { destino?: string }).destino;
    if (!destino) throw error;
    return { resultado: null, destino };
  }
}
