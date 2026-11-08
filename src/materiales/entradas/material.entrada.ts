import { Field, Float, InputType } from '@nestjs/graphql';
import { TipoMaterial } from '../modelos/material.modelo.js';

// Entradas de crearMaterial y actualizarMaterial (docs/contratos.md). Mismo JSON que el cuerpo de POST/PUT /materiales:
// se reenvía tal cual. Las reglas (código único y en mayúsculas, largos, precio ≥ 0) las valida Materiales.

@InputType()
export class AtributoEntrada {
  @Field()
  nombre: string;

  @Field()
  valor: string;
}

@InputType()
export class MaterialEntrada {
  @Field()
  codigo: string;

  @Field()
  nombre: string;

  @Field(() => TipoMaterial)
  tipo: TipoMaterial;

  @Field()
  unidad: string;

  @Field()
  unidadPlural: string;

  @Field(() => Float)
  precioReferencial: number;

  @Field(() => Boolean, { nullable: true })
  activo?: boolean | null;

  @Field(() => [AtributoEntrada], { nullable: true })
  atributos?: AtributoEntrada[] | null;
}
