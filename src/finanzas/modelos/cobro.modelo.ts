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
  /** 201: pago registrado por admin; no cambia más. */
  PAGADO = 'PAGADO',
}
registerEnumType(EstadoCobro, { name: 'EstadoCobro' });

/** 201: correos que n8n envió por el cobro (tabla `envio_cobro` de Finanzas, uno por tipo). */
export enum TipoEnvioCobro {
  NOTA_COBRO = 'NOTA_COBRO',
  RECORDATORIO_POR_VENCER = 'RECORDATORIO_POR_VENCER',
  RECORDATORIO_VENCIDO = 'RECORDATORIO_VENCIDO',
  CONSTANCIA_PAGO = 'CONSTANCIA_PAGO',
}
registerEnumType(TipoEnvioCobro, { name: 'TipoEnvioCobro' });

/** 201: un correo enviado por el cobro, tal cual `envios[]` de `GET /cobros` (Finanzas los ordena por enviadoEn). */
@ObjectType()
export class EnvioCobro {
  @Field(() => TipoEnvioCobro)
  tipo: TipoEnvioCobro;

  @Field()
  destinatario: string;

  @Field()
  enviadoEn: string;
}

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

  /** 201: fecha de pago (AAAA-MM-DD, La Paz); null si no está pagado. */
  @Field(() => String, { nullable: true })
  pagadoEn?: string | null;

  /** 201: n.º de comprobante del pago; null si no está pagado o no lo tiene. */
  @Field(() => String, { nullable: true })
  comprobante?: string | null;

  /** 201: lo resuelve CobroResolver (lista vacía si Finanzas no manda envios). */
  @Field(() => [EnvioCobro])
  envios?: EnvioCobro[];
}
