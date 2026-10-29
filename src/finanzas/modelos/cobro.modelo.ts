import {
  Field,
  Float,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';

// Tipos de docs/contratos.md (SDL esperado): mismos nombres que el JSON de Finanzas (GET /cobros).

export enum EstadoCobro {
  PENDIENTE = 'PENDIENTE',
  VENCIDO = 'VENCIDO',
}
registerEnumType(EstadoCobro, { name: 'EstadoCobro' });

@ObjectType()
export class Cobro {
  @Field(() => ID)
  id: string;

  @Field()
  numero: string;

  @Field(() => ID)
  planillaId: string;

  @Field(() => Float)
  montoNeto: number;

  @Field()
  emitidoEn: string;

  @Field()
  venceEn: string;

  @Field(() => EstadoCobro)
  estado: EstadoCobro;
}
