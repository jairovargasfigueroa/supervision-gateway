import { Field, Float, ObjectType } from '@nestjs/graphql';

/** Saldos del contrato de la obra según Finanzas (`GET /contratos?obraId=`). Solo para admin y gerente. */
@ObjectType()
export class FinanzasObra {
  @Field(() => Float)
  saldoDisponible: number;

  @Field(() => Float)
  totalCobrado: number;

  @Field(() => Float)
  totalReservado: number;
}
