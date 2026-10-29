# Gateway: contratos

Fuente para este proyecto. La copia general está en `docs/contratos/graphql-erp.md` de la carpeta que agrupa los proyectos.

## Expone: esquema GraphQL del ERP (sistema base)

El esquema se escribe **code-first** en NestJS; este SDL es el resultado esperado. Los nombres coinciden con los JSON de los servicios. Fechas como `String` ISO; montos y cantidades como `Float`.

```graphql
enum Rol { admin residente gerente maestro almacenero cliente }
enum EstadoObra { SIN_CONTRATO EN_EJECUCION CONCLUIDA }
enum EstadoPlanilla { BORRADOR PRESENTADA APROBANDO APROBADA OBSERVADA }
enum EstadoStock { BAJO JUSTO OK }
enum EstadoCobro { PENDIENTE VENCIDO }
enum TipoMaterial { CEMENTO ACERO AGREGADO LADRILLO MADERA ELECTRICO SANITARIO PINTURA OTRO }

type Usuario { id: ID! nombre: String! correo: String }

type ObraResumen {
  id: ID! nombre: String! ubicacion: String! estado: EstadoObra! fechaInicio: String!
  avancePct: Float! plazoPct: Float! enRiesgo: Boolean!
  ultimaPlanilla: PlanillaCorta
}
type PlanillaCorta { periodo: String! estado: EstadoPlanilla! }

type Obra {
  id: ID! nombre: String! ubicacion: String! estado: EstadoObra! fechaInicio: String!
  motivoRechazoContrato: String
  residente: Usuario  maestro: Usuario  almacenero: Usuario  cliente: Usuario
  contrato: ContratoObra!
  avancePct: Float! plazoPct: Float! enRiesgo: Boolean!
  partidas: [Partida!]!
  finanzas: FinanzasObra            # Finanzas; null sin error si el rol no es admin ni gerente
  materialComparado(periodo: String!): ComparacionMaterial   # Obras + Materiales
  fotos(partidaId: ID, pagina: Int = 1, tamano: Int = 50): FotosPagina!
  planillas: [PlanillaResumen!]!
  cobros: [Cobro!]                  # Finanzas (pide tamano=100); null sin error si el rol no es admin ni gerente
}
type ContratoObra { contratoId: ID monto: Float! plazoDias: Int! anticipoPct: Float! retencionPct: Float! }
type Partida {
  id: ID! codigo: String! nombre: String! unidad: String!
  cantidadContratada: Float! precioUnitario: Float! meses: String
  ejecutadaAcumulada: Float! avancePct: Float!
  insumos: [Insumo!]!
}
type Insumo { material: Material  materialId: ID! cantidadPorUnidad: Float! }
type FinanzasObra { saldoDisponible: Float! totalCobrado: Float! totalReservado: Float! }

type ComparacionMaterial { periodo: String! hayPlanilla: Boolean! filas: [FilaComparacion!]! }
type FilaComparacion {
  partidaId: ID! partidaCodigo: String! material: Material!
  previsto: Float! usado: Float! diferencia: Float! excedido: Boolean!
}

type FotosPagina { items: [Foto!]! total: Int! pagina: Int! tamano: Int! }
type Foto { id: ID! partidaId: ID! registradoPor: Usuario registradoEn: String! publicadaCliente: Boolean! urlDescarga: String! }

type PlanillaResumen { id: ID! numero: Int! periodo: String! estado: EstadoPlanilla! neto: Float! cobroNumero: String }   # cobroNumero: 008, de Obras
type Planilla {
  id: ID! obraId: ID! numero: Int! periodo: String! estado: EstadoPlanilla! version: Int!
  lineas: [LineaPlanilla!]!
  subtotal: Float! descuentoAnticipo: Float! retencion: Float! neto: Float!
  anticipoPct: Float! retencionPct: Float!
  observacion: String
  cobro: CobroPlanilla              # 008 · id y numero de Obras; el resto de Finanzas, solo para admin y gerente
  fotoIds: [ID!]!
}
type LineaPlanilla {
  partidaId: ID! codigo: String! nombre: String! unidad: String! precioUnitario: Float!
  cantidadContratada: Float! acumuladoAnterior: Float! cantidadPeriodo: Float!
  acumuladoTotal: Float! saldo: Float! monto: Float!
}

type Atributo { nombre: String! valor: String! }
type MaterialesPagina { items: [Material!]! total: Int! pagina: Int! tamano: Int! }
type Material {
  id: ID! codigo: String! nombre: String! tipo: TipoMaterial! unidad: String! unidadPlural: String!
  precioReferencial: Float! activo: Boolean! atributos: [Atributo!]!
}
type StockMaterial {
  materialId: ID! codigo: String! nombre: String! unidad: String! unidadPlural: String!
  cantidad: Float! minimo: Float! estado: EstadoStock!
}

type Cobro { id: ID! numero: String! planillaId: ID! montoNeto: Float! emitidoEn: String! venceEn: String! estado: EstadoCobro! }
type CobroPlanilla { id: ID! numero: String! montoNeto: Float emitidoEn: String venceEn: String estado: EstadoCobro }   # 008 · id y numero: Obras; el resto: Finanzas, null sin error si el rol no es admin ni gerente

type Tablero { indicadores: IndicadoresTablero obras: [FilaTablero!] }
type IndicadoresTablero {
  obrasEnEjecucion: Int  obrasEnRiesgo: Int  materialesBajos: Int
  cobrosVencidos: ResumenMonto       # null sin error si el rol no es admin ni gerente
}
type ResumenMonto { cantidad: Int! monto: Float! }
type FilaTablero {
  obraId: ID! nombre: String! avancePct: Float! plazoPct: Float! diferencia: Float! enRiesgo: Boolean!
  materialesBajos: Int               # Materiales; null si no responde
  ultimaPlanilla: PlanillaCorta
}

input AsignacionesEntrada { residenteId: ID! maestroId: ID! almaceneroId: ID! clienteId: ID! }
input ContratoEntrada { monto: Float! plazoDias: Int! anticipoPct: Float! retencionPct: Float! firmadoEn: String! }
input InsumoEntrada { materialId: ID! cantidadPorUnidad: Float! }
input PartidaEntrada {
  codigo: String! nombre: String! unidad: String! cantidadContratada: Float! precioUnitario: Float!
  meses: String insumos: [InsumoEntrada!]
}
input RegistrarObraEntrada {
  nombre: String! ubicacion: String! fechaInicio: String!
  asignaciones: AsignacionesEntrada! contrato: ContratoEntrada! partidas: [PartidaEntrada!]!
}
input AtributoEntrada { nombre: String! valor: String! }
input MaterialEntrada {
  codigo: String! nombre: String! tipo: TipoMaterial! unidad: String! unidadPlural: String!
  precioReferencial: Float! activo: Boolean atributos: [AtributoEntrada!]
}
input LineaEntrada { partidaId: ID! cantidadPeriodo: Float! }
input GuardarPlanillaEntrada { version: Int! lineas: [LineaEntrada!]! fotoIds: [ID!]! }

type Query {
  salud: String!                                                    # fase 1 · sin token
  usuarios(rol: Rol!): [Usuario!]!                                   # 002 · admin
  obras(estado: EstadoObra, busqueda: String): [ObraResumen!]!       # 006 · admin, gerente, residente (sus obras)
  obra(id: ID!): Obra                                                # 006 · admin, gerente, residente (sus obras; si no la ve: 404 OBRA_NO_ENCONTRADA)
  planilla(id: ID!): Planilla                                        # 007 · admin, gerente, residente (sus obras)
  materiales(busqueda: String, soloActivos: Boolean, pagina: Int = 1, tamano: Int = 20): MaterialesPagina!   # 003 · admin, gerente, residente
  stockObra(obraId: ID!): [StockMaterial!]!                          # 003 · admin, gerente, residente (sus obras)
  tablero: Tablero!                                                  # 009 · admin, gerente, residente (sus obras)
}

type Mutation {
  registrarObra(entrada: RegistrarObraEntrada!): Obra!                       # 002 · admin
  crearMaterial(entrada: MaterialEntrada!): Material!                        # 003 · admin
  actualizarMaterial(id: ID!, entrada: MaterialEntrada!): Material!          # 003 · admin
  definirStockMinimo(obraId: ID!, materialId: ID!, minimo: Float!): StockMaterial!  # 003 · admin
  crearPlanilla(obraId: ID!, periodo: String!): Planilla!                    # 007 · residente asignado
  guardarPlanilla(id: ID!, entrada: GuardarPlanillaEntrada!): Planilla!      # 007 · residente asignado
  presentarPlanilla(id: ID!, version: Int!): Planilla!                       # 007 · residente asignado
}
```

### Cómo se resuelven los campos de `Obra` (006)

- `residente`, `maestro`, `almacenero`, `cliente` y `Foto.registradoPor`: Keycloak (`GET /admin/realms/supervision/users/{id}`), con caché en memoria de 5 minutos por usuario (no se guardan los desconocidos ni los errores) y DataLoader por petición.
- `Insumo.material` y `FilaComparacion.material`: catálogo de Materiales (`GET /materiales`, de a 100 y todas las páginas, activos e inactivos), pedido una sola vez por petición.
- `finanzas`: `GET /contratos?obraId=`; `null` sin error si el rol efectivo no es `admin` ni `gerente` (no se llama a Finanzas) o si la obra todavía no tiene contrato en Finanzas.
- `cobros`: `GET /cobros?obraId=&tamano=100` (solo la primera página); `null` sin error si el rol efectivo no es `admin` ni `gerente`.
- `materialComparado(periodo)`: `GET /obras/{id}/material-previsto?periodo=` (Obras) + `GET /obras/{id}/consumos?periodo=` (Materiales) + catálogo. Una fila por cada par partida–material que aparece en el previsto o en los consumos (lo que falta de un lado cuenta 0). `diferencia = usado − previsto` (positiva: se usó más de lo previsto); `excedido = usado > 1,20 × previsto` (calculado en milésimas, sin errores de redondeo; con previsto 0, cualquier uso queda excedido). Orden: el de las partidas de la obra y, dentro de cada una, por código de material. Si Obras o Materiales falla, el campo vuelve `null` con el error de ese servicio.
- `planillas`: todavía no se expone; llega con la 007, cuando Obras tenga `GET /obras/{id}/planillas`.

Las capas 4 y 5 agregan tipos y campos (predicciones, agentes, sugerencias, reportes por voz) en sus especificaciones.

## Consume (REST)

| Servicio | Endpoints |
|---|---|
| Obras | `GET /obras`, `GET /obras/{id}`, `GET /obras/{id}/material-previsto`, `GET /obras/{id}/fotos`, `GET /obras/{id}/planillas`, `GET /planillas/{id}`, `POST /obras`, `POST /obras/{id}/planillas`, `PUT /planillas/{id}`, `POST /planillas/{id}/presentar` |
| Materiales | `GET /materiales`, `POST /materiales`, `PUT /materiales/{id}`, `GET /obras/{id}/stock`, `PUT /obras/{id}/stock/{materialId}/minimo`, `GET /obras/{id}/consumos`, `GET /stock/resumen` |
| Finanzas | `GET /contratos`, `GET /cobros`, `GET /cobros/{id}`, `GET /cobros/resumen` |
| Keycloak (cliente `gateway`) | `GET /admin/realms/supervision/roles/{rol}/users`, `GET /admin/realms/supervision/users/{id}` |
| IA (capas 4 y 5) | se definen en sus especificaciones |

URLs base por variables de entorno: `OBRAS_URL`, `MATERIALES_URL`, `FINANZAS_URL`, `KEYCLOAK_URL`, `KEYCLOAK_GATEWAY_CLIENT_ID`, `KEYCLOAK_GATEWAY_CLIENT_SECRET`.
