# 010 · Notificaciones · tareas de `gateway`

Requisitos y diseño: `docs/specs/010-notificaciones/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [ ] Módulo `notificaciones/`: `notificaciones.cliente.ts` con `NOTIFICACIONES_URL` (en `.env.example`) por el cliente HTTP común; enumeraciones `TipoNotificacion`, `TipoReferencia`, `PlataformaDispositivo` y tipos `ReferenciaNotificacion`, `Notificacion`, `PaginaNotificaciones`
- [ ] Consultas `notificaciones(soloNoLeidas, limite, antesDe)` y `notificacionesNoLeidas`
- [ ] Mutaciones `marcarNotificacionLeida`, `marcarNotificacionesLeidas`, `registrarDispositivo` (envía `aplicacion: "erp"`) y `darDeBajaDispositivo`; errores con `extensions.codigo` y `extensions.servicio = "notificaciones"`
- [ ] Pruebas de la spec (servicio simulado: caso feliz, servicio caído → `SERVICIO_NO_DISPONIBLE`, `NOTIFICACION_NO_ENCONTRADA`)
