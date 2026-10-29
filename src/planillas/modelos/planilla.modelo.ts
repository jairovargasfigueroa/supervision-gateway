import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { EstadoCobro } from '../../finanzas/modelos/cobro.modelo.js';
import { EstadoPlanilla } from '../../obras/modelos/obra-resumen.modelo.js';

// Tipos de la 007 (docs/contratos.md): mismos nombres que el JSON de Obras. Los cálculos (montos, saldo, totales) los
// hace Obras; el gateway los devuelve tal cual.

/** Elemento de `GET /obras/{obraId}/planillas`. */
@ObjectType()
export class PlanillaResumen {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  numero: number;

  @Field()
  periodo: string;

  @Field(() => EstadoPlanilla)
  estado: EstadoPlanilla;

  @Field(() => Float)
  neto: number;

  /** Número del cobro (`COB-AAAA-NNNN`) que Obras guarda al recibir CobroEmitido (008); null hasta que se aprueba. */
  @Field(() => String, { nullable: true })
  cobroNumero: string | null;
}

/** Una línea por partida de la obra. */
@ObjectType()
export class LineaPlanilla {
  @Field(() => ID)
  partidaId: string;

  @Field()
  codigo: string;

  @Field()
  nombre: string;

  @Field()
  unidad: string;

  @Field(() => Float)
  precioUnitario: number;

  @Field(() => Float)
  cantidadContratada: number;

  @Field(() => Float)
  acumuladoAnterior: number;

  @Field(() => Float)
  cantidadPeriodo: number;

  @Field(() => Float)
  acumuladoTotal: number;

  @Field(() => Float)
  saldo: number;

  @Field(() => Float)
  monto: number;
}

/**
 * Cobro de una planilla aprobada (008). `id` y `numero` salen de Obras (`cobroId`, `cobroNumero`) para todos los que
 * ven la planilla; el resto lo da Finanzas (`GET /cobros/{id}`) solo para admin y gerente (null sin error para otros).
 */
@ObjectType()
export class CobroPlanilla {
  @Field(() => ID)
  id: string;

  @Field()
  numero: string;

  @Field(() => Float, { nullable: true })
  montoNeto?: number | null;

  @Field(() => String, { nullable: true })
  emitidoEn?: string | null;

  @Field(() => String, { nullable: true })
  venceEn?: string | null;

  @Field(() => EstadoCobro, { nullable: true })
  estado?: EstadoCobro | null;
}

/** Detalle de `GET /planillas/{id}`. */
@ObjectType()
export class Planilla {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  obraId: string;

  @Field(() => Int)
  numero: number;

  @Field()
  periodo: string;

  @Field(() => EstadoPlanilla)
  estado: EstadoPlanilla;

  /** Bloqueo optimista: se manda en guardarPlanilla y presentarPlanilla. */
  @Field(() => Int)
  version: number;

  @Field(() => [LineaPlanilla])
  lineas: LineaPlanilla[];

  @Field(() => Float)
  subtotal: number;

  @Field(() => Float)
  descuentoAnticipo: number;

  @Field(() => Float)
  retencion: number;

  @Field(() => Float)
  neto: number;

  @Field(() => Float)
  anticipoPct: number;

  @Field(() => Float)
  retencionPct: number;

  /** Observación del cliente o motivo del fallo de la saga (008); null si no tiene. */
  @Field(() => String, { nullable: true })
  observacion: string | null;

  /** 008: lo resuelve PlanillasResolver.cobro desde cobroId y cobroNumero; null hasta que se aprueba. */
  @Field(() => CobroPlanilla, { nullable: true })
  cobro?: CobroPlanilla | null;

  @Field(() => [ID])
  fotoIds: string[];
}
