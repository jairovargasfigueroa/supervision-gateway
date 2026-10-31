import {
  Field,
  Float,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';

// Tipos de docs/contratos.md (SDL esperado): mismos nombres que el JSON de Obras.

export enum EstadoObra {
  SIN_CONTRATO = 'SIN_CONTRATO',
  EN_EJECUCION = 'EN_EJECUCION',
  CONCLUIDA = 'CONCLUIDA',
}
registerEnumType(EstadoObra, { name: 'EstadoObra' });

/** 401: zona de la obra (decisión del equipo). Opcional: null = sin zona. */
export enum ZonaObra {
  NORTE = 'NORTE',
  SUR = 'SUR',
  ESTE = 'ESTE',
  OESTE = 'OESTE',
  CENTRO = 'CENTRO',
}
registerEnumType(ZonaObra, { name: 'ZonaObra' });

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

  /** 401: tal cual la devuelve Obras (null = sin zona). */
  @Field(() => ZonaObra, { nullable: true })
  zona?: ZonaObra | null;

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
