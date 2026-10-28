# 601 · Contenedores y CI/CD · tareas de `gateway`

Requisitos y diseño: `docs/specs/601-contenedores-ci/` de la carpeta que agrupa los proyectos. Contratos: `docs/contratos.md` de este proyecto.

Marca cada tarea al terminarla (con sus pruebas y su commit).

- [ ] Variables con valores de desarrollo por defecto: las del contrato (`OBRAS_URL`, `MATERIALES_URL`, `FINANZAS_URL`, `KEYCLOAK_URL`, `KEYCLOAK_GATEWAY_CLIENT_ID`, `KEYCLOAK_GATEWAY_CLIENT_SECRET`), `IA_URL` (402) y las propuestas `KEYCLOAK_REALM`, `AUDIENCIA`, `CORS_ORIGENES`
- [ ] `Dockerfile` (`node:24-alpine` en dos etapas, usuario `node`) y `.dockerignore`
- [ ] `.github/workflows/ci-cd.yml`: lint, pruebas, e2e y build; imagen en GHCR; despliegue con `az containerapp update` por OIDC
- [ ] Comprobar: `{ salud }` responde dentro del contenedor
