import { Field, Float, ID, ObjectType } from '@nestjs/graphql';
import { Material } from './material.modelo.js';

/** Una fila de la pestaña «Material»: previsto (Obras) frente a usado (Materiales) de un material en una partida. */
@ObjectType()
export class FilaComparacion {
  @Field(() => ID)
  partidaId: string;

  @Field()
  partidaCodigo: string;

  @Field(() => Material)
  material: Material;

  @Field(() => Float)
  previsto: number;

  @Field(() => Float)
  usado: number;

  /** usado − previsto (positivo: se usó más de lo previsto). */
  @Field(() => Float)
  diferencia: number;

  /** usado > 1,20 × previsto (reglas del negocio, «Consumo fuera de lo previsto»). */
  @Field()
  excedido: boolean;
}

@ObjectType()
export class ComparacionMaterial {
  @Field()
  periodo: string;

  /** false si no hay planilla en el periodo: todo el previsto es 0 («Sin planilla en este periodo»). */
  @Field()
  hayPlanilla: boolean;

  @Field(() => [FilaComparacion])
  filas: FilaComparacion[];
}
