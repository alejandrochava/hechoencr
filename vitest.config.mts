import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      /*
       * "server-only" existe para reventar si un modulo del servidor se importa
       * desde el navegador, y en vitest se comporta como el navegador: sin esto,
       * probar link-check.ts o preview.ts falla al cargarlos.
       *
       * El propio paquete trae el modulo vacio que usa Next bajo la condicion
       * react-server; se apunta ahi en vez de agregar esa condicion a todo,
       * que cambiaria como resuelven React y las demas dependencias.
       */
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
});
