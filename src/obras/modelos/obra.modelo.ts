import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { EstadoObra } from './obra-resumen.modelo.js';
import { Partida } from './partida.modelo.js';

@ObjectType()
export class ContratoObra {
  /** null hasta que Finanzas registra el contrato (ContratoRegistrado). */
  @Field(() => ID, { nullable: true })
  contratoId: string | null;

  @Field(() => Float)
  monto: number;

  @Field(() => Int)
  plazoDias: number;

  @Field(() => Float)
  anticipoPct: number;

  @Field(() => Float)
  retencionPct: number;
}

/**
 * Detalle de la obra (docs/contratos.md). Los datos de Obras están aquí; los campos de otros servicios (asignaciones,
 * finanzas, cobros, materialComparado, fotos, planillas) los agrega un @ResolveField cada uno.
 */
@ObjectType()
export class Obra {
  @Field(() => ID)
  id: string;

  @Field()
  nombre: string;

  @Field()
  ubicacion: string;

  @Field(() => EstadoObra)
  estado: EstadoObra;

  @Field()
  fechaInicio: string;

  @Field(() => String, { nullable: true })
  motivoRechazoContrato: string | null;

  @Field(() => ContratoObra)
  contrato: ContratoObra;

  @Field(() => Float)
  avancePct: number;

  @Field(() => Float)
  plazoPct: number;

  @Field()
  enRiesgo: boolean;

  @Field(() => [Partida])
  partidas: Partida[];

  /** Ids de Keycloak que manda Obras; no se exponen: residente, maestro, almacenero y cliente se resuelven en el resolver. */
  asignaciones: {
    residenteId: string;
    maestroId: string;
    almaceneroId: string;
    clienteId: string;
  };
}
