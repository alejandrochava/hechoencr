import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera un servidor minimo en .next/standalone para la imagen de Docker.
  output: "standalone",
  // Next genera archivos de instrucciones para agentes en la raiz; no los queremos.
  agentRules: false,
};

export default nextConfig;
