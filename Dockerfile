# syntax=docker/dockerfile:1
# Imagen del gateway (601): dos etapas, sin herramientas de compilación ni configuración.
# Todo (Obras, Materiales, Finanzas, IA, Keycloak, CORS) entra por variables de entorno al arrancar.

FROM node:24.22.0-alpine3.24 AS construir
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
# typescript queda como dependencia opcional (peer) de @nestjs/graphql, que solo la usa en su plugin de
# compilación: se quita para que la imagen final no lleve herramientas de compilación
RUN npm run build && npm prune --omit=dev --no-audit --no-fund && rm -rf node_modules/typescript

FROM node:24.22.0-alpine3.24 AS final
LABEL org.opencontainers.image.source="https://github.com/jairovargasfigueroa/supervision-gateway" \
      org.opencontainers.image.title="supervision-gateway" \
      org.opencontainers.image.description="Gateway GraphQL (BFF) del ERP de la Plataforma de supervisión de obras"
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app
# Archivos de root y solo lectura para el proceso; corre con el usuario sin privilegios de la imagen
COPY --from=construir /app/package.json ./
COPY --from=construir /app/node_modules ./node_modules
COPY --from=construir /app/dist ./dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/salud').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/main.js"]
