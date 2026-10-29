import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { EstadoObra, ObraResumen } from './modelos/obra-resumen.modelo.js';
import { ObrasCliente } from './obras.cliente.js';

@Resolver(() => ObraResumen)
export class ObrasResolver {
  constructor(private readonly obras: ObrasCliente) {}

  /** Lista de obras que ve el usuario; Obras filtra por visibilidad (fase 1: siempre vacía; la completa la 006). */
  @Query(() => [ObraResumen])
  obras(
    @Context() contexto: ContextoGraphql,
    @Args('estado', { type: () => EstadoObra, nullable: true }) estado?: EstadoObra,
    @Args('busqueda', { nullable: true }) busqueda?: string,
  ): Promise<ObraResumen[]> {
    return this.obras.listar({ estado, busqueda }, contexto);
  }
}
