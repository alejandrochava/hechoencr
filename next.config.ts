import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera un servidor minimo en .next/standalone para la imagen de Docker.
  //
  // En Vercel no: su constructor arma el servidor por su cuenta y espera los
  // archivos de rastreo (`.next/*.nft.json`) donde los deja un build normal.
  // Con `standalone` quedan adentro de esa carpeta y el despliegue muere con
  // `ENOENT: .next/next-server.js.nft.json`. Vercel define VERCEL=1 al construir.
  output: process.env.VERCEL ? undefined : "standalone",
  // Next genera archivos de instrucciones para agentes en la raiz; no los queremos.
  agentRules: false,
};

export default nextConfig;
