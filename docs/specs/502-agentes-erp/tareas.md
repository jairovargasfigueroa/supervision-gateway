# 502 · Agentes en el ERP · tareas de `gateway`

Requisitos y diseño: `docs/specs/502-agentes-erp/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [ ] Agregar los métodos de agentes al cliente `ia.client.ts` de la 402 (`IA_URL`, 3 s, reintento solo en consultas)
- [ ] Enums y tipos de agentes, ejecuciones, hallazgos y sugerencias (code-first)
- [ ] Consultas `agentes`, `ejecucionesAgente`, `ejecucionAgente`, `hallazgos`, `sugerencias`; nombres de `solicitadaPor` y `decididaPor` con la caché de usuarios
- [ ] Campos `Obra.hallazgos` y `Obra.sugerencias` con DataLoader y respuesta parcial
- [ ] Mutaciones `ejecutarAgente`, `aprobarSugerencia`, `rechazarSugerencia` con `extensions.codigo` y `extensions.servicio = "ia"`
- [ ] Pruebas con IA simulada (incluida IA caída)
