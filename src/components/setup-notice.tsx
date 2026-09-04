export function SetupNotice() {
  return (
    <div className="animate-fade mb-8 rounded-card border border-dashed border-accent bg-accent-soft/40 p-5 text-sm">
      <p className="font-medium">Falta conectar Supabase.</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
        <li>
          Crea un proyecto gratis en <span className="font-mono">supabase.com</span>.
        </li>
        <li>
          Copia <span className="font-mono">.env.example</span> a{" "}
          <span className="font-mono">.env.local</span> y pega la URL y la llave publica.
        </li>
        <li>
          Corre <span className="font-mono">supabase/schema.sql</span> (y{" "}
          <span className="font-mono">seed.sql</span> si queres datos de ejemplo) en el SQL Editor.
        </li>
      </ol>
    </div>
  );
}
