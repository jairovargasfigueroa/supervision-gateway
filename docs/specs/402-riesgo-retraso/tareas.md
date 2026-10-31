# 402 · Riesgo de retraso · tareas de `gateway`

Requisitos y diseño: `docs/specs/402-riesgo-retraso/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] Cliente REST del servicio de IA (`IA_URL`, 3 s, un reintento en consultas, errores con `extensions.servicio = "ia"`); variable en `.env.example`
- [ ] Tipos de riesgo; `FilaTablero.riesgoRetraso` e `IndicadoresTablero.obrasRiesgoAlto` con lotes de hasta 100 `obraId` a `GET /predicciones`; `SIN_DATOS` para obras sin predicción; pruebas
- [ ] `Obra.riesgoRetraso`, `Obra.historialRiesgo` y `Query.modeloRiesgo`; respuesta parcial con IA caída (servidor simulado que tarda más de 3 s); pruebas
