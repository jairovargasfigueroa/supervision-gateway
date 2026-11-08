import {
  Field,
  Float,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';

// Tipos de la 402 (docs/contratos.md): mismos nombres que el JSON del servicio de IA.

export enum NivelRiesgo {
  BAJO = 'BAJO',
  MEDIO = 'MEDIO',
  ALTO = 'ALTO',
  SIN_DATOS = 'SIN_DATOS',
}
registerEnumType(NivelRiesgo, { name: 'NivelRiesgo' });

@ObjectType()
export class FactorRiesgo {
  @Field()
  variable: string;

  @Field()
  descripcion: string;

  @Field(() => Float)
  peso: number;
}

/** Predicción del modelo para una obra. Con `SIN_DATOS`: probabilidad null y sin factores. */
@ObjectType()
export class RiesgoRetraso {
  /** 0 a 1. */
  @Field(() => Float, { nullable: true })
  probabilidad: number | null;

  @Field(() => NivelRiesgo)
  nivel: NivelRiesgo;

  @Field(() => [FactorRiesgo])
  factores: FactorRiesgo[];

  @Field(() => String, { nullable: true })
  versionModelo: string | null;

  @Field(() => String, { nullable: true })
  calculadaEn: string | null;
}

@ObjectType()
export class PuntoRiesgo {
  @Field(() => Float)
  probabilidad: number;

  @Field()
  calculadaEn: string;
}

@ObjectType()
export class MetricasModeloRiesgo {
  @Field(() => Float)
  aucRoc: number;

  @Field(() => Float)
  aucRocRegla: number;

  @Field(() => Float)
  recallMedio: number;

  @Field(() => Float)
  precisionAlto: number;

  @Field(() => Float)
  brier: number;
}

@ObjectType()
export class VariableModelo {
  @Field()
  nombre: string;

  @Field()
  descripcion: string;
}

@ObjectType()
export class ModeloRiesgo {
  @Field()
  versionModelo: string;

  @Field()
  entrenadoEn: string;

  /** Origen de los datos: `SINTETICOS` o `REALES` (se pasa tal cual desde IA). */
  @Field()
  datos: string;

  @Field(() => Int)
  filasEntrenamiento: number;

  @Field(() => MetricasModeloRiesgo)
  metricas: MetricasModeloRiesgo;

  @Field(() => Float)
  umbralMedio: number;

  @Field(() => Float)
  umbralAlto: number;

  @Field(() => [VariableModelo])
  variables: VariableModelo[];
}
