import { Container, Skeleton } from "@/components/ui/primitives";

/**
 * Lo que se ve mientras el servidor arma la pagina.
 *
 * Es deliberadamente neutro: este archivo cubre todas las rutas que no traen
 * su propio loading, asi que dibujar la reja de tarjetas del directorio se
 * veria mal en Privacidad o en Terminos. Marca el sitio y no promete una forma.
 */
export default function Loading() {
  return (
    <Container width="narrow" className="py-24">
      <div className="space-y-4">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <span className="sr-only">Cargando</span>
    </Container>
  );
}
