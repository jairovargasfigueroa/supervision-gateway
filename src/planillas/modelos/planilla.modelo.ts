import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
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

/** Detalle de `GET /planillas/{id}`. `cobro` (CobroPlanilla) llega con la 008. */
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

  @Field(() => String, { nullable: true })
  observacion: string | null;

  @Field(() => [ID])
  fotoIds: string[];
}
