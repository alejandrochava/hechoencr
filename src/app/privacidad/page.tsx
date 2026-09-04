import type { Metadata } from "next";

import { Container } from "@/components/ui/primitives";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacidad",
  description: "Que datos guarda el directorio y que hace con ellos.",
};

const UPDATED = "4 de septiembre de 2026";

export default function PrivacidadPage() {
  return (
    <Container width="narrow" className="animate-fade py-16">
      <h1 className="display text-[clamp(2rem,6vw,3rem)]">Privacidad</h1>
      <p className="mt-4 text-sm text-muted">Ultima actualizacion: {UPDATED}</p>

      <div className="mt-10 space-y-8 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold tracking-tight">En corto</h2>
          <p className="mt-2 text-muted">
            {site.name} es un directorio publico de proyectos. Guardamos lo minimo para que
            funcione: quien publico que, quien voto que, y con quien contactarte. No vendemos
            datos, no hacemos perfiles publicitarios y no hay rastreadores de terceros.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">Que guardamos</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-muted">
            <li>
              <strong className="text-text">Tu cuenta.</strong> Correo, nombre visible, foto y
              usuario de GitHub si lo enlazas. Vienen de GitHub, de Google o del correo con el que
              entraste. Nunca vemos ni guardamos tu contrasena: la autenticacion la maneja Supabase
              Auth.
            </li>
            <li>
              <strong className="text-text">Lo que publicas.</strong> Nombre, enlace, descripcion y
              categorias de los proyectos que subis. Todo eso es publico, para eso es el directorio.
            </li>
            <li>
              <strong className="text-text">Tus votos.</strong> Guardamos que cuenta voto que
              proyecto, para que sea un voto por persona. El conteo es publico; quien voto no se
              muestra en la interfaz.
            </li>
            <li>
              <strong className="text-text">Reclamos de propiedad.</strong> La evidencia y el
              contacto que mandas cuando decis que un proyecto es tuyo. Lo lee un administrador
              para verificarlo.
            </li>
            <li>
              <strong className="text-text">Visitas.</strong> Un contador por proyecto, sin IP, sin
              cookies de seguimiento y sin identificar a quien visita.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">Cookies</h2>
          <p className="mt-2 text-muted">
            Solo la cookie de sesion, para mantenerte con la sesion abierta, y una preferencia de
            tema guardada en tu navegador. Nada de publicidad ni analitica de terceros.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">Con quien se comparte</h2>
          <p className="mt-2 text-muted">
            Con nadie, salvo los servicios necesarios para que el sitio funcione: Supabase (base de
            datos y autenticacion) y el proveedor donde esta desplegado el sitio. Cuando publicas un
            proyecto, el servidor visita el sitio que indicaste para tomar su imagen de vista
            previa; esa visita la ve ese sitio, como cualquier otra.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">Tus derechos</h2>
          <p className="mt-2 text-muted">
            Podes pedir que borremos tu cuenta y todo lo asociado. Al borrar la cuenta se eliminan
            tu perfil, tus votos y tus reclamos; los proyectos que publicaste quedan en el
            directorio como &quot;sin reclamar&quot;, porque son informacion publica sobre un sitio
            que existe, no datos tuyos. Escribinos y lo hacemos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">Cambios</h2>
          <p className="mt-2 text-muted">
            Si esto cambia, actualizamos la fecha de arriba. El historial completo esta en el
            repositorio, que es publico.
          </p>
        </section>
      </div>
    </Container>
  );
}
