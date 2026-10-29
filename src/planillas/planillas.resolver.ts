import {
  Args,
  Context,
  ID,
  Int,
  Mutation,
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
import { GuardarPlanillaEntrada } from './entradas/guardar-planilla.entrada.js';
import { Planilla, PlanillaResumen } from './modelos/planilla.modelo.js';
import {
  PlanillasCliente,
  type PlanillaResumenRest,
  type PlanillaRest,
} from './planillas.cliente.js';

/**
 * 007: consulta y mutaciones de la planilla. Obras valida que el usuario vea la obra y sea su residente, y todas las
 * reglas; sus errores (409 VERSION_DESACTUALIZADA, 422 SUPERA_CANTIDAD_CONTRATADA…) llegan en extensions.codigo.
 * Las mutaciones no se reintentan.
 */
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

  /** Crea la planilla en BORRADOR con el número siguiente y una línea por partida en 0. */
  @Roles('residente')
  @Mutation(() => Planilla)
  crearPlanilla(
    @Context() contexto: ContextoGraphql,
    @Args('obraId', { type: () => ID }) obraId: string,
    @Args('periodo') periodo: string,
  ): Promise<PlanillaRest> {
    return this.planillasCliente.crear(obraId, periodo, contexto);
  }

  /** Guarda el borrador (cantidades del periodo y fotos adjuntas) con la versión que leyó el usuario. */
  @Roles('residente')
  @Mutation(() => Planilla)
  guardarPlanilla(
    @Context() contexto: ContextoGraphql,
    @Args('id', { type: () => ID }) id: string,
    @Args('entrada', { type: () => GuardarPlanillaEntrada })
    entrada: GuardarPlanillaEntrada,
  ): Promise<PlanillaRest> {
    return this.planillasCliente.guardar(id, entrada, contexto);
  }

  /** La pasa a PRESENTADA (las fotos adjuntas quedan visibles para el cliente). */
  @Roles('residente')
  @Mutation(() => Planilla)
  presentarPlanilla(
    @Context() contexto: ContextoGraphql,
    @Args('id', { type: () => ID }) id: string,
    @Args('version', { type: () => Int }) version: number,
  ): Promise<PlanillaRest> {
    return this.planillasCliente.presentar(id, version, contexto);
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
