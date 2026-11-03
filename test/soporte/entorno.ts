/**
 * Variables de las pruebas e2e (601): el código ya no tiene direcciones por defecto, así que aquí se
 * fijan las de desarrollo para las que una prueba no reemplaza con su servicio simulado. Corre antes
 * de cada archivo (`setupFiles`) y no pisa lo que ya venga del entorno.
 */
const PRUEBAS: Record<string, string> = {
  OBRAS_URL: 'http://localhost:8081',
  MATERIALES_URL: 'http://localhost:8082',
  FINANZAS_URL: 'http://localhost:8083',
  IA_URL: 'http://localhost:8085',
  KEYCLOAK_URL: 'http://localhost:8080',
};

for (const [nombre, valor] of Object.entries(PRUEBAS)) {
  process.env[nombre] ??= valor;
}
