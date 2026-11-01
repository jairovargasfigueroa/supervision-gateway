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
import { KeycloakAdminCliente } from '../comun/keycloak/keycloak-admin.cliente.js';
import { Usuario } from '../comun/keycloak/usuario.modelo.js';
import { Obra } from '../obras/modelos/obra.modelo.js';
import type { ObraRest } from '../obras/obras.cliente.js';
import { ejecucionDesdeRest } from './agentes.js';
import { IaCliente } from './ia.cliente.js';
import {
  Agente,
  AgenteInfo,
  EjecucionAgente,
  EjecucionCorta,
  EstadoEjecucion,
  EstadoSugerencia,
  Hallazgo,
  Sugerencia,
} from './modelos/agente.modelo.js';

/**
 * 502: agentes del servicio de IA. Los permisos finos (residente: sus obras y nunca CONTROL_COBROS) los aplica IA; el
 * gateway solo corta por rol con @Roles (SIN_PERMISO sin llamar a IA).
 */
@Resolver(() => AgenteInfo)
export class AgentesResolver {
  constructor(private readonly iaCliente: IaCliente) {}

  /** Tarjetas de los agentes (`GET /agentes`); para residente IA no manda CONTROL_COBROS. */
  @Roles('admin', 'gerente', 'residente')
  @Query(() => [AgenteInfo])
  async agentes(@Context() contexto: ContextoGraphql): Promise<AgenteInfo[]> {
    return (await this.iaCliente.agentes(contexto)) as unknown as AgenteInfo[];
  }

  /** Historial de ejecuciones (`GET /ejecuciones`), más recientes primero; IA valida `limite` 1 a 50. */
  @Roles('admin', 'gerente')
  @Query(() => [EjecucionCorta])
  async ejecucionesAgente(
    @Context() contexto: ContextoGraphql,
    @Args('agente', { type: () => Agente, nullable: true })
    agente?: Agente | null,
    @Args('estado', { type: () => EstadoEjecucion, nullable: true })
    estado?: EstadoEjecucion | null,
    @Args('limite', { type: () => Int, nullable: true })
    limite?: number | null,
  ): Promise<EjecucionCorta[]> {
    return (await this.iaCliente.ejecuciones(
      { agente, estado, limite },
      contexto,
    )) as unknown as EjecucionCorta[];
  }

  /** Detalle con pasos y hallazgos (`GET /ejecuciones/{id}`); si no existe, null con EJECUCION_NO_ENCONTRADA. */
  @Roles('admin', 'gerente')
  @Query(() => EjecucionAgente, { nullable: true })
  async ejecucionAgente(
    @Context() contexto: ContextoGraphql,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<EjecucionAgente> {
    return ejecucionDesdeRest(await this.iaCliente.ejecucion(id, contexto));
  }

  /** Hallazgos vigentes (última ejecución TERMINADA de cada agente, `GET /hallazgos`). */
  @Roles('admin', 'gerente', 'residente')
  @Query(() => [Hallazgo])
  async hallazgos(
    @Context() contexto: ContextoGraphql,
    @Args('agente', { type: () => Agente, nullable: true })
    agente?: Agente | null,
    @Args('obraId', { type: () => ID, nullable: true })
    obraId?: string | null,
  ): Promise<Hallazgo[]> {
    return (await this.iaCliente.hallazgos(
      { agente, obraId },
      contexto,
    )) as unknown as Hallazgo[];
  }

  /**
   * «Ejecutar ahora» (`POST /agentes/{agente}/ejecuciones`): devuelve la ejecución EN_CURSO, MANUAL. Sin reintento; los
   * errores llegan con el codigo de IA (409 EJECUCION_EN_CURSO, 400 AGENTE_INVALIDO).
   */
  @Roles('admin', 'gerente')
  @Mutation(() => EjecucionCorta)
  async ejecutarAgente(
    @Context() contexto: ContextoGraphql,
    @Args('agente', { type: () => Agente }) agente: Agente,
  ): Promise<EjecucionCorta> {
    return (await this.iaCliente.ejecutarAgente(
      agente,
      contexto,
    )) as unknown as EjecucionCorta;
  }

  /** Sugerencias (`GET /sugerencias`); IA valida `limite` 1 a 100 y por defecto da 50. */
  @Roles('admin', 'gerente', 'residente')
  @Query(() => [Sugerencia])
  async sugerencias(
    @Context() contexto: ContextoGraphql,
    @Args('estado', { type: () => EstadoSugerencia, nullable: true })
    estado?: EstadoSugerencia | null,
    @Args('agente', { type: () => Agente, nullable: true })
    agente?: Agente | null,
    @Args('obraId', { type: () => ID, nullable: true })
    obraId?: string | null,
    @Args('limite', { type: () => Int, nullable: true })
    limite?: number | null,
  ): Promise<Sugerencia[]> {
    return (await this.iaCliente.sugerencias(
      { estado, agente, obraId, limite },
      contexto,
    )) as unknown as Sugerencia[];
  }
}

/**
 * 502: hallazgos vigentes y sugerencias de la obra (pestaña «Agentes» de Obras y panel de Materiales), con el DataLoader
 * de la petición. Si IA no responde, solo estos campos vuelven null con SERVICIO_NO_DISPONIBLE y el resto de la obra
 * llega.
 */
@Resolver(() => Obra)
export class ObraAgentesResolver {
  constructor(private readonly iaCliente: IaCliente) {}

  @ResolveField(() => [Hallazgo], { nullable: true })
  async hallazgos(
    @Parent() obra: ObraRest,
    @Context() contexto: ContextoGraphql,
    @Args('agente', { type: () => Agente, nullable: true })
    agente?: Agente | null,
  ): Promise<Hallazgo[]> {
    return (await this.iaCliente.hallazgosDeObra(
      obra.id,
      agente,
      contexto,
    )) as unknown as Hallazgo[];
  }

  @ResolveField(() => [Sugerencia], { nullable: true })
  async sugerencias(
    @Parent() obra: ObraRest,
    @Context() contexto: ContextoGraphql,
    @Args('estado', { type: () => EstadoSugerencia, nullable: true })
    estado?: EstadoSugerencia | null,
  ): Promise<Sugerencia[]> {
    return (await this.iaCliente.sugerenciasDeObra(
      obra.id,
      estado,
      contexto,
    )) as unknown as Sugerencia[];
  }
}

/** 502: quién pidió la ejecución (Keycloak, caché de 5 min y DataLoader de la petición); null si fue programada. */
@Resolver(() => EjecucionAgente)
export class EjecucionAgenteResolver {
  constructor(private readonly keycloak: KeycloakAdminCliente) {}

  @ResolveField(() => Usuario, { nullable: true })
  solicitadaPor(
    @Parent() ejecucion: EjecucionAgente,
    @Context() contexto: ContextoGraphql,
  ): Promise<Usuario | null> {
    return ejecucion.solicitadaPor
      ? this.keycloak.usuarioEnPeticion(ejecucion.solicitadaPor, contexto)
      : Promise.resolve(null);
  }
}

/**
 * 502: aprobar y rechazar una sugerencia y quién la decidió (Keycloak, caché de 5 min y DataLoader de la petición; null
 * si está PENDIENTE).
 */
@Resolver(() => Sugerencia)
export class SugerenciaResolver {
  constructor(
    private readonly iaCliente: IaCliente,
    private readonly keycloak: KeycloakAdminCliente,
  ) {}

  /**
   * Aprueba la sugerencia (solo registra la decisión; no se ejecuta nada en otro servicio). Sin reintento; errores de IA:
   * 404 SUGERENCIA_NO_ENCONTRADA (también si no puede verla), 409 SUGERENCIA_YA_DECIDIDA, 422 COMENTARIO_INVALIDO.
   */
  @Roles('admin', 'gerente', 'residente')
  @Mutation(() => Sugerencia)
  async aprobarSugerencia(
    @Context() contexto: ContextoGraphql,
    @Args('id', { type: () => ID }) id: string,
    @Args('comentario', { type: () => String, nullable: true })
    comentario?: string | null,
  ): Promise<Sugerencia> {
    return (await this.iaCliente.aprobarSugerencia(
      id,
      comentario,
      contexto,
    )) as unknown as Sugerencia;
  }

  /**
   * Rechaza la sugerencia con un motivo (IA valida 10 a 500 caracteres: 422 MOTIVO_INVALIDO). Sin reintento; mismos
   * errores que aprobar.
   */
  @Roles('admin', 'gerente', 'residente')
  @Mutation(() => Sugerencia)
  async rechazarSugerencia(
    @Context() contexto: ContextoGraphql,
    @Args('id', { type: () => ID }) id: string,
    @Args('motivo') motivo: string,
  ): Promise<Sugerencia> {
    return (await this.iaCliente.rechazarSugerencia(
      id,
      motivo,
      contexto,
    )) as unknown as Sugerencia;
  }

  @ResolveField(() => Usuario, { nullable: true })
  decididaPor(
    @Parent() sugerencia: Sugerencia,
    @Context() contexto: ContextoGraphql,
  ): Promise<Usuario | null> {
    return sugerencia.decididaPor
      ? this.keycloak.usuarioEnPeticion(sugerencia.decididaPor, contexto)
      : Promise.resolve(null);
  }
}
