import { Field, Float, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

// Tipos de docs/contratos.md (SDL esperado): mismos nombres que el JSON de Obras.

export enum EstadoObra {
  SIN_CONTRATO = 'SIN_CONTRATO',
  EN_EJECUCION = 'EN_EJECUCION',
  CONCLUIDA = 'CONCLUIDA',
}
registerEnumType(EstadoObra, { name: 'EstadoObra' });

export enum EstadoPlanilla {
  BORRADOR = 'BORRADOR',
  PRESENTADA = 'PRESENTADA',
  APROBANDO = 'APROBANDO',
  APROBADA = 'APROBADA',
  OBSERVADA = 'OBSERVADA',
}
registerEnumType(EstadoPlanilla, { name: 'EstadoPlanilla' });

@ObjectType()
export class PlanillaCorta {
  @Field()
  periodo: string;

  @Field(() => EstadoPlanilla)
  estado: EstadoPlanilla;
}

@ObjectType()
export class ObraResumen {
  @Field(() => ID)
  id: string;

  @Field()
  nombre: string;

  @Field()
  ubicacion: string;

  @Field(() => EstadoObra)
  estado: EstadoObra;

  @Field()
  fechaInicio: string;

  @Field(() => Float)
  avancePct: number;

  @Field(() => Float)
  plazoPct: number;

  @Field()
  enRiesgo: boolean;

  @Field(() => PlanillaCorta, { nullable: true })
  ultimaPlanilla: PlanillaCorta | null;
}
