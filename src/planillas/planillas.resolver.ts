import {
  Args,
  Context,
  Float,
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
import { tieneAlgunRol } from '../comun/auth/roles-efectivos.js';
import { cadaUno, cargador } from '../comun/dataloaders/dataloaders.js';
import { FinanzasCliente } from '../finanzas/finanzas.cliente.js';
import { type Cobro, EstadoCobro } from '../finanzas/modelos/cobro.modelo.js';
import { Obra } from '../obras/modelos/obra.modelo.js';
import type { ObraRest } from '../obras/obras.cliente.js';
import { GuardarPlanillaEntrada } from './entradas/guardar-planilla.entrada.js';
import {
  CobroPlanilla,
  Planilla,
  PlanillaResumen,
} from './modelos/planilla.modelo.js';
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

  /** 008: id y numero del cobro que Obras guardó al aprobarse la planilla; null mientras no tenga cobro. */
  @ResolveField(() => CobroPlanilla, { nullable: true })
  cobro(@Parent() planilla: PlanillaRest): CobroPlanilla | null {
    const { cobroId, cobroNumero } = planilla;
    if (!cobroId || !cobroNumero) return null;
    return { id: cobroId, numero: cobroNumero };
  }
}

/** Roles que ven el detalle del cobro en Finanzas (contrato GraphQL; Finanzas no tiene la regla de obras asignadas). */
const ROLES_FINANZAS = ['admin', 'gerente'];

/**
 * 008: campos de CobroPlanilla que vienen de Finanzas (`GET /cobros/{id}`, un solo pedido por cobro y petición). Para
 * otros roles vuelven null sin error y sin llamar a Finanzas; si Finanzas no responde, solo estos campos vuelven null
 * con SERVICIO_NO_DISPONIBLE (id y numero llegan igual).
 */
@Resolver(() => CobroPlanilla)
export class CobroPlanillaResolver {
  constructor(private readonly finanzasCliente: FinanzasCliente) {}

  @ResolveField(() => Float, { nullable: true })
  montoNeto(
    @Parent() cobro: CobroPlanilla,
    @Context() contexto: ContextoGraphql,
  ): Promise<number | null> {
    return this.campo(cobro, contexto, (detalle) => detalle.montoNeto);
  }

  @ResolveField(() => String, { nullable: true })
  emitidoEn(
    @Parent() cobro: CobroPlanilla,
    @Context() contexto: ContextoGraphql,
  ): Promise<string | null> {
    return this.campo(cobro, contexto, (detalle) => detalle.emitidoEn);
  }

  @ResolveField(() => String, { nullable: true })
  venceEn(
    @Parent() cobro: CobroPlanilla,
    @Context() contexto: ContextoGraphql,
  ): Promise<string | null> {
    return this.campo(cobro, contexto, (detalle) => detalle.venceEn);
  }

  @ResolveField(() => EstadoCobro, { nullable: true })
  estado(
    @Parent() cobro: CobroPlanilla,
    @Context() contexto: ContextoGraphql,
  ): Promise<EstadoCobro | null> {
    return this.campo(cobro, contexto, (detalle) => detalle.estado);
  }

  private async campo<T>(
    cobro: CobroPlanilla,
    contexto: ContextoGraphql,
    elegir: (detalle: Cobro) => T,
  ): Promise<T | null> {
    if (!tieneAlgunRol(contexto.req.usuario, ROLES_FINANZAS)) return null;
    return elegir(await this.finanzasCliente.cobro(cobro.id, contexto));
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
