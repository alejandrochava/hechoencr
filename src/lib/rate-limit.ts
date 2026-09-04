/**
 * Limite de peticiones por ventana deslizante.
 *
 * La idea no es cobrar peaje: diez personas en la misma oficina comparten IP y
 * tienen que poder usar el sitio con normalidad. Lo que corta es el volumen
 * que solo produce un script: cientos de peticiones por minuto desde un mismo
 * origen. Por eso el limite de lectura es alto y el de escritura bajo.
 *
 * Hay dos implementaciones detras de la misma funcion `limit()`:
 *
 *   - Upstash Redis, si estan las variables. Es el contador compartido, el
 *     unico que sirve cuando el sitio corre en varias instancias (Vercel
 *     levanta una por region y por rafaga de trafico).
 *   - Memoria del proceso, si no. Alcanza para desarrollo y para un servidor
 *     unico, y es la red de seguridad si Redis se cae.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 20_000;

export type Limit = { max: number; windowMs: number };

/** Lecturas: generoso, pensado para una red compartida. */
export const READ_LIMIT: Limit = { max: 240, windowMs: 60_000 };

/** Escrituras (server actions, formularios): lo que haria una persona. */
export const WRITE_LIMIT: Limit = { max: 20, windowMs: 60_000 };

/** Autenticacion: cada intento manda un correo, asi que va mas apretado. */
export const AUTH_LIMIT: Limit = { max: 6, windowMs: 300_000 };

export type Verdict = { allowed: boolean; retryAfterSeconds: number };

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export const usingSharedCounter = Boolean(REDIS_URL && REDIS_TOKEN);

/** Contador en memoria. Sincrono y puro: es lo que cubren las pruebas. */
export function hit(key: string, limit: Limit, now = Date.now()): Verdict {
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    // El Map se limpia solo cuando crece: sin cron ni timers colgando.
    if (buckets.size > MAX_KEYS) sweep(now);
    buckets.set(key, { count: 1, resetAt: now + limit.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit.max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Si aun asi quedo enorme, es un ataque: se descarta todo y se vuelve a cero.
  if (buckets.size > MAX_KEYS) buckets.clear();
}

/** Solo para las pruebas. */
export function resetLimits() {
  buckets.clear();
}

/**
 * Contador compartido en Upstash.
 *
 * Una sola llamada HTTP: incrementa, pone el vencimiento si es la primera vez
 * de la ventana (`NX` para no reiniciarlo en cada peticion) y pregunta cuanto
 * falta. Si Redis falla, devuelve null y quien llama cae al contador local:
 * es preferible proteger de menos a tumbar el sitio por un problema de red.
 */
async function hitRedis(key: string, limit: Limit): Promise<Verdict | null> {
  if (!REDIS_URL || !REDIS_TOKEN) return null;

  const seconds = Math.ceil(limit.windowMs / 1000);

  try {
    const response = await fetch(`${REDIS_URL}/pipeline`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${REDIS_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(seconds), "NX"],
        ["TTL", key],
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });

    if (!response.ok) return null;

    const results = (await response.json()) as Array<{ result?: number; error?: string }>;
    const count = Number(results[0]?.result ?? 0);
    const ttl = Number(results[2]?.result ?? seconds);

    if (!count) return null;
    if (count > limit.max) {
      return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : seconds };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  } catch {
    return null;
  }
}

/** La puerta que usa la aplicacion. Comparte contador si puede; si no, local. */
export async function limit(key: string, limitConfig: Limit): Promise<Verdict> {
  const shared = await hitRedis(key, limitConfig);
  return shared ?? hit(key, limitConfig);
}

/**
 * IP del visitante. Detras de un proxy el socket siempre es el del proxy, asi
 * que se usa el primer valor de x-forwarded-for, que es el cliente original.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "desconocido";
}
