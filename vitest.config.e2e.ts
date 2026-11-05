import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Direcciones de desarrollo para las que no simula cada prueba (601: el código no tiene valores por defecto)
    setupFiles: ['./test/soporte/entorno.ts'],
  },
});
