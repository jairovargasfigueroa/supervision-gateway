import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

// Tipos de la 502 (docs/contratos.md): mismos nombres que el JSON del servicio de IA.

export enum Agente {
  SEGUIMIENTO_OBRAS = 'SEGUIMIENTO_OBRAS',
  CONTROL_MATERIALES = 'CONTROL_MATERIALES',
  CONTROL_COBROS = 'CONTROL_COBROS',
}
registerEnumType(Agente, { name: 'Agente' });

export enum OrigenEjecucion {
  PROGRAMADA = 'PROGRAMADA',
  MANUAL = 'MANUAL',
}
registerEnumType(OrigenEjecucion, { name: 'OrigenEjecucion' });

export enum EstadoEjecucion {
  EN_CURSO = 'EN_CURSO',
  TERMINADA = 'TERMINADA',
  FALLIDA = 'FALLIDA',
}
registerEnumType(EstadoEjecucion, { name: 'EstadoEjecucion' });

export enum EstadoSugerencia {
  PENDIENTE = 'PENDIENTE',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
}
registerEnumType(EstadoSugerencia, { name: 'EstadoSugerencia' });

export enum Severidad {
  ALTA = 'ALTA',
  MEDIA = 'MEDIA',
  BAJA = 'BAJA',
}
registerEnumType(Severidad, { name: 'Severidad' });

/** Tipos de hallazgo de los tres agentes (cada agente solo usa los suyos). */
export enum TipoHallazgo {
  ATRASO = 'ATRASO',
  RIESGO_DE_ATRASO = 'RIESGO_DE_ATRASO',
  SIN_REGISTRO_DIARIO = 'SIN_REGISTRO_DIARIO',
  PLANILLA_PENDIENTE = 'PLANILLA_PENDIENTE',
  STOCK_BAJO = 'STOCK_BAJO',
  STOCK_JUSTO = 'STOCK_JUSTO',
  CONSUMO_EXCEDIDO = 'CONSUMO_EXCEDIDO',
  SALIDA_SIN_STOCK = 'SALIDA_SIN_STOCK',
  CONSUMO_ATIPICO = 'CONSUMO_ATIPICO',
  COBRO_VENCIDO = 'COBRO_VENCIDO',
  COBRO_POR_VENCER = 'COBRO_POR_VENCER',
  PLANILLA_SIN_RESPUESTA = 'PLANILLA_SIN_RESPUESTA',
  PLANILLA_OBSERVADA_SIN_CORREGIR = 'PLANILLA_OBSERVADA_SIN_CORREGIR',
}
registerEnumType(TipoHallazgo, { name: 'TipoHallazgo' });

/** Acciones de la lista permitida de los tres agentes (aprobar solo registra la decisión). */
export enum AccionSugerida {
  REVISAR_PROGRAMA_OBRA = 'REVISAR_PROGRAMA_OBRA',
  PROGRAMAR_VISITA = 'PROGRAMAR_VISITA',
  SOLICITAR_INFORME_RESIDENTE = 'SOLICITAR_INFORME_RESIDENTE',
  COMPLETAR_DIARIO_OBRA = 'COMPLETAR_DIARIO_OBRA',
  VERIFICAR_INVENTARIO = 'VERIFICAR_INVENTARIO',
  REVISAR_CONSUMO_PARTIDA = 'REVISAR_CONSUMO_PARTIDA',
  EVALUAR_REPOSICION = 'EVALUAR_REPOSICION',
  REVISAR_SALIDAS_SIN_STOCK = 'REVISAR_SALIDAS_SIN_STOCK',
  REVISAR_CONSUMO_ATIPICO = 'REVISAR_CONSUMO_ATIPICO',
  CONTACTAR_CLIENTE_COBRO = 'CONTACTAR_CLIENTE_COBRO',
  RECORDAR_REVISION_PLANILLA = 'RECORDAR_REVISION_PLANILLA',
  CORREGIR_PLANILLA_OBSERVADA = 'CORREGIR_PLANILLA_OBSERVADA',
  REVISAR_SALDO_CONTRATO = 'REVISAR_SALDO_CONTRATO',
}
registerEnumType(AccionSugerida, { name: 'AccionSugerida' });

@ObjectType()
export class EjecucionCorta {
  @Field(() => ID)
  id: string;

  @Field(() => Agente)
  agente: Agente;

  @Field(() => OrigenEjecucion)
  origen: OrigenEjecucion;

  @Field(() => EstadoEjecucion)
  estado: EstadoEjecucion;

  @Field()
  iniciadaEn: string;

  @Field(() => String, { nullable: true })
  terminadaEn: string | null;

  @Field(() => Int)
  cantidadHallazgos: number;
}

/** Tarjeta de un agente (`GET /agentes`). */
@ObjectType()
export class AgenteInfo {
  @Field(() => Agente)
  agente: Agente;

  @Field()
  nombre: string;

  @Field()
  mision: string;

  /** Nombres de las herramientas MCP del agente. */
  @Field(() => [String])
  herramientas: string[];

  @Field(() => EjecucionCorta, { nullable: true })
  ultimaEjecucion: EjecucionCorta | null;

  @Field(() => Int)
  sugerenciasPendientes: number;
}

@ObjectType()
export class ErrorEjecucion {
  @Field()
  codigo: string;

  @Field()
  mensaje: string;
}

/** Un paso de la ejecución: una llamada a una herramienta MCP. */
@ObjectType()
export class PasoEjecucion {
  @Field(() => Int)
  numero: number;

  /** Servidor MCP de la herramienta: `obras`, `materiales`, `finanzas` o `ia`. */
  @Field()
  servidor: string;

  @Field()
  herramienta: string;

  /** JSON de los argumentos, como texto. */
  @Field()
  argumentos: string;

  @Field()
  resultadoResumen: string;

  @Field()
  en: string;

  @Field(() => Int)
  duracionMs: number;

  @Field(() => String, { nullable: true })
  error: string | null;
}

@ObjectType()
export class Evidencia {
  @Field()
  herramienta: string;

  @Field()
  dato: string;
}

@ObjectType()
export class Hallazgo {
  @Field(() => ID)
  ejecucionId: string;

  @Field(() => Agente)
  agente: Agente;

  @Field(() => ID)
  obraId: string;

  @Field()
  obraNombre: string;

  @Field(() => TipoHallazgo)
  tipo: TipoHallazgo;

  @Field(() => Severidad)
  severidad: Severidad;

  @Field()
  situacion: string;

  @Field()
  causaProbable: string;

  @Field(() => [Evidencia])
  evidencia: Evidencia[];

  /** `terminadaEn` de la ejecución que lo encontró. */
  @Field()
  detectadoEn: string;
}

/**
 * Detalle de una ejecución (`GET /ejecuciones/{id}`). `solicitadaPor` (Keycloak) lo resuelve EjecucionAgenteResolver;
 * si Keycloak falla, solo ese campo vuelve null.
 */
@ObjectType()
export class EjecucionAgente {
  @Field(() => ID)
  id: string;

  @Field(() => Agente)
  agente: Agente;

  @Field(() => OrigenEjecucion)
  origen: OrigenEjecucion;

  @Field(() => EstadoEjecucion)
  estado: EstadoEjecucion;

  /** Id de Keycloak que manda IA (null si es programada); se expone como Usuario. */
  solicitadaPor: string | null;

  @Field()
  iniciadaEn: string;

  @Field(() => String, { nullable: true })
  terminadaEn: string | null;

  /** `ollama` o `anthropic`. */
  @Field()
  proveedorLlm: string;

  @Field()
  modelo: string;

  @Field(() => String, { nullable: true })
  resumen: string | null;

  @Field(() => ErrorEjecucion, { nullable: true })
  error: ErrorEjecucion | null;

  @Field(() => [PasoEjecucion])
  pasos: PasoEjecucion[];

  @Field(() => [Hallazgo])
  hallazgos: Hallazgo[];
}

/** Sugerencia de un agente. `decididaPor` (Keycloak) lo resuelve SugerenciaResolver. */
@ObjectType()
export class Sugerencia {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  ejecucionId: string;

  @Field(() => Agente)
  agente: Agente;

  @Field(() => ID)
  obraId: string;

  @Field()
  obraNombre: string;

  @Field(() => AccionSugerida)
  accion: AccionSugerida;

  /** Texto de la acción que ve la persona. */
  @Field()
  accionTexto: string;

  @Field()
  descripcion: string;

  @Field(() => EstadoSugerencia)
  estado: EstadoSugerencia;

  @Field()
  creadaEn: string;

  /** Id de Keycloak que manda IA (null mientras está PENDIENTE); se expone como Usuario. */
  decididaPor: string | null;

  @Field(() => String, { nullable: true })
  decididaEn: string | null;

  /** Comentario al aprobar o motivo al rechazar. */
  @Field(() => String, { nullable: true })
  comentario: string | null;
}
