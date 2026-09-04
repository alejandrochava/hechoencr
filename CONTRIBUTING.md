# Contribuir

Gracias por el interes. El proyecto es abierto y los aportes son bienvenidos.

## Antes de escribir codigo

- Para un cambio chico (un bug, un texto, un estilo): mandá el PR directo.
- Para algo grande (una funcion nueva, un cambio de modelo de datos): abrí
  primero un issue y lo conversamos. Asi nadie trabaja de gusto.

## Como arrancar

Todo el entorno corre en Docker, sin cuenta de Supabase:

```bash
docker compose up -d --build
```

El detalle esta en el [README](README.md).

## Ramas

- `dev` — donde se trabaja. Todos los PR van contra esta rama.
- `main` — estado estable, se actualiza desde `dev`.
- `produccion` — lo que esta publicado. Solo se actualiza desde `main`.

## Antes de mandar el PR

```bash
npm run lint
npm test
npm run build
```

Los tres tienen que pasar; la CI corre lo mismo y bloquea el merge si algo
falla.

## Estilo

- Los componentes visuales heredan del config de Tailwind
  (`src/styles/theme.css`) y de los primitivos en `src/components/ui/`. Si
  necesitas un color o un tamano nuevo, agregalo como token, no como clase
  suelta.
- Comentarios en el codigo: solo donde el "por que" no se deduce leyendo.
- Los mensajes de commit en espanol o ingles, pero claros.

## Que no mandar

- Archivos `.env` ni llaves de ningun tipo.
- Proyectos propios agregados a mano en `seed.sql` — para eso esta el
  formulario de publicar.
