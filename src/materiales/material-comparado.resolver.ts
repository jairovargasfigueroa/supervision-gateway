import { Args, Context, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { Obra } from '../obras/modelos/obra.modelo.js';
import { ObrasCliente, type ObraRest } from '../obras/obras.cliente.js';
import { compararMaterial } from './comparacion.js';
import { MaterialesCliente } from './materiales.cliente.js';
import { ComparacionMaterial } from './modelos/comparacion-material.modelo.js';

/**
 * 006: pestaña «Material» de la obra. Une el previsto del periodo (Obras), los consumos (Materiales) y el catálogo
 * (Materiales). Si alguno de los dos servicios falla, solo este campo vuelve null con el error de ese servicio.
 */
@Resolver(() => Obra)
export class MaterialComparadoResolver {
  constructor(
    private readonly obrasCliente: ObrasCliente,
    private readonly materialesCliente: MaterialesCliente,
  ) {}

  @ResolveField(() => ComparacionMaterial, { nullable: true })
  async materialComparado(
    @Parent() obra: ObraRest,
    @Context() contexto: ContextoGraphql,
    @Args('periodo') periodo: string,
  ): Promise<ComparacionMaterial> {
    const [previsto, consumos, catalogo] = await Promise.all([
      this.obrasCliente.materialPrevisto(obra.id, periodo, contexto),
      this.materialesCliente.consumos(obra.id, periodo, contexto),
      this.materialesCliente.catalogoPorId(contexto),
    ]);
    return compararMaterial(obra.partidas, previsto, consumos, catalogo);
  }
}
