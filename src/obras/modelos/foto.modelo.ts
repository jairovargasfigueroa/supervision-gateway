import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

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
