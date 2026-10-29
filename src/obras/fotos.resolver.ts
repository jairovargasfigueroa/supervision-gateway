import { Context, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { KeycloakAdminCliente } from '../comun/keycloak/keycloak-admin.cliente.js';
import { Usuario } from '../comun/keycloak/usuario.modelo.js';
import { Foto } from './modelos/foto.modelo.js';

/** 005: quién registró cada foto, desde Keycloak (caché de 5 min y DataLoader); si Keycloak falla, solo este campo es null. */
@Resolver(() => Foto)
export class FotosResolver {
  constructor(private readonly keycloak: KeycloakAdminCliente) {}

  @ResolveField(() => Usuario, { nullable: true })
  registradoPor(
    @Parent() foto: Foto,
    @Context() contexto: ContextoGraphql,
  ): Promise<Usuario | null> {
    return foto.registradoPor
      ? this.keycloak.usuarioEnPeticion(foto.registradoPor, contexto)
      : Promise.resolve(null);
  }
}
