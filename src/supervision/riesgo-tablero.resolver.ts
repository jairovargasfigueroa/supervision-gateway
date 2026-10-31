import { Context, Int, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { ObrasCliente } from '../obras/obras.cliente.js';
import {
  FilaTablero,
  IndicadoresTablero,
} from '../tablero/modelos/tablero.modelo.js';
import { obrasEnEjecucion } from '../tablero/obras-tablero.js';
import { IaCliente } from './ia.cliente.js';
import { NivelRiesgo, RiesgoRetraso } from './modelos/riesgo.modelo.js';

/**
 * 402: riesgo del modelo en cada fila del tablero. Todas las filas en lotes de hasta 100 obras a `GET /predicciones`
 * (DataLoader de la petición); si IA no responde, solo este campo vuelve null con SERVICIO_NO_DISPONIBLE.
 */
@Resolver(() => FilaTablero)
export class FilaTableroRiesgoResolver {
  constructor(private readonly iaCliente: IaCliente) {}

  @ResolveField(() => RiesgoRetraso, { nullable: true })
  riesgoRetraso(
    @Parent() fila: FilaTablero,
    @Context() contexto: ContextoGraphql,
  ): Promise<RiesgoRetraso> {
    return this.iaCliente.riesgoEnLote(fila.obraId, contexto);
  }
}

/** 402: obras del tablero con nivel ALTO; usa el mismo lote que las filas (null si IA u Obras no responden). */
@Resolver(() => IndicadoresTablero)
export class IndicadoresRiesgoResolver {
  constructor(
    private readonly obrasCliente: ObrasCliente,
    private readonly iaCliente: IaCliente,
  ) {}

  @ResolveField(() => Int, { nullable: true })
  async obrasRiesgoAlto(@Context() contexto: ContextoGraphql): Promise<number> {
    const obras = await obrasEnEjecucion(this.obrasCliente, contexto);
    const riesgos = await Promise.all(
      obras.map((obra) => this.iaCliente.riesgoEnLote(obra.id, contexto)),
    );
    return riesgos.filter((riesgo) => riesgo.nivel === NivelRiesgo.ALTO).length;
  }
}
