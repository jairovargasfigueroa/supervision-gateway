import { Args, Context, Int, Query, Resolver } from '@nestjs/graphql';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { Roles } from '../comun/auth/roles.decorator.js';
import { IaCliente } from './ia.cliente.js';
import {
  CatalogoReportes,
  ConsultaReporte,
  ConsultaReporteCorta,
} from './modelos/reporte.modelo.js';

/**
 * 503: constructor de reportes del servicio de IA. Solo admin y gerente (los reportes cruzan todas las obras); a otros
 * roles el gateway responde SIN_PERMISO sin llamar a IA.
 */
@Resolver(() => ConsultaReporte)
export class ReportesResolver {
  constructor(private readonly iaCliente: IaCliente) {}

  /** Conjuntos del catálogo (modo REST) y reportes comunes (`GET /catalogo-reportes`). */
  @Roles('admin', 'gerente')
  @Query(() => CatalogoReportes)
  catalogoReportes(
    @Context() contexto: ContextoGraphql,
  ): Promise<CatalogoReportes> {
    return this.iaCliente.catalogoReportes(contexto);
  }

  /** Últimas consultas del usuario, más recientes primero (`GET /consultas-reporte`; IA valida `limite` 1 a 20). */
  @Roles('admin', 'gerente')
  @Query(() => [ConsultaReporteCorta])
  consultasReporte(
    @Context() contexto: ContextoGraphql,
    @Args('limite', { type: () => Int, nullable: true })
    limite?: number | null,
  ): Promise<ConsultaReporteCorta[]> {
    return this.iaCliente.consultasReporte(limite, contexto);
  }
}
