import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

/** Material previsto por unidad de la partida. El campo `material` (catálogo de Materiales) llega con la 003. */
@ObjectType()
export class Insumo {
  @Field(() => ID)
  materialId: string;

  @Field(() => Float)
  cantidadPorUnidad: number;
}

@ObjectType()
export class Partida {
  @Field(() => ID)
  id: string;

  @Field()
  codigo: string;

  @Field()
  nombre: string;

  @Field()
  unidad: string;

  @Field(() => Float)
  cantidadContratada: number;

  @Field(() => Float)
  precioUnitario: number;

  @Field(() => String, { nullable: true })
  meses: string | null;

  @Field(() => Float)
  ejecutadaAcumulada: number;

  @Field(() => Float)
  avancePct: number;

  @Field(() => [Insumo])
  insumos: Insumo[];
}
