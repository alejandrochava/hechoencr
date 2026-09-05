import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/ui/primitives";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terminos",
  description: "Las reglas para usar el directorio: que podes publicar, como funcionan los reclamos y los votos.",
};

const UPDATED = "5 de septiembre de 2026";

export default function TerminosPage() {
  return (
    <Container width="narrow" className="animate-fade py-16">
      <h1 className="display text-[clamp(2rem,6vw,3rem)]">Terminos del servicio</h1>
      <p className="mt-4 text-sm text-muted">Ultima actualizacion: {UPDATED}</p>

      <div className="mt-10 space-y-8 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold tracking-tight">En corto</h2>
          <p className="mt-2 text-muted">
            {site.name} es un directorio publico y gratuito de proyectos hechos en Costa Rica.
            Usarlo implica aceptar estas reglas. Son cortas a proposito: publica cosas reales, no
            reclames lo que no es tuyo y no manipules los votos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">Tu cuenta</h2>
          <p className="mt-2 text-muted">
            Una persona, una cuenta, un voto por proyecto. Sos responsable de lo que se haga desde
            tu cuenta y de que los datos que diste sean tuyos y esten al dia. Si detectamos cuentas
            multiples de la misma persona, podemos cerrarlas.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">Que podes publicar</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-muted">
            <li>
              Proyectos con una conexion real con Costa Rica: hechos aca, por gente de aca, o para
              gente de aca.
            </li>
            <li>
              Informacion veraz. El nombre, el enlace y la descripcion tienen que corresponder al
              proyecto de verdad.
            </li>
            <li>
              Nada de spam, contenido ilegal, software malicioso, enlaces enganosos ni material que
              no tenes derecho a publicar.
            </li>
          </ul>
          <p className="mt-3 text-muted">
            Podemos editar o quitar una ficha que no cumpla esto, sin aviso previo si hace dano.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">Reclamos de propiedad</h2>
          <p className="mt-2 text-muted">
            Cualquiera puede publicar un proyecto que le parezca que merece estar en el directorio,
            aunque no sea suyo. Si es tuyo, lo reclamas: cuando el repositorio esta en tu cuenta de
            GitHub la verificacion es automatica, y si no, lo revisa una persona. La decision final
            sobre a quien se le asigna un proyecto es nuestra. Reclamar algo que no es tuyo es
            motivo para cerrar la cuenta.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">Votos</h2>
          <p className="mt-2 text-muted">
            Los votos existen para que se vea lo que a la gente le sirve. Inflarlos con cuentas
            falsas, bots o pidiendolos a cambio de algo desvirtua eso; si pasa, quitamos los votos y
            cerramos las cuentas involucradas.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">De quien es el contenido</h2>
          <p className="mt-2 text-muted">
            Lo que subis sigue siendo tuyo. Al publicarlo nos das permiso para mostrarlo en el
            directorio y en su vista previa. Los nombres, logos y marcas de los proyectos listados
            pertenecen a sus duenos, y aparecer en el directorio no significa que ese proyecto este
            afiliado con nosotros ni que nosotros lo respaldemos. Las imagenes de vista previa las
            toma el servidor del sitio que enlazaste. El codigo de este sitio es aparte: es abierto
            y tiene su propia licencia en el repositorio.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">Sin garantias</h2>
          <p className="mt-2 text-muted">
            El directorio se ofrece tal cual, sin garantia de que este siempre disponible, libre de
            errores o al dia. Los enlaces llevan a sitios de terceros que no controlamos: lo que
            pase ahi es entre ellos y vos. No respondemos por perdidas derivadas de usar el sitio o
            de confiar en lo que aparece publicado.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">Cerrar tu cuenta</h2>
          <p className="mt-2 text-muted">
            Podes irte cuando quieras y pedir que borremos tu cuenta. Que se borra y que queda esta
            en{" "}
            <Link
              href="/privacidad"
              className="text-accent-strong underline-offset-2 hover:underline"
            >
              Privacidad
            </Link>
            . Nosotros podemos cerrar una cuenta que incumpla estos terminos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">Cambios</h2>
          <p className="mt-2 text-muted">
            Si esto cambia, actualizamos la fecha de arriba. El historial completo esta en el
            repositorio, que es publico. Estos terminos se rigen por las leyes de Costa Rica.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">Contacto</h2>
          <p className="mt-2 text-muted">
            Para cualquier cosa de aca, escribinos desde{" "}
            <Link
              href="/contacto"
              className="text-accent-strong underline-offset-2 hover:underline"
            >
              Ayuda
            </Link>
            .
          </p>
        </section>
      </div>
    </Container>
  );
}
