import { Logger } from '@nestjs/common';
import {
  Args,
  Context,
  ID,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { Roles } from '../comun/auth/roles.decorator.js';
import { KeycloakAdminCliente } from '../comun/keycloak/keycloak-admin.cliente.js';
import {
  IaCliente,
  type ConsultaReporteRest,
  type PedidoReporteRest,
} from './ia.cliente.js';
import {
  AtajoReporte,
  CatalogoReportes,
  ConsultaReporte,
  ConsultaReporteCorta,
  RespuestaReporte,
} from './modelos/reporte.modelo.js';

/**
 * 503: constructor de reportes del servicio de IA. Solo admin y gerente (los reportes cruzan todas las obras); a otros
 * roles el gateway responde SIN_PERMISO sin llamar a IA.
 */
@Resolver(() => ConsultaReporte)
export class ReportesResolver {
  private readonly registro = new Logger(ReportesResolver.name);

  constructor(
    private readonly iaCliente: IaCliente,
    private readonly keycloak: KeycloakAdminCliente,
  ) {}

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

  /**
   * Pide un reporte con texto (dictado o escrito) o con un reporte común. Exige exactamente uno de los dos (si no,
   * DATOS_INVALIDOS sin llamar a IA). 505: con `conversacionId` continúa esa conversación (se envía solo si viene) y
   * la respuesta es un reporte o una pregunta de aclaración; CONVERSACION_NO_ENCONTRADA llega tal cual de IA. Agrega
   * el directorio de clientes de Keycloak para que IA ponga sus nombres; si Keycloak falla, se envía sin él (IA
   * avisa). 60 s y sin reintento; la receta no se expone.
   */
  @Roles('admin', 'gerente')
  @Mutation(() => RespuestaReporte)
  async consultarReporte(
    @Context() contexto: ContextoGraphql,
    @Args('texto', { type: () => String, nullable: true })
    texto?: string | null,
    @Args('atajo', { type: () => AtajoReporte, nullable: true })
    atajo?: AtajoReporte | null,
    @Args('conversacionId', { type: () => ID, nullable: true })
    conversacionId?: string | null,
  ): Promise<RespuestaReporte> {
    const hayTexto = texto !== null && texto !== undefined;
    const hayAtajo = atajo !== null && atajo !== undefined;
    if (hayTexto === hayAtajo) {
      throw new GraphQLError(
        'Envía el texto del pedido o un reporte común (solo uno de los dos)',
        {
          extensions: {
            codigo: 'DATOS_INVALIDOS',
            servicio: 'gateway',
            estado: 400,
          },
        },
      );
    }
    const pedido: PedidoReporteRest = hayTexto
      ? { texto: texto! }
      : { atajo: atajo! };
    if (conversacionId !== null && conversacionId !== undefined) {
      pedido.conversacionId = conversacionId;
    }
    const directorio = await this.directorio(contexto);
    if (directorio) pedido.directorio = directorio;
    const respuesta = await this.iaCliente.consultarReporte(pedido, contexto);
    return {
      conversacionId: respuesta.conversacionId,
      tipo: respuesta.tipo,
      consulta: respuesta.consulta ? sinReceta(respuesta.consulta) : null,
      aclaracion: respuesta.aclaracion ?? null,
    };
  }

  /** Clientes de Keycloak (`id` y `nombre`) con la caché de 5 minutos; undefined si Keycloak no responde o falla. */
  private async directorio(
    contexto: ContextoGraphql,
  ): Promise<PedidoReporteRest['directorio']> {
    try {
      const clientes = await this.keycloak.usuariosConRolEnCache(
        'cliente',
        contexto.req.requestId,
      );
      return { clientes: clientes.map(({ id, nombre }) => ({ id, nombre })) };
    } catch (error) {
      this.registro.warn(
        `[${contexto.req.requestId}] Reporte sin directorio de clientes: ${(error as Error).message}`,
      );
      return undefined;
    }
  }
}

/** El reporte tal como lo manda IA, sin la `receta` (no se expone por GraphQL: la persona ve `aplicado`). */
function sinReceta({
  receta: _receta,
  ...consulta
}: ConsultaReporteRest): ConsultaReporte {
  return consulta;
}
