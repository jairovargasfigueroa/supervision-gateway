# Gateway: estructura y librerías

Obligatorio para todo el código de este proyecto.

## Librerías

NestJS 12, `@nestjs/graphql` 14 + `@nestjs/apollo` 14 + `@apollo/server` 5 (code-first), `@nestjs/config`, `dataloader` 2, `jose` 6, `fetch` nativo de Node 24. Pruebas: Vitest, `supertest`. Módulos ES con extensión `.js` en los imports.

## Árbol

```
src/
  main.ts
  app.module.ts
  salud/                 salud.resolver.ts
  comun/                 comun.module.ts (@Global: ClienteServicio)
    auth/                jwt.guard.ts (guard global), verificador-token.ts (jose + JWKS: firma, emisor, audiencia), publico.decorator.ts (@Publico: solo salud), roles.guard.ts, roles.decorator.ts, contexto.ts (usuario + token en el contexto GraphQL)
    http/                cliente-servicio.ts (fetch con token, X-Request-Id, timeout 3 s, reintento en consultas), errores.ts (Problem Details → GraphQLError con extensions.codigo), request-id.middleware.ts
    keycloak/            keycloak-admin.cliente.ts (client credentials + caché), usuarios.resolver.ts
    dataloaders/         dataloaders.ts (se crean por petición)
  obras/                 un módulo por área: obras, planillas, materiales, finanzas, tablero (y supervision en capas 4–5)
    obras.cliente.ts     llamadas REST a Obras
    obras.resolver.ts    consultas, mutaciones y @ResolveField
    modelos/             obra.modelo.ts, partida.modelo.ts, ... (@ObjectType)
    entradas/            registrar-obra.entrada.ts (@InputType)
    obras.module.ts
test/
  obras.e2e-spec.ts      GraphQL contra servicios simulados (servidores HTTP de prueba)
  app.e2e-spec.ts        salud, token y reenvío de token y X-Request-Id
  obras.e2e-spec.ts      consulta obras: lista, filtros y Obras caído
  soporte/               tokens-prueba.ts (claves RSA locales en lugar del JWKS de Keycloak)
```

## Reglas

- Sin base de datos ni reglas del negocio: solo arma respuestas desde los servicios.
- Los nombres de tipos y campos siguen exactamente `docs/contratos.md` (el SDL esperado).
- Un `@ResolveField` por dato que viene de otro servicio, para que un fallo afecte solo a ese campo.
- Todo acceso REST pasa por `cliente-servicio.ts`.
- Archivos en `kebab-case` con sufijo (`.resolver.ts`, `.cliente.ts`, `.modelo.ts`, `.entrada.ts`).

## Pruebas

- Unitarias de mapeos y del cliente HTTP (timeout, reintento, errores).
- e2e con servicios simulados: caso feliz, servicio caído, servicio lento (> 3 s).
