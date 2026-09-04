import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { AUTH_LIMIT, READ_LIMIT, WRITE_LIMIT, clientIp, limit } from "@/lib/rate-limit";
import {
  AUTH_COOKIE_NAME,
  SUPABASE_KEY,
  SUPABASE_SERVER_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

/** Rutas que exigen sesion. /publicar no esta: ahi el login llega al publicar. */
const NEEDS_SESSION = ["/admin", "/cuenta"];

/** Rutas que ademas exigen ser admin. */
const NEEDS_ADMIN = ["/admin"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Refresca la sesion en cada request y hace de guardia de rutas.
 * (En Next 16 esto vive en proxy.ts, antes middleware.ts.)
 */
/** Rutas donde cada intento manda un correo: se cuidan aparte. */
const AUTH_PATHS = ["/auth"];

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  /*
   * Freno de volumen. Una red compartida (una oficina, un cafe) sale con una
   * sola IP y tiene que funcionar sin trabas; lo que se corta es el ritmo que
   * solo produce un script. Por eso leer es generoso y escribir es estricto.
   */
  const ip = clientIp(request.headers);
  const isWrite = request.method !== "GET" && request.method !== "HEAD";
  const isAuth = AUTH_PATHS.some((prefix) => pathname.startsWith(prefix));
  const bucket = isAuth ? "auth" : isWrite ? "write" : "read";
  const verdict = await limit(`ratelimit:${bucket}:${ip}`, isAuth ? AUTH_LIMIT : isWrite ? WRITE_LIMIT : READ_LIMIT);

  if (!verdict.allowed) {
    return new NextResponse("Demasiadas peticiones. Espera un momento.", {
      status: 429,
      headers: {
        "retry-after": String(verdict.retryAfterSeconds),
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }

  // El login es un modal, no una pagina: /entrar queda solo como atajo.
  if (pathname === "/entrar") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    const next = searchParams.get("next");
    url.search = next ? `?login=1&next=${encodeURIComponent(next)}` : "?login=1";
    return NextResponse.redirect(url);
  }

  if (!isSupabaseConfigured) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_SERVER_URL, SUPABASE_KEY, {
    cookieOptions: { name: AUTH_COOKIE_NAME },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (matches(pathname, NEEDS_SESSION) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = `?login=1&next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (matches(pathname, NEEDS_ADMIN) && user) {
    // El rol vive en la base, no en el token: una lectura, y solo bajo /admin.
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_admin) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
