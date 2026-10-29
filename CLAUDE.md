# Gateway GraphQL

Gateway GraphQL de la plataforma: la **única** entrada del ERP (BFF). Recibe las consultas y mutaciones del ERP y las resuelve llamando por REST a Obras, Materiales, Finanzas e IA.

Parte de la «Plataforma de supervisión de obras». Si existe `../CLAUDE.md` (carpeta que agrupa todos los proyectos), léelo primero: tiene las reglas transversales, el plan y los contratos generales.

**Estado:** proyecto generado y configurado, sin funcionalidades. Solo existe la consulta técnica `salud`. No implementes una funcionalidad sin su especificación aprobada en `docs/specs/`.

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
npm run test:e2e     # pruebas de punta a punta (consulta { salud })
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
- El esquema GraphQL sigue `docs/contratos/graphql-erp.md` de la carpeta general.

## Documentación

- `docs/estructura.md`: **librerías permitidas y estructura exacta de carpetas y archivos. Obligatorio leerlo antes de escribir código.**
- `docs/app.md`: responsabilidades y qué no hace.
- `docs/contratos.md`: qué consume y qué expone.
- `docs/specs/`: especificaciones por funcionalidad (`requisitos.md`, `diseno.md`, `tareas.md`).

## Commits

Conventional Commits en español e imperativo (`feat(obras): agrega consulta de obras`). Sin coautoría ni firmas de la IA.

Git Flow: ramas `feat/`, `fix/`, `docs/`… desde `develop`, que entran por *pull request*; nunca hagas *push* a `main` ni a `develop` (están protegidas). El usuario crea los PR desde GitHub. Detalle y definición de terminado: `docs/flujo-trabajo.md` del repo `supervision-docs`.
