# 002 · Registrar obra · tareas de `gateway`

Requisitos y diseño: `docs/specs/002-registrar-obra/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [x] Cliente de Keycloak con el cliente `gateway` (token por *client credentials* con caché) y consulta `usuarios(rol)`
- [ ] Clientes REST de Obras con reenvío de token y `X-Request-Id`; traducción de Problem Details a `extensions.codigo`
- [ ] Tipos `Obra`, `Partida`, `ContratoObra`, `Insumo`, entradas de registro y mutación `registrarObra`; consulta `obra(id)` básica
- [ ] Pruebas de la mutación y del mapeo de errores
