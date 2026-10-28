# Gateway: contratos

**Estado:** el esquema GraphQL completo va en `docs/contratos/graphql-erp.md` de la carpeta general; aquí se copia la parte vigente cuando se defina.

## Expone (GraphQL, al ERP)

Consultas y mutaciones por área: obras, planillas, materiales, finanzas, tablero; en la capa 5, agentes y reportes por voz.

## Consume (REST)

| Servicio | Para qué |
|---|---|
| Obras | Obras, presupuesto, avance, fotos, planillas |
| Materiales | Catálogo, stock, consumos por partida |
| Finanzas | Contratos, saldo, cobros |
| IA (capas 4 y 5) | Predicciones, ejecuciones de agentes, sugerencias, reportes por voz |
