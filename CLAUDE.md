# Gateway GraphQL

Gateway GraphQL de la plataforma: la **única** entrada del ERP (BFF). Recibe las consultas y mutaciones del ERP y las resuelve llamando por REST a Obras, Materiales, Finanzas e IA.

Parte de la «Plataforma de supervisión de obras». Si existe `../CLAUDE.md` (carpeta que agrupa todos los proyectos), léelo primero: tiene las reglas transversales, el plan y los contratos generales.

**Estado:** solo documentación. El proyecto del framework todavía no se generó (tarea de la fase 1 del plan general). No implementes una funcionalidad sin su especificación aprobada en `docs/specs/`.

## Stack

- NestJS · TypeScript · GraphQL (Apollo **[por confirmar]**)
- Valida el token de Keycloak y lo reenvía a los servicios
- Puerto: `4000` **[por confirmar]**

## Comandos

Se completan al generar el proyecto.

## Estructura prevista

```
src/
  <area>/            obras, materiales, finanzas, supervision
    *.resolver.ts    consultas y mutaciones de esa área
    *.client.ts      cliente REST del servicio
  auth/              validación del token de Keycloak
  common/            errores, tiempos máximos, registros
```

## Reglas del proyecto

- No tiene base de datos ni reglas del negocio: solo arma respuestas.
- Cada campo que viene de un servicio distinto se resuelve por separado; si un servicio no responde, ese campo devuelve error y el resto sí llega (respuesta parcial).
- Tiempo máximo por llamada a un servicio: pocos segundos **[por definir el valor]**.
- Reenvía el token del usuario; los permisos finos los valida cada servicio.
- El esquema GraphQL sigue `docs/contratos/graphql-erp.md` de la carpeta general.

## Documentación

- `docs/app.md`: qué hace, pantallas o responsabilidades, y qué no hace.
- `docs/contratos.md`: qué consume y qué expone.
- `docs/specs/`: especificaciones por funcionalidad (`requisitos.md`, `diseno.md`, `tareas.md`).

## Commits

Conventional Commits en español e imperativo (`feat(alcance): descripción`). Sin coautoría ni firmas de la IA.
