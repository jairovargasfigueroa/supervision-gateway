import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';

// Entradas de registrarObra (docs/contratos.md). Mismo JSON que el cuerpo de POST /obras: se reenvía tal cual.
// Las reglas (presupuesto, códigos, porcentajes) las valida Obras; el gateway solo arma la petición.

@InputType()
export class AsignacionesEntrada {
  @Field(() => ID)
  residenteId: string;

  @Field(() => ID)
  maestroId: string;

  @Field(() => ID)
  almaceneroId: string;

  @Field(() => ID)
  clienteId: string;
}

@InputType()
export class ContratoEntrada {
  @Field(() => Float)
  monto: number;

  @Field(() => Int)
  plazoDias: number;

  @Field(() => Float)
  anticipoPct: number;

  @Field(() => Float)
  retencionPct: number;

  @Field()
  firmadoEn: string;
}

@InputType()
export class InsumoEntrada {
  @Field(() => ID)
  materialId: string;

  @Field(() => Float)
  cantidadPorUnidad: number;
}

@InputType()
export class PartidaEntrada {
  @Field()
  codigo: string;

  @Field()
  nombre: string;

  @Field()
  unidad: string;

  @Field(() => Float)
  cantidadContratada: number;

  @Field(() => Float)
  precioUnitario: number;

  @Field(() => String, { nullable: true })
  meses?: string | null;

  @Field(() => [InsumoEntrada], { nullable: true })
  insumos?: InsumoEntrada[] | null;
}

@InputType()
export class RegistrarObraEntrada {
  @Field()
  nombre: string;

  @Field()
  ubicacion: string;

  @Field()
  fechaInicio: string;

  @Field(() => AsignacionesEntrada)
  asignaciones: AsignacionesEntrada;

  @Field(() => ContratoEntrada)
  contrato: ContratoEntrada;

  @Field(() => [PartidaEntrada])
  partidas: PartidaEntrada[];
}
