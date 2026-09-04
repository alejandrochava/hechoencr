# Hecho en CR

Directorio de proyectos de software hechos en Costa Rica. La gente publica su proyecto,
la comunidad vota, y los autores pueden reclamar los proyectos que alguien mas publico.

Stack: Next.js 16 (App Router) · Supabase (Postgres + Auth + RLS) · Tailwind 4.

Proyecto abierto bajo licencia [MIT](LICENSE). Los aportes son bienvenidos:
leé [CONTRIBUTING.md](CONTRIBUTING.md). Si encontras un problema de seguridad,
mirá [SECURITY.md](SECURITY.md) antes de abrir un issue.

## Que es esto

Un lugar donde ver que se esta construyendo en Costa Rica. Cualquiera publica
un proyecto (propio o ajeno), la comunidad vota, y quien lo hizo puede
reclamarlo para aparecer como su autor. Nace de una idea simple: las
herramientas ticas buenas existen pero estan desperdigadas, y no hay un lugar
donde buscarlas.

**Como funciona en tres puntos:**

1. Publicas un proyecto con su enlace. El servidor le busca una imagen de vista
   previa solo.
2. La gente vota. El orden de *Destacados* usa decaimiento por tiempo, para que
   lo viejo no se quede pegado arriba.
3. Si un proyecto es tuyo, lo reclamas. Con GitHub la verificacion es
   instantanea; si no, la revisa un administrador.

## Ramas

| Rama | Para que |
| --- | --- |
| `dev` | Donde se trabaja. Todos los PR entran aca. |
| `main` | Estado estable, se actualiza desde `dev`. |
| `produccion` | Lo que esta publicado. Un push aca despliega, si CI queda verde. |

La CI (`.github/workflows/ci.yml`) corre lint, tests y build en cada push y en
cada PR. El despliegue (`deploy.yml`) solo corre en `produccion` y solo despues
de que esos tres pasan.

## Arrancar con Docker (recomendado para probar)

Levanta todo el stack sin cuenta de Supabase: Postgres, GoTrue (auth), PostgREST,
un gateway nginx, Mailpit para ver los correos, y la app.

```bash
docker compose up -d --build
```

- Sitio: http://localhost:3000
- Correos (magic links): http://localhost:8025
- Base de datos: `postgres://postgres:postgres@localhost:54322/postgres`

El servicio `migrate` aplica `supabase/schema.sql`, los permisos y los datos de
ejemplo la primera vez. Para entrar, pedi un enlace desde `/entrar` y abrilo
desde Mailpit. Para volverte admin:

```bash
docker compose exec db psql -U postgres -c "update profiles set is_admin = true where handle = 'tu-usuario';"
```

Bajar todo (`-v` borra tambien la base):

```bash
docker compose down -v
```

Las llaves del `docker-compose.yml` son locales y de mentira; en produccion se
usan las de Supabase.

## Arrancar contra Supabase hosted

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).

2. Copia las llaves:

   ```bash
   cp .env.example .env.local
   ```

   En Supabase: **Project Settings → API**. Pega `Project URL` en `NEXT_PUBLIC_SUPABASE_URL`
   y la llave publica (`anon` / `publishable`) en `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

3. En el **SQL Editor** de Supabase, corre `supabase/schema.sql` completo.
   Si queres ver la interfaz con contenido, corre tambien `supabase/seed.sql`
   (son datos inventados: borralos con `delete from public.projects where slug like 'demo-%';`).

4. Login: en **Authentication → Providers** activa GitHub y/o Google, y en
   **URL Configuration** agrega `http://localhost:3000/auth/callback` como redirect.
   El acceso por correo (magic link) ya funciona sin configurar nada.

5. Corre el sitio:

   ```bash
   npm run dev
   ```

6. Para volverte admin (y poder aprobar reclamos en `/admin/reclamos`), entra una vez
   al sitio y despues corre en el SQL Editor:

   ```sql
   update public.profiles set is_admin = true where handle = 'tu-usuario';
   ```

## Publicar en Vercel

Vercel solo hospeda la aplicacion; la base de datos y la autenticacion viven en
Supabase. Estas son las cuentas, todas con plan gratis suficiente para arrancar:

| Servicio | Para que | Obligatorio |
| --- | --- | --- |
| [Supabase](https://supabase.com) | Base de datos, autenticacion y RLS | Si |
| [Vercel](https://vercel.com) | Hospedaje de la aplicacion | Si |
| [Resend](https://resend.com) | Aviso por correo de los mensajes de contacto | No |
| [Upstash](https://upstash.com) | Contador compartido del limite de peticiones | No |

Sin Resend los mensajes igual se guardan y se leen en `/admin/mensajes`; sin
Upstash el limite funciona por instancia en vez de compartido. El sitio
arranca sin las dos ultimas.

**Pasos:**

1. Crea el proyecto en Supabase y corre `supabase/schema.sql` completo en su
   SQL Editor.
2. En **Authentication → URL Configuration**, agrega
   `https://tu-dominio/auth/callback` como redirect. Activa GitHub y Google en
   **Providers** si los queres.
3. Importa el repositorio en Vercel y define las variables de `.env.example`.
   Las `NEXT_PUBLIC_*` se incrustan al compilar; el resto son solo del servidor.
4. Para que el despliegue automatico funcione, agrega en **Settings → Secrets →
   Actions** del repositorio: `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
   `VERCEL_PROJECT_ID` y las tres `NEXT_PUBLIC_*`.
5. Un push a `produccion` publica, siempre que lint, tests y build queden en
   verde.

**Sobre Resend:** su dominio de pruebas (`onboarding@resend.dev`) solo entrega
a la direccion con la que te registraste, que es justo la de `CONTACT_EMAIL`.
Para mandar correo a otras direcciones hay que verificar un dominio propio.

## Como funciona

**Ranking.** La vista `project_feed` calcula el puntaje de *Destacados* con decaimiento
por tiempo (`votos / (horas + 2)^1.5`, el mismo de Hacker News), para que los proyectos
viejos no se queden pegados arriba para siempre. *Tendencia* usa solo los votos de los
ultimos 7 dias, *Nuevos* es cronologico y *Mas vistos* usa `view_count`.

**Votos.** La llave primaria de `votes` es `(project_id, user_id)`, asi que un voto por
persona por proyecto esta garantizado por la base, no por el frontend. Un trigger mantiene
`projects.vote_count` al dia. Votar exige sesion.

**Vista previa.** Al publicar, el servidor lee la `og:image` que el sitio ya
declara. Si no tiene, cae a un screenshot automatico (mShots de WordPress, sin
llave). Si tampoco carga, la tarjeta dibuja un monograma con un degradado
derivado del slug, para que ninguna tarjeta quede como un hueco gris. Todo eso
vive en `src/lib/preview.ts`, que ademas bloquea URLs a la red interna.

**Reclamos.** Un proyecto sin `owner_id` sale marcado como *sin reclamar*. Cualquiera con
sesion manda un reclamo con evidencia; un admin lo aprueba en `/admin/reclamos` y la
funcion `resolve_claim` le asigna la propiedad. Es verificacion manual a proposito: al
inicio son pocos y revisarlos a mano es mas rapido que automatizarlo.

**Autoria y privacidad.** Un proyecto tiene dos personas posibles: quien lo
reclamo (`owner_id`) y quien lo trajo al directorio (`submitted_by`). La ficha
reconoce a las dos. Cada quien decide si su nombre aparece: con el perfil en
privado el credito sigue existiendo ("Alguien de la comunidad") pero sin
nombre, sin enlace y sin perfil publico.

**Enlaces extra.** Quien publica puede sumar hasta seis enlaces (documentacion,
demo, changelog). Se guardan como JSON en `projects.links` y la aplicacion los
valida siempre del lado del servidor, aunque el navegador ya los haya filtrado.

**Seguridad.** Todo pasa por Row Level Security en Postgres. La llave publica del cliente
no puede leer ni escribir nada que las policies no permitan, incluso si alguien llama la
API directo.

## Estructura

```
src/
  app/
    page.tsx              feed con pestanas, busqueda y filtro por categoria
    p/[slug]/page.tsx     ficha del proyecto
    publicar/page.tsx     formulario para publicar
    entrar/page.tsx       login (GitHub, Google, magic link)
    admin/reclamos/       cola de reclamos para admins
    auth/callback/        intercambio del code de OAuth por sesion
  components/             UI (tarjeta, boton de voto, filtros, formularios)
  lib/
    site.ts               marca, categorias y modos de orden
    queries.ts            lecturas
    actions.ts            escrituras (server actions)
    supabase/             clientes de servidor y navegador
  proxy.ts                refresca la sesion en cada request
supabase/
  schema.sql              tablas, triggers, RLS, vista del feed
  seed.sql                datos de ejemplo
docker/
  postgres-init/          roles y auth.uid() que Supabase hosted ya trae
  nginx.conf              gateway: /auth/v1 y /rest/v1 bajo un solo origen
  migrate.sh              aplica el esquema cuando GoTrue ya migro auth.users
  grants.sql              permisos de tabla para anon y authenticated
Dockerfile                imagen de la app (build standalone)
docker-compose.yml        el stack completo
```

## Comandos

```bash
npm run dev     # desarrollo
npm run lint    # eslint
npm test        # vitest
npm run build   # build de produccion
```

## Nota sobre los estados de carga

No hay archivos `loading.tsx`. En Next 16.3.4 con Turbopack, el Suspense que
crea un `loading.tsx` en la raiz dejaba el contenido de la pagina sin hidratar
en la primera carga (el layout si hidrataba, la pagina no; navegando por el
router funcionaba bien). Sintoma: formularios y botones inertes al entrar
directo a una URL. Hasta resolverlo, el primitivo `Skeleton` sigue disponible
en `src/components/ui/primitives.tsx` para usarlo dentro de un `<Suspense>`
puntual.

## Pendientes

- Verificacion por dominio (registro TXT en el DNS o meta tag en el sitio), para
  proyectos que no tienen repositorio publico.
- Comentarios en las fichas.
- Sembrar el directorio con proyectos ticos reales antes de abrirlo al publico.
