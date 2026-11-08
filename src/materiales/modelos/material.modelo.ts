import {
  Field,
  Float,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';

// Tipos de docs/contratos.md (SDL esperado): mismos nombres que el JSON de Materiales (GET /materiales).

export enum TipoMaterial {
  CEMENTO = 'CEMENTO',
  ACERO = 'ACERO',
  AGREGADO = 'AGREGADO',
  LADRILLO = 'LADRILLO',
  MADERA = 'MADERA',
  ELECTRICO = 'ELECTRICO',
  SANITARIO = 'SANITARIO',
  PINTURA = 'PINTURA',
  OTRO = 'OTRO',
}
registerEnumType(TipoMaterial, { name: 'TipoMaterial' });

@ObjectType()
export class Atributo {
  @Field()
  nombre: string;

  @Field()
  valor: string;
}

@ObjectType()
export class Material {
  @Field(() => ID)
  id: string;

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

  @Field()
  activo: boolean;

  @Field(() => [Atributo])
  atributos: Atributo[];
}

@ObjectType()
export class MaterialesPagina {
  @Field(() => [Material])
  items: Material[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  pagina: number;

  @Field(() => Int)
  tamano: number;
}
