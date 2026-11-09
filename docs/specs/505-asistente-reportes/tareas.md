# 505 · Asistente de reportes y agentes completos · tareas de `gateway`

Requisitos y diseño: `docs/specs/505-asistente-reportes/` de la carpeta que agrupa los proyectos (aprobada el 09/11/2026).

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] Aplicar «Cambios a contratos y datos» del gateway: `docs/contratos.md` (`RespuestaReporte`, `AclaracionReporte`, `TipoRespuestaReporte`)
- [ ] `consultarReporte(texto, atajo, conversacionId)` devuelve `RespuestaReporte`; reenvía `conversacionId`, quita `receta` de `consulta` y deja pasar `CONVERSACION_NO_ENCONTRADA`
- [ ] Pruebas unitarias y e2e en verde
