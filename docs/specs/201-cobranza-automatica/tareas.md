# 201 · Cobranza automática · tareas de `gateway`

Requisitos y diseño: `docs/specs/201-cobranza-automatica/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] Aplicar «Cambios a contratos y datos» que tocan este proyecto (`docs/contratos.md`)
- [ ] Esquema: `PAGADO` en `EstadoCobro`; `Cobro.pagadoEn`, `Cobro.comprobante` y `Cobro.envios` (`EnvioCobro`, `TipoEnvioCobro`)
- [ ] Mutación `registrarPagoCobro` → Finanzas `POST /cobros/{id}/pago` con el token del usuario; errores `COBRO_YA_PAGADO`, `FECHA_PAGO_INVALIDA` y `COBRO_NO_ENCONTRADO` con su `codigo`
- [ ] Pruebas unitarias y e2e (mapeo de campos nuevos, mutación por rol, errores)
