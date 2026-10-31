import {
  Field,
  Float,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';

// Tipos de la 403 (docs/contratos.md): mismos nombres que el JSON del servicio de IA.

export enum EstadoRevision {
  PENDIENTE = 'PENDIENTE',
  NORMAL = 'NORMAL',
  CONFIRMADO = 'CONFIRMADO',
}
registerEnumType(EstadoRevision, { name: 'EstadoRevision' });

/**
 * Salida de material que el modelo marcó como atípica (`GET /consumos-atipicos`, 403). `material` (Materiales) y
 * `revisadoPor` (Keycloak) los resuelve ConsumoAtipicoResolver; si uno de ellos falla, solo ese campo vuelve null.
 */
@ObjectType()
export class ConsumoAtipico {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  movimientoId: string;

  @Field(() => ID)
  obraId: string;

  @Field(() => ID)
  materialId: string;

  @Field(() => ID)
  partidaId: string;

  @Field(() => Float)
  cantidad: number;

  @Field()
  periodo: string;

  @Field()
  registradoEn: string;

  /** 0 a 1 (más alto = más raro). */
  @Field(() => Float)
  puntaje: number;

  @Field(() => [String])
  motivos: string[];

  @Field(() => EstadoRevision)
  estadoRevision: EstadoRevision;

  /** Id de Keycloak que manda IA; no se expone tal cual: ConsumoAtipicoResolver lo convierte en Usuario. */
  revisadoPor: string | null;

  @Field(() => String, { nullable: true })
  revisadoEn: string | null;

  @Field(() => String, { nullable: true })
  comentario: string | null;

  @Field()
  versionModelo: string;
}
