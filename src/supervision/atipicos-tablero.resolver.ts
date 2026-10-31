import { Context, Int, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { ObrasCliente } from '../obras/obras.cliente.js';
import {
  FilaTablero,
  IndicadoresTablero,
} from '../tablero/modelos/tablero.modelo.js';
import { obrasEnEjecucion } from '../tablero/obras-tablero.js';
import { IaCliente } from './ia.cliente.js';

/**
 * 403: consumos atípicos PENDIENTE de cada fila del tablero, en lotes de hasta 100 obras a
 * `GET /consumos-atipicos/resumen`; si IA no responde, solo este campo vuelve null con SERVICIO_NO_DISPONIBLE.
 */
@Resolver(() => FilaTablero)
export class FilaTableroAtipicosResolver {
  constructor(private readonly iaCliente: IaCliente) {}

  @ResolveField(() => Int, { nullable: true })
  consumosAtipicosPendientes(
    @Parent() fila: FilaTablero,
    @Context() contexto: ContextoGraphql,
  ): Promise<number> {
    return this.iaCliente.pendientesEnLote(fila.obraId, contexto);
  }
}

/** 403: suma de los pendientes de las obras del tablero, con el mismo lote (null si IA u Obras no responden). */
@Resolver(() => IndicadoresTablero)
export class IndicadoresAtipicosResolver {
  constructor(
    private readonly obrasCliente: ObrasCliente,
    private readonly iaCliente: IaCliente,
  ) {}

  @ResolveField(() => Int, { nullable: true })
  async consumosAtipicosPendientes(
    @Context() contexto: ContextoGraphql,
  ): Promise<number> {
    const obras = await obrasEnEjecucion(this.obrasCliente, contexto);
    const pendientes = await Promise.all(
      obras.map((obra) => this.iaCliente.pendientesEnLote(obra.id, contexto)),
    );
    return pendientes.reduce((suma, cantidad) => suma + cantidad, 0);
  }
}
