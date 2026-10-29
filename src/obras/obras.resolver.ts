import {
  Args,
  Context,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { Roles } from '../comun/auth/roles.decorator.js';
import { cadaUno, cargador } from '../comun/dataloaders/dataloaders.js';
import { KeycloakAdminCliente } from '../comun/keycloak/keycloak-admin.cliente.js';
import { Usuario } from '../comun/keycloak/usuario.modelo.js';
import { RegistrarObraEntrada } from './entradas/registrar-obra.entrada.js';
import { EstadoObra, ObraResumen } from './modelos/obra-resumen.modelo.js';
import { Obra } from './modelos/obra.modelo.js';
import { ObrasCliente, type ObraRest } from './obras.cliente.js';

type Asignacion = keyof ObraRest['asignaciones'];

@Resolver(() => Obra)
export class ObrasResolver {
  constructor(
    private readonly obrasCliente: ObrasCliente,
    private readonly keycloak: KeycloakAdminCliente,
  ) {}

  /** 006: obras que ve el usuario, con filtros e indicadores; Obras filtra por visibilidad y calcula avance y plazo. */
  @Roles('admin', 'gerente', 'residente')
  @Query(() => [ObraResumen])
  obras(
    @Context() contexto: ContextoGraphql,
    @Args('estado', { type: () => EstadoObra, nullable: true })
    estado?: EstadoObra,
    @Args('busqueda', { nullable: true }) busqueda?: string,
  ): Promise<ObraResumen[]> {
    return this.obrasCliente.listar({ estado, busqueda }, contexto);
  }

  /** Detalle de una obra. Si el usuario no la ve, Obras responde 404 y el campo vuelve null con OBRA_NO_ENCONTRADA. */
  @Roles('admin', 'gerente', 'residente')
  @Query(() => Obra, { nullable: true })
  obra(
    @Context() contexto: ContextoGraphql,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ObraRest> {
    // DataLoader de la petición: la misma obra pedida dos veces (alias) se pide una sola vez a Obras
    return cargador<string, ObraRest>(
      contexto,
      'obras',
      cadaUno((obraId) => this.obrasCliente.obtener(obraId, contexto)),
    ).load(id);
  }

  /** 002: registra la obra en Obras (queda SIN_CONTRATO). Los errores llegan con el codigo de Obras. */
  @Roles('admin')
  @Mutation(() => Obra)
  registrarObra(
    @Context() contexto: ContextoGraphql,
    @Args('entrada', { type: () => RegistrarObraEntrada })
    entrada: RegistrarObraEntrada,
  ): Promise<ObraRest> {
    return this.obrasCliente.registrar(entrada, contexto);
  }

  // Asignaciones: nombres desde Keycloak (caché de 5 min y DataLoader); si Keycloak falla, solo ese campo vuelve null.

  @ResolveField(() => Usuario, { nullable: true })
  residente(
    @Parent() obra: ObraRest,
    @Context() contexto: ContextoGraphql,
  ): Promise<Usuario | null> {
    return this.usuario(obra, 'residenteId', contexto);
  }

  @ResolveField(() => Usuario, { nullable: true })
  maestro(
    @Parent() obra: ObraRest,
    @Context() contexto: ContextoGraphql,
  ): Promise<Usuario | null> {
    return this.usuario(obra, 'maestroId', contexto);
  }

  @ResolveField(() => Usuario, { nullable: true })
  almacenero(
    @Parent() obra: ObraRest,
    @Context() contexto: ContextoGraphql,
  ): Promise<Usuario | null> {
    return this.usuario(obra, 'almaceneroId', contexto);
  }

  @ResolveField(() => Usuario, { nullable: true })
  cliente(
    @Parent() obra: ObraRest,
    @Context() contexto: ContextoGraphql,
  ): Promise<Usuario | null> {
    return this.usuario(obra, 'clienteId', contexto);
  }

  private async usuario(
    obra: ObraRest,
    campo: Asignacion,
    contexto: ContextoGraphql,
  ): Promise<Usuario | null> {
    const id = obra.asignaciones?.[campo];
    return id ? this.keycloak.usuarioEnPeticion(id, contexto) : null;
  }
}
