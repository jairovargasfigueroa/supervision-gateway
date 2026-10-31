import { Args, Context, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { KeycloakAdminCliente } from '../comun/keycloak/keycloak-admin.cliente.js';
import { Usuario } from '../comun/keycloak/usuario.modelo.js';
import { MaterialesCliente } from '../materiales/materiales.cliente.js';
import { Material } from '../materiales/modelos/material.modelo.js';
import { Obra } from '../obras/modelos/obra.modelo.js';
import type { ObraRest } from '../obras/obras.cliente.js';
import { IaCliente } from './ia.cliente.js';
import {
  ConsumoAtipico,
  EstadoRevision,
} from './modelos/consumo-atipico.modelo.js';

/** 403: consumos atípicos de la obra (IA); si IA no responde, solo este campo vuelve null con SERVICIO_NO_DISPONIBLE. */
@Resolver(() => Obra)
export class ObraConsumosAtipicosResolver {
  constructor(private readonly iaCliente: IaCliente) {}

  @ResolveField(() => [ConsumoAtipico], { nullable: true })
  consumosAtipicos(
    @Parent() obra: ObraRest,
    @Context() contexto: ContextoGraphql,
    @Args('estado', { type: () => EstadoRevision, nullable: true })
    estado?: EstadoRevision | null,
  ): Promise<ConsumoAtipico[]> {
    return this.iaCliente.consumosAtipicos(
      { obraId: obra.id, estado },
      contexto,
    );
  }
}

/** 403: nombre del material (catálogo de Materiales, una vez por petición) y revisor (Keycloak, caché de 5 min). */
@Resolver(() => ConsumoAtipico)
export class ConsumoAtipicoResolver {
  constructor(
    private readonly materialesCliente: MaterialesCliente,
    private readonly keycloak: KeycloakAdminCliente,
  ) {}

  @ResolveField(() => Material, { nullable: true })
  async material(
    @Parent() consumo: ConsumoAtipico,
    @Context() contexto: ContextoGraphql,
  ): Promise<Material | null> {
    const catalogo = await this.materialesCliente.catalogoPorId(contexto);
    return catalogo.get(consumo.materialId) ?? null;
  }

  @ResolveField(() => Usuario, { nullable: true })
  revisadoPor(
    @Parent() consumo: ConsumoAtipico,
    @Context() contexto: ContextoGraphql,
  ): Promise<Usuario | null> {
    return consumo.revisadoPor
      ? this.keycloak.usuarioEnPeticion(consumo.revisadoPor, contexto)
      : Promise.resolve(null);
  }
}
