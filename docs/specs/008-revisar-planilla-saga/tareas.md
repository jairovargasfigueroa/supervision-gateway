# 008 · Revisar planilla y saga · tareas de `gateway`

Requisitos y diseño: `docs/specs/008-revisar-planilla-saga/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] Campo `Planilla.cobro` (`CobroPlanilla`): `id` y `numero` desde Obras (`cobroId`, `cobroNumero`); `montoNeto`, `emitidoEn`, `venceEn` y `estado` con `GET /cobros/{id}` de Finanzas solo para `admin` y `gerente` (`null` sin error para `residente`); pruebas por rol
