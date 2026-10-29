# Gateway GraphQL

Gateway GraphQL de la plataforma: la **única** entrada del ERP (BFF). Recibe las consultas y mutaciones del ERP y las resuelve llamando por REST a Obras, Materiales, Finanzas e IA.

Parte de la «Plataforma de supervisión de obras». Si existe `../CLAUDE.md` (carpeta que agrupa todos los proyectos), léelo primero: tiene las reglas transversales, el plan y los contratos generales.

**Estado:** fase 1. Valida el token de Keycloak (guard global), reenvía token y `X-Request-Id` con tiempo máximo de 3 s (`comun/`). Consultas: `salud` (sin token), `usuarios(rol)` (002), `obras(estado, busqueda)` y `obra(id)` completos (006: asignaciones con caché de 5 min, `Insumo.material`, `finanzas` y `cobros` solo para `admin` y `gerente`, `materialComparado(periodo)` y `fotos` de la 005, con DataLoader por petición y respuesta parcial). Planillas (007): `Obra.planillas`, `planilla(id)` y mutaciones `crearPlanilla`, `guardarPlanilla` y `presentarPlanilla`. Mutación: `registrarObra` (002). Materiales (003): consultas `materiales` (paginada) y `stockObra`, mutaciones `crearMaterial`, `actualizarMaterial` y `definirStockMinimo`. No implementes una funcionalidad sin su especificación aprobada en `docs/specs/`.

## Stack

- Node 24 · NestJS 12 · TypeScript (módulos ES: imports con extensión `.js`)
- `@nestjs/graphql` 14 + `@nestjs/apollo` 14 + Apollo Server 5, esquema **code-first** (se genera desde los resolvers)
- `@nestjs/config` para variables de entorno
- Pruebas con Vitest · lint con oxlint · formato con Prettier
- Puerto: `4000` (`PORT`); GraphQL en `/graphql`

## Comandos

```sh
npm install
npm run start:dev    # levantar en modo desarrollo
npm test             # pruebas unitarias
npm run test:e2e     # pruebas de punta a punta (salud, token, reenvío a un servicio simulado)
npm run lint
npm run build
```

Configuración local: copiar `.env.example` a `.env`. **`.env` nunca se sube.**

## Estructura

```
src/
  main.ts
  app.module.ts       ConfigModule + GraphQLModule (Apollo, code-first)
  salud/              consulta técnica { salud }
  <area>/             (previsto) obras, materiales, finanzas, supervision
    *.resolver.ts     consultas y mutaciones de esa área
    *.client.ts       cliente REST del servicio
  auth/               (previsto) validación del token de Keycloak
  common/             (previsto) errores, tiempos máximos, registros
```

## Reglas del proyecto

- No tiene base de datos ni reglas del negocio: solo arma respuestas.
- Cada campo que viene de un servicio distinto se resuelve por separado; si un servicio no responde, ese campo devuelve error y el resto sí llega (respuesta parcial).
- Tiempo máximo por llamada a un servicio: 3 segundos. Las consultas se reintentan una vez; las mutaciones no (ver `docs/convenciones.md` de la carpeta general).
- Reenvía el token del usuario; los permisos finos los valida cada servicio.
- Seguridad (convenciones): profundidad 8 y complejidad 1000 por consulta, 120 peticiones por minuto por usuario (`429 DEMASIADAS_PETICIONES` con `Retry-After`), introspección y Apollo Sandbox solo fuera de producción, JSON de hasta 1 MB, `nosniff` y `no-referrer`. Si Keycloak no responde al pedir el JWKS: `SERVICIO_NO_DISPONIBLE` (servicio `keycloak`).
- El esquema GraphQL sigue `docs/contratos/graphql-erp.md` de la carpeta general.

## Documentación

- `docs/estructura.md`: **librerías permitidas y estructura exacta de carpetas y archivos. Obligatorio leerlo antes de escribir código.**
- `docs/app.md`: responsabilidades y qué no hace.
- `docs/contratos.md`: qué consume y qué expone.
- `docs/specs/`: especificaciones por funcionalidad (`requisitos.md`, `diseno.md`, `tareas.md`).

## Commits

Conventional Commits en español e imperativo (`feat(obras): agrega consulta de obras`). Sin coautoría ni firmas de la IA.

Git Flow: ramas `feat/`, `fix/`, `docs/`… desde `develop`, que entran por *pull request*; nunca hagas *push* a `main` ni a `develop` (están protegidas). El agente crea y fusiona los PR (merge normal, sin squash) hacia `develop` cuando todas las pruebas pasan. Detalle y definición de terminado: `docs/flujo-trabajo.md` del repo `supervision-docs`.
