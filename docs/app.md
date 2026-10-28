# Gateway: qué hace

## Responsabilidades

- Publicar el esquema GraphQL que usa todo el ERP.
- Validar el token de Keycloak de cada petición.
- Resolver cada campo llamando por REST al servicio dueño del dato (Obras, Materiales, Finanzas, IA).
- Unir datos de varios servicios en una sola respuesta (por ejemplo, avance de Obras + consumos de Materiales + cobros de Finanzas en el detalle de obra).
- Devolver respuestas parciales y cortar las llamadas lentas.

## Áreas del esquema

| Área | Servicio detrás | Etapa |
|---|---|---|
| Obras, partidas, avance, planillas | Obras | Base |
| Contratos y cobros | Finanzas | Base |
| Catálogo, stock, consumos | Materiales | Base |
| Tablero | Obras, Materiales, Finanzas | Base |
| Agentes, sugerencias, reportes por voz, predicciones | IA | Capas 4 y 5 |

## Qué no hace

- No guarda datos ni aplica reglas del negocio.
- No atiende al portal ni a la app móvil (usan REST directo).
- No participa en la saga ni en la automatización.
