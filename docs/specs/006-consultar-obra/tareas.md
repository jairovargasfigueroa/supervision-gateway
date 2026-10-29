# 006 · Consultar obra · tareas de `gateway`

Requisitos y diseño: `docs/specs/006-consultar-obra/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] `obras(estado, busqueda)` y `obra(id)` completos con DataLoader por petición
- [x] Campos `finanzas` y `cobros` (Finanzas, null sin error para roles sin acceso) y nombres de usuarios con caché de 5 min
- [ ] `materialComparado(periodo)`: une Obras + Materiales, calcula `diferencia` y `excedido`
- [ ] Respuesta parcial con `SERVICIO_NO_DISPONIBLE` y tiempo máximo de 3 s; pruebas con servicio lento
