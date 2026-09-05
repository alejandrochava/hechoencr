/**
 * Doble del cliente de Supabase para probar las acciones y las consultas.
 *
 * No pretende parecerse a la libreria: implementa exactamente lo que el codigo
 * usa —auth, un constructor de consultas encadenable y rpc— y registra lo que
 * se pidio y lo que se escribio, que es sobre lo que se afirma.
 *
 * No termina en .test.ts a proposito: vitest solo recoge esos.
 */

export type ErrorFalso = { message: string; code?: string; details?: string };

export type Respuesta = { data: unknown; error?: ErrorFalso | null };

/** Lo que devuelve una lectura que se espera directamente (sin maybeSingle). */
export type Lectura = { data?: unknown; error?: ErrorFalso | null; count?: number };

export type Escritura = {
  table: string;
  op: "insert" | "update" | "delete";
  payload: Record<string, unknown>;
  filters: [string, unknown][];
};

/** Todo lo que se le pidio a la base, para poder afirmar sobre la consulta. */
export type Consulta = {
  table: string;
  columns?: string;
  options?: Record<string, unknown>;
  filters: [string, unknown][];
  order: { column: string; ascending?: boolean }[];
  in?: [string, unknown[]];
  not?: [string, string, unknown];
  contains?: [string, unknown];
  or?: string;
  range?: [number, number];
  limit?: number;
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
  /** Respuestas de las lecturas que se esperan directamente, en orden. */
  reads?: Lectura[];
  /** Lo que devuelve cualquier escritura. */
  writeError?: ErrorFalso | null;
  /** Lo que devuelve rpc(). */
  rpc?: Respuesta;
};

export function fakeSupabase(config: ConfigFake = {}) {
  const colaSingles = [...(config.singles ?? [])];
  const colaReads = [...(config.reads ?? [])];
  const escrituras: Escritura[] = [];
  const consultas: Consulta[] = [];
  const rpcCalls: { name: string; args: unknown }[] = [];
  const authCalls: string[] = [];

  function from(table: string) {
    const consulta: Consulta = { table, filters: [], order: [] };
    let op: "select" | "insert" | "update" | "delete" = "select";
    let payload: Record<string, unknown> = {};

    const chain = {
      select: (columns?: string, options?: Record<string, unknown>) => {
        consulta.columns = columns;
        consulta.options = options;
        return chain;
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        consulta.order.push({ column, ascending: options?.ascending });
        return chain;
      },
      range: (desde: number, hasta: number) => {
        consulta.range = [desde, hasta];
        return chain;
      },
      limit: (cuantos: number) => {
        consulta.limit = cuantos;
        return chain;
      },
      contains: (columna: string, valor: unknown) => {
        consulta.contains = [columna, valor];
        return chain;
      },
      or: (expresion: string) => {
        consulta.or = expresion;
        return chain;
      },
      in: (columna: string, valores: unknown[]) => {
        consulta.in = [columna, valores];
        return chain;
      },
      not: (columna: string, operador: string, valor: unknown) => {
        consulta.not = [columna, operador, valor];
        return chain;
      },
      eq: (columna: string, valor: unknown) => {
        consulta.filters.push([columna, valor]);
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
      maybeSingle: async () => {
        consultas.push(consulta);
        return colaSingles.shift() ?? { data: null, error: null };
      },
      // Esperar la cadena es lo que la manda, igual que en supabase-js: la
      // consulta viaja cuando alguien la awaitea.
      then: (ok: (valor: unknown) => unknown, fail?: (motivo: unknown) => unknown) => {
        if (op === "select") {
          consultas.push(consulta);
          const lectura = colaReads.shift() ?? {};
          return Promise.resolve({
            data: lectura.data ?? null,
            error: lectura.error ?? null,
            count: lectura.count ?? null,
          }).then(ok, fail);
        }

        escrituras.push({ table, op, payload, filters: consulta.filters });
        return Promise.resolve({ data: null, error: config.writeError ?? null }).then(ok, fail);
      },
    };

    return chain;
  }

  const client = {
    auth: {
      getUser: async () => ({ data: { user: config.user ?? null } }),
      signOut: async () => {
        authCalls.push("signOut");
        return { error: null };
      },
    },
    from,
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return config.rpc ?? { data: null, error: null };
    },
  };

  return { client, escrituras, consultas, rpcCalls, authCalls };
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
