import { Container, Skeleton } from "@/components/ui/primitives";

/**
 * Lo que se ve mientras el servidor arma el feed.
 *
 * Vive en un grupo de rutas —(directorio), que no aparece en la URL— y no en
 * la raiz a proposito. Un loading en la raiz envuelve tambien /p/[slug] y
 * /u/[handle], y ahi hace dano: la pagina se empieza a enviar con 200 antes de
 * resolver, asi que cuando el proyecto no existe y se llama a notFound() ya no
 * se puede cambiar el estado. Quedaba un soft 404 —pantalla de "aca no hay
 * nada" con estado 200— que un buscador indexa como pagina valida.
 *
 * Acotado al feed, que es la unica pantalla lenta y la unica que nunca llama a
 * notFound(), se gana el esqueleto sin perder el 404.
 */
export default function Loading() {
  return (
    <Container width="content" className="py-8">
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>

      <Skeleton className="mt-8 h-control-md w-full max-w-md" />

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-[16/9] w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>

      <span className="sr-only">Cargando el directorio</span>
    </Container>
  );
}
