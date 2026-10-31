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
    graphql/             limites.ts (regla de validación: profundidad 8, complejidad 1000)
    auth/                jwt.guard.ts (guard global), verificador-token.ts (jose + JWKS: firma, emisor, audiencia), publico.decorator.ts (@Publico: solo salud), limitador.ts (120 peticiones por minuto por usuario), roles.guard.ts (después del JwtGuard; SIN_PERMISO), roles.decorator.ts (@Roles), roles-efectivos.ts (regla del azp; tieneAlgunRol para campos que dependen del rol), contexto.ts (usuario + token en el contexto GraphQL)
    http/                cliente-servicio.ts (fetch con token, X-Request-Id, timeout 3 s, reintento en consultas), errores.ts (Problem Details → GraphQLError con extensions.codigo), request-id.middleware.ts
    keycloak/            keycloak-admin.cliente.ts (client credentials + caché del token; usuarios por id con caché de 5 min y DataLoader de la petición), usuarios.resolver.ts (usuarios(rol)), usuario.modelo.ts (Usuario y enum Rol)
    dataloaders/         dataloaders.ts (se crean por petición: cargador(contexto, nombre, carga), cadaUno, unaVezPorPeticion)
  obras/                 un módulo por área: obras, planillas, materiales, finanzas, tablero (y supervision en capas 4–5)
    obras.cliente.ts     llamadas REST a Obras (GET /obras, GET /obras/{id}, GET /obras/{id}/material-previsto, GET /obras/{id}/fotos, POST /obras); el módulo exporta ObrasCliente
    obras.resolver.ts    consultas, mutaciones y @ResolveField (asignaciones, fotos)
    fotos.resolver.ts    005: Foto.registradoPor (Keycloak)
    modelos/             obra-resumen.modelo.ts, obra.modelo.ts (Obra, ContratoObra), partida.modelo.ts (Partida, Insumo), foto.modelo.ts (Foto, FotosPagina), ... (@ObjectType)
    entradas/            registrar-obra.entrada.ts (@InputType)
    obras.module.ts
  materiales/            003: materiales.cliente.ts (GET/POST/PUT /materiales, catálogo completo por petición, GET /obras/{id}/stock, PUT .../minimo; 009: GET /stock/resumen?obraIds= en lote con DataLoader), materiales.resolver.ts (materiales, stockObra, crearMaterial, actualizarMaterial, definirStockMinimo)
                         006: insumos.resolver.ts (Insumo.material desde el catálogo), material-comparado.resolver.ts (Obra.materialComparado), comparacion.ts (une previsto y consumos; diferencia y excedido), GET /obras/{id}/consumos
    modelos/             comparacion-material.modelo.ts (ComparacionMaterial, FilaComparacion)
    modelos/             material.modelo.ts (Material, Atributo, MaterialesPagina, enum TipoMaterial), stock-material.modelo.ts (StockMaterial, enum EstadoStock)
    entradas/            material.entrada.ts (MaterialEntrada, AtributoEntrada)
    materiales.module.ts
  planillas/             007: planillas.cliente.ts (GET /obras/{id}/planillas, GET /planillas/{id}, POST /obras/{id}/planillas, PUT /planillas/{id}, POST /planillas/{id}/presentar), planillas.resolver.ts (planilla(id), crearPlanilla, guardarPlanilla, presentarPlanilla y Obra.planillas; 008: Planilla.cobro desde cobroId y cobroNumero, y CobroPlanillaResolver: montoNeto, emitidoEn, venceEn y estado con GET /cobros/{id} solo para admin y gerente)
    modelos/             planilla.modelo.ts (Planilla, LineaPlanilla, PlanillaResumen, CobroPlanilla)
    entradas/            guardar-planilla.entrada.ts (GuardarPlanillaEntrada, LineaEntrada)
    planillas.module.ts  (importa FinanzasModule para el detalle del cobro, 008)
  tablero/               009: obras-tablero.ts (obras EN_EJECUCION una vez por petición; las usa también la 402), tablero.resolver.ts (tablero, Tablero.obras e indicadores, FilaTablero.materialesBajos e IndicadoresTablero), filas.ts (FilaTablero desde ObraResumen; diferencia), tablero.module.ts
    modelos/             tablero.modelo.ts (Tablero, IndicadoresTablero, FilaTablero, ResumenMonto)
  finanzas/              006: finanzas.cliente.ts (GET /contratos?obraId=, GET /cobros?obraId=&tamano=100, con DataLoader; 009: GET /cobros/resumen; 008: GET /cobros/{id} con DataLoader), finanzas.resolver.ts (Obra.finanzas y Obra.cobros: null sin error si el rol no es admin ni gerente)
    modelos/             finanzas-obra.modelo.ts (FinanzasObra), cobro.modelo.ts (Cobro, enum EstadoCobro)
    finanzas.module.ts
  supervision/           capas 4 y 5: ia.cliente.ts (402: GET /predicciones en lotes de 100 con DataLoader, GET /obras/{id}/prediccion, GET /modelos/riesgo-retraso), riesgo.ts (RiesgoRetraso desde IA; SIN_DATOS si falta), riesgo-tablero.resolver.ts (FilaTablero.riesgoRetraso, IndicadoresTablero.obrasRiesgoAlto), supervision.module.ts
    modelos/             riesgo.modelo.ts (NivelRiesgo, FactorRiesgo, RiesgoRetraso, PuntoRiesgo, ModeloRiesgo, ...)
test/
  obras.e2e-spec.ts      GraphQL contra servicios simulados (servidores HTTP de prueba)
  app.e2e-spec.ts        salud, token y reenvío de token y X-Request-Id
  obras.e2e-spec.ts      consulta obras: lista, filtros y Obras caído
  seguridad.e2e-spec.ts  encabezados, profundidad, límite de peticiones y Keycloak caído
  roles.e2e-spec.ts      @Roles: NO_AUTENTICADO, SIN_PERMISO, regla del azp (demo1)
  usuarios.e2e-spec.ts   usuarios(rol) contra un Keycloak simulado
  registrar-obra.e2e-spec.ts  registrarObra y obra(id): reenvío a POST /obras, errores 422 → extensions.codigo, SIN_PERMISO, 404, Keycloak caído
  materiales.e2e-spec.ts materiales, stockObra y mutaciones de la 003 contra un Materiales simulado: filtros y paginación, 409 CODIGO_MATERIAL_REPETIDO → extensions.codigo, 404/422, sin reintento en mutaciones, Materiales caído o lento, SIN_PERMISO
  planillas.e2e-spec.ts  007: Obra.planillas, planilla(id) y mutaciones contra un Obras simulado; 008: Planilla.cobro por rol y con Finanzas caído
  riesgo-retraso.e2e-spec.ts  402: tablero, obra y modelo contra Obras e IA simulados (lotes de 100, SIN_DATOS, IA caído o lento)
  tablero.e2e-spec.ts    009: tablero contra Obras, Materiales y Finanzas simulados (lote a Materiales en una sola llamada, cada servicio caído o lento)
  consultar-obra.e2e-spec.ts  006: obras y obra(id) completos contra Obras, Materiales, Finanzas y Keycloak simulados (DataLoader, respuesta parcial, servicio lento)
  soporte/               tokens-prueba.ts (claves RSA locales en lugar del JWKS de Keycloak), servicio-simulado.ts (servidor REST de prueba con demora configurable)
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
