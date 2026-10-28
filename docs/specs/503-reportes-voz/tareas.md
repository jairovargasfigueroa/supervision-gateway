# 503 · Reportes por voz · tareas de `gateway`

Requisitos y diseño: `docs/specs/503-reportes-voz/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [ ] Enums y tipos de reportes por voz (code-first, incluido `avisos`); métodos nuevos en el cliente `ia.client.ts` de la 402
- [ ] Consultas `reportesVozDisponibles` y `consultasVoz` (3 s, un reintento)
- [ ] Mutación `consultarReporteVoz` con tiempo máximo de 60 s y sin reintento; errores con `extensions.codigo`
- [ ] Pruebas con IA simulada (respuesta normal, `INTENCION_NO_RECONOCIDA`, IA lenta)
