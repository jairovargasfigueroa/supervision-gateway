import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';

// Entrada de guardarPlanilla (docs/contratos.md). Mismo JSON que el cuerpo de PUT /planillas/{id}: se reenvía tal cual.
// Las reglas (límite contra lo contratado, fotos del periodo, versión) las valida Obras.

@InputType()
export class LineaEntrada {
  @Field(() => ID)
  partidaId: string;

  @Field(() => Float)
  cantidadPeriodo: number;
}

@InputType()
export class GuardarPlanillaEntrada {
  /** Versión que leyó el usuario; si otra persona guardó antes, Obras responde 409 VERSION_DESACTUALIZADA. */
  @Field(() => Int)
  version: number;

  @Field(() => [LineaEntrada])
  lineas: LineaEntrada[];

  @Field(() => [ID])
  fotoIds: string[];
}
