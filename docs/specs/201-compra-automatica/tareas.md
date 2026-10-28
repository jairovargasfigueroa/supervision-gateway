# 201 · Compra automática por stock bajo · tareas de `gateway`

Requisitos y diseño: `docs/specs/201-compra-automatica/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [ ] Tipos `Proveedor`, `CuentaPorPagar`, `OrdenCompra`, enumeración `EstadoOrdenCompra`; consultas `proveedores` y `ordenesCompra` (admin, gerente) con Finanzas
- [ ] `OrdenCompra.obraNombre` y `OrdenCompra.material` con *DataLoader*
- [ ] `Material.proveedorHabitualId`, `Material.proveedorHabitual` y `MaterialEntrada.proveedorHabitualId`
- [ ] Pruebas de la spec
