import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { PlanillaCorta } from '../../obras/modelos/obra-resumen.modelo.js';

// Tipos de la 009 (docs/contratos.md). Cada campo que viene de un servicio lo resuelve un @ResolveField, así que un
// servicio caído solo deja en null sus campos.

@ObjectType()
export class ResumenMonto {
  @Field(() => Int)
  cantidad: number;

  @Field(() => Float)
  monto: number;
}

/** Los cuatro indicadores; cada uno se resuelve por separado (Obras, Materiales o Finanzas). */
@ObjectType()
export class IndicadoresTablero {}

/** Fila de la tabla: una obra EN_EJECUCION que el usuario ve. `materialesBajos` lo resuelve Materiales. */
@ObjectType()
export class FilaTablero {
  @Field(() => ID)
  obraId: string;

  @Field()
  nombre: string;

  @Field(() => Float)
  avancePct: number;

  @Field(() => Float)
  plazoPct: number;

  /** plazoPct − avancePct (positiva: va atrasada). */
  @Field(() => Float)
  diferencia: number;

  @Field()
  enRiesgo: boolean;

  @Field(() => PlanillaCorta, { nullable: true })
  ultimaPlanilla: PlanillaCorta | null;
}

@ObjectType()
export class Tablero {}
