import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import type { ContextoGraphql } from '../auth/contexto.js';
import { Roles } from '../auth/roles.decorator.js';
import { KeycloakAdminCliente } from './keycloak-admin.cliente.js';
import { RolUsuario, Usuario } from './usuario.modelo.js';

@Resolver(() => Usuario)
export class UsuariosResolver {
  constructor(private readonly keycloak: KeycloakAdminCliente) {}

  /** 002: usuarios de Keycloak con un rol, para elegir las asignaciones de una obra. */
  @Roles('admin')
  @Query(() => [Usuario])
  usuarios(
    @Context() contexto: ContextoGraphql,
    @Args('rol', { type: () => RolUsuario }) rol: RolUsuario,
  ): Promise<Usuario[]> {
    return this.keycloak.usuariosConRol(rol, contexto.req.requestId);
  }
}
