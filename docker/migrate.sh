#!/bin/sh
set -e

export PGPASSWORD="$POSTGRES_PASSWORD"
PSQL="psql -v ON_ERROR_STOP=1 -h db -U postgres -d postgres"

echo "esperando a Postgres..."
until pg_isready -h db -U postgres -q; do sleep 1; done

# GoTrue crea auth.users en su primer arranque; nuestro esquema depende de esa
# tabla, asi que hay que esperarla antes de aplicar nada.
echo "esperando a que GoTrue migre auth.users..."
until $PSQL -tAc "select to_regclass('auth.users') is not null" | grep -q t; do sleep 2; done

echo "aplicando schema.sql"
$PSQL -f /sql/schema.sql

echo "aplicando grants.sql"
$PSQL -f /grants.sql

if [ "$SEED_DEMO_DATA" = "true" ]; then
  echo "aplicando seed.sql"
  $PSQL -f /sql/seed.sql
fi

# PostgREST cachea el esquema al arrancar: sin esto, una columna nueva
# es invisible para la API hasta reiniciar el contenedor.
$PSQL -c "notify pgrst, 'reload schema'" >/dev/null

echo "listo"
