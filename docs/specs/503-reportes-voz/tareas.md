# 503 · Reportes por voz · tareas de `gateway`

Requisitos y diseño: `docs/specs/503-reportes-voz/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] Enums y tipos del constructor de reportes (code-first: `ConjuntoReporte`, `AtajoReporte`, `TipoColumna`, `ResultadoConsultaReporte`, `ColumnaReporte`, `ElementoAplicado`, `ConsultaReporte` con `avisos`, `ConsultaReporteCorta`, `ConjuntoDisponible`, `AtajoDisponible` y `CatalogoReportes`); métodos nuevos en el cliente `ia.cliente.ts` de la 402 (`GET /catalogo-reportes`, `GET /consultas-reporte`, `POST /consultas-reporte`)
- [ ] Consultas `catalogoReportes` y `consultasReporte(limite)` (3 s, un reintento)
- [ ] Mutación `consultarReporte(texto, atajo)`: exactamente uno de los dos (si no, `DATOS_INVALIDOS` sin llamar a IA); `directorio.clientes` desde la caché de Keycloak (usuarios con rol `cliente`; si Keycloak falla, se envía sin directorio); tiempo máximo de 60 s y sin reintento; errores con `extensions.codigo` (y `extensions.errores` en `RECETA_INVALIDA`)
- [ ] Pruebas con IA simulada (respuesta normal, atajo, `INTENCION_NO_RECONOCIDA`, `RECETA_INVALIDA` con `errores`, `texto` y `atajo` a la vez, directorio y Keycloak caído, IA lenta)
