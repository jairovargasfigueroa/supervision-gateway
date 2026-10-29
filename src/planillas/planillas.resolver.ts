import {
  Args,
  Context,
  ID,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { Roles } from '../comun/auth/roles.decorator.js';
import { cadaUno, cargador } from '../comun/dataloaders/dataloaders.js';
import { Obra } from '../obras/modelos/obra.modelo.js';
import type { ObraRest } from '../obras/obras.cliente.js';
import { Planilla, PlanillaResumen } from './modelos/planilla.modelo.js';
import {
  PlanillasCliente,
  type PlanillaResumenRest,
  type PlanillaRest,
} from './planillas.cliente.js';

/** 007: consulta de una planilla. Obras valida que el usuario vea la obra (si no, 404 con su codigo). */
@Resolver(() => Planilla)
export class PlanillasResolver {
  constructor(private readonly planillasCliente: PlanillasCliente) {}

  @Roles('admin', 'gerente', 'residente')
  @Query(() => Planilla, { nullable: true })
  planilla(
    @Context() contexto: ContextoGraphql,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PlanillaRest> {
    // La misma planilla pedida con dos alias se pide una sola vez a Obras
    return cargador<string, PlanillaRest>(
      contexto,
      'planillas',
      cadaUno((planillaId) =>
        this.planillasCliente.obtener(planillaId, contexto),
      ),
    ).load(id);
  }
}

/** 007: pestaña «Planillas» del detalle de la obra (`GET /obras/{obraId}/planillas`). */
@Resolver(() => Obra)
export class ObraPlanillasResolver {
  constructor(private readonly planillasCliente: PlanillasCliente) {}

  @ResolveField(() => [PlanillaResumen])
  planillas(
    @Parent() obra: ObraRest,
    @Context() contexto: ContextoGraphql,
  ): Promise<PlanillaResumenRest[]> {
    return cargador<string, PlanillaResumenRest[]>(
      contexto,
      'planillasDeObra',
      cadaUno((obraId) => this.planillasCliente.deObra(obraId, contexto)),
    ).load(obra.id);
  }
}
