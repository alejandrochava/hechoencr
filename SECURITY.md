# Seguridad

## Reportar una vulnerabilidad

Si encontras un problema de seguridad, **no abras un issue publico**. Abri un
[security advisory privado](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
en GitHub, que llega solo a quien mantiene el repositorio.

Contanos que encontraste y como reproducirlo. Respondemos lo antes posible y te
damos credito si queres.

## Que esperar

- Confirmamos que recibimos el reporte y te decimos si lo tomamos.
- Mientras trabajamos el arreglo, te pedimos que no lo publiques.
- Cuando esta arreglado, lo anunciamos y te acreditamos.

## Como esta pensado el proyecto

La autorizacion vive en la base de datos, no en el frontend: todo pasa por Row
Level Security en Postgres, asi que la llave publica del cliente solo puede
hacer lo que las policies permiten, aunque alguien llame la API directo
saltandose la interfaz. `supabase/schema.sql` es la fuente de verdad de quien
puede leer y escribir que; si un cambio toca permisos, se ve ahi.

Las consultas no se arman concatenando strings, la entrada de usuario se valida
del lado del servidor aunque el navegador ya la haya filtrado, y hay limites de
peticiones sobre lectura, escritura y autenticacion.

Los secretos nunca van al repositorio. Las llaves del `docker-compose.yml` son
locales y de mentira, para desarrollo; las de produccion son variables de
entorno del proveedor.

> Esta seccion describe el enfoque, no los detalles de implementacion. Los
> valores concretos —umbrales, ventanas, listas, que pasa cuando una
> dependencia se cae— viven en el codigo y ahi se revisan. Un documento
> publico que los enumere es un mapa para saltarselos.

## Que no cubre

El proyecto se apoya en Supabase (base, autenticacion) y en el proveedor de
hospedaje. Los problemas de esos servicios se reportan a ellos. Aca nos
ocupamos del codigo de este repositorio y de como esta configurado.
