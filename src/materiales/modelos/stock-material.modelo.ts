import { Field, Float, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

/** Estado del stock de un material en una obra; lo calcula Materiales al leer (reglas del negocio). */
export enum EstadoStock {
  BAJO = 'BAJO',
  JUSTO = 'JUSTO',
  OK = 'OK',
}
registerEnumType(EstadoStock, { name: 'EstadoStock' });

/** Fila de `GET /obras/{obraId}/stock` y de `PUT /obras/{obraId}/stock/{materialId}/minimo`. */
@ObjectType()
export class StockMaterial {
  @Field(() => ID)
  materialId: string;

  @Field()
  codigo: string;

  @Field()
  nombre: string;

  @Field()
  unidad: string;

  @Field()
  unidadPlural: string;

  @Field(() => Float)
  cantidad: number;

  @Field(() => Float)
  minimo: number;

  @Field(() => EstadoStock)
  estado: EstadoStock;
}
