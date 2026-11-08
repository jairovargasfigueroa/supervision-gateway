import { Context, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { Insumo } from '../obras/modelos/partida.modelo.js';
import { MaterialesCliente } from './materiales.cliente.js';
import { Material } from './modelos/material.modelo.js';

/** 006: `Insumo.material` desde el catálogo de Materiales; si Materiales falla, solo este campo vuelve null. */
@Resolver(() => Insumo)
export class InsumosResolver {
  constructor(private readonly materialesCliente: MaterialesCliente) {}

  @ResolveField(() => Material, { nullable: true })
  async material(
    @Parent() insumo: Insumo,
    @Context() contexto: ContextoGraphql,
  ): Promise<Material | null> {
    const catalogo = await this.materialesCliente.catalogoPorId(contexto);
    return catalogo.get(insumo.materialId) ?? null;
  }
}
