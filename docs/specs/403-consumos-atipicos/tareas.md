# 403 · Consumos atípicos · tareas de `gateway`

Requisitos y diseño: `docs/specs/403-consumos-atipicos/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto. Usa el cliente REST de IA de la 402.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] Tipo `ConsumoAtipico` con `material` (Materiales) y `revisadoPor` (Keycloak); campo `Obra.consumosAtipicos(estado)`; pruebas
- [ ] `FilaTablero.consumosAtipicosPendientes` e `IndicadoresTablero.consumosAtipicosPendientes` con lotes de hasta 100 `obraId` a `GET /consumos-atipicos/resumen`; respuesta parcial con IA caída; pruebas
- [ ] Mutación `revisarConsumoAtipico` sin reintento y con mapeo de errores; pruebas
