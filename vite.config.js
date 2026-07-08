import { defineConfig } from 'vite';

export default defineConfig({
  // Usamos ruta relativa './' para que sea portable en GitHub Pages bajo cualquier subdirectorio
  base: './',
  server: {
    port: 3000
  }
});
