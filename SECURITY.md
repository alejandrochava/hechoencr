# Seguridad

## Reportar una vulnerabilidad

Si encontras un problema de seguridad, **no abras un issue publico**. Escribi a
la persona que mantiene el repositorio o abri un
[security advisory privado](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
en GitHub. Respondemos lo antes posible y te damos credito si queres.

## Como esta protegido el proyecto

**Autorizacion en la base, no en el frontend.** Todo pasa por Row Level
Security en Postgres. La llave publica del cliente solo puede hacer lo que las
policies permiten, aunque alguien llame la API directo saltandose la interfaz.
`supabase/schema.sql` es la fuente de verdad de quien puede leer y escribir que.

**Sin SQL armado con strings.** No concatenamos consultas. Las lecturas y
escrituras van por PostgREST, que parametriza todo, y las funciones en SQL
reciben argumentos tipados. El unico texto libre que llega a un filtro es el
buscador, y pasa por `sanitizeSearch()`, que usa lista blanca (solo letras,
numeros, espacios y `. _ -`): asi no se puede inyectar sintaxis de filtros de
PostgREST. Hay tests que lo verifican.

**Funciones con privilegios acotados.** Las funciones `security definer`
(`resolve_claim`, `claim_with_github`, `register_view`) fijan `search_path` y
validan permisos adentro. `resolve_claim` exige admin; `claim_with_github` solo
mira el handle de GitHub que vino de la identidad de OAuth, nunca uno que la
persona escriba.

**Contrasenas.** El proyecto no guarda ni ve contrasenas: la autenticacion es
OAuth (GitHub, Google) o enlace por correo, y las credenciales las maneja
Supabase Auth (GoTrue), que las guarda hasheadas con bcrypt en un esquema al
que la aplicacion no accede.

**Identificadores.** Todas las tablas usan UUID v4 (`gen_random_uuid()`), no
enteros secuenciales: no se puede recorrer la base adivinando ids ni deducir
cuantos registros hay.

**Peticiones salientes.** Al leer la `og:image` de un sitio, el servidor hace
un fetch a una URL que escribio un usuario. `src/lib/preview.ts` rechaza
`localhost`, `127.0.0.0/8`, rangos privados y link-local antes de salir, para
que no se use como puente hacia la red interna (SSRF).

**Redirecciones.** Los parametros `next` solo aceptan rutas internas
(`safeNextPath`), asi que un enlace no puede mandar a alguien a otro dominio
despues de entrar.

**Una identidad, una cuenta.** El correo ya es unico en Supabase Auth; el
usuario de GitHub y el telefono los protegen indices unicos en `profiles`. El
telefono se guarda normalizado a 8 digitos, asi que "+506 8123 4567" y
"81234567" son el mismo numero y no se puede abrir una segunda cuenta
reescribiendolo. Como cada voto pertenece a una cuenta y se borra en cascada
con ella, inflar votaciones exige correos y telefonos distintos de verdad.

**Correos verificables.** Se rechaza la sintaxis invalida, los dominios de
correo temporal y los dominios sin registros MX (asi caen `a@a.com` y los
errores de dedo tipo `gmial.com`). Si el DNS falla por red, se deja pasar:
bloquear a alguien real por un problema nuestro es peor. La prueba definitiva
sigue siendo el enlace de acceso, que solo puede abrir quien recibe el correo.

**Limite de peticiones.** `src/lib/rate-limit.ts` aplica una ventana
deslizante por IP en el middleware: generosa para leer (240/min, porque diez
personas en una oficina comparten IP) y estricta para escribir (20/min) y para
autenticarse (6 cada 5 minutos, ya que cada intento manda un correo). Al
pasarse responde 429 con `retry-after`. Con `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` el contador es
compartido entre instancias, que es lo que hace falta en serverless; sin esas
variables funciona en memoria, por proceso. Si Redis no responde, la aplicacion
cae sola al contador local: proteger de menos es mejor que tumbar el sitio.

**Secretos.** `.gitignore` excluye `.env*`. Las llaves del `docker-compose.yml`
son locales y de mentira, sirven solo para desarrollo. Las de produccion van
como variables de entorno del proveedor, nunca al repositorio.
