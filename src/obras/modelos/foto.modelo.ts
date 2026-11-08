import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

/**
 * 301 · Detección de casco y chaleco hecha en el celular, tal como la devuelve Obras en cada foto
 * (`deteccion`).
 */
@ObjectType()
export class DeteccionEpp {
  @Field(() => Int)
  personas: number;

  @Field(() => Int)
  sinCasco: number;

  @Field(() => Int)
  sinChaleco: number;

  /** Versión del modelo usado en el celular, por ejemplo `epp-1.0.0`. */
  @Field()
  versionModelo: string;
}

/** Foto de avance (005) tal como la devuelve Obras (`GET /obras/{id}/fotos`). */
@ObjectType()
export class Foto {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  partidaId: string;

  /** Id de Keycloak que manda Obras; no se expone tal cual: FotosResolver lo convierte en Usuario. */
  registradoPor: string;

  @Field()
  registradoEn: string;

  @Field()
  publicadaCliente: boolean;

  /** URL firmada de S3 para descargar la foto (vence a los 30 minutos). */
  @Field()
  urlDescarga: string;

  /**
   * 301: se mapea tal cual desde Obras. null si la foto no se analizó (o la detección se descartó);
   * Obras la manda siempre null al cliente.
   */
  @Field(() => DeteccionEpp, { nullable: true })
  deteccion?: DeteccionEpp | null;
}

@ObjectType()
export class FotosPagina {
  @Field(() => [Foto])
  items: Foto[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  pagina: number;

  @Field(() => Int)
  tamano: number;
}
