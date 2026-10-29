import {
  Context,
  Int,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { tieneAlgunRol } from '../comun/auth/roles-efectivos.js';
import { Roles } from '../comun/auth/roles.decorator.js';
import { unaVezPorPeticion } from '../comun/dataloaders/dataloaders.js';
import { FinanzasCliente } from '../finanzas/finanzas.cliente.js';
import { MaterialesCliente } from '../materiales/materiales.cliente.js';
import {
  EstadoObra,
  type ObraResumen,
} from '../obras/modelos/obra-resumen.modelo.js';
import { ObrasCliente } from '../obras/obras.cliente.js';
import { filaTablero } from './filas.js';
import {
  FilaTablero,
  IndicadoresTablero,
  ResumenMonto,
  Tablero,
} from './modelos/tablero.modelo.js';

/** Roles que ven los cobros vencidos (contrato GraphQL). */
const ROLES_FINANZAS = ['admin', 'gerente'];

/** Obras EN_EJECUCION que ve el usuario, pedidas una sola vez por petición (las usan las filas y los indicadores). */
function obrasEnEjecucion(
  obrasCliente: ObrasCliente,
  contexto: ContextoGraphql,
): Promise<ObraResumen[]> {
  return unaVezPorPeticion(contexto, 'tableroObras', () =>
    obrasCliente.listar({ estado: EstadoObra.EN_EJECUCION }, contexto),
  );
}

/**
 * 009: tablero de Supervisión. `tablero` no llama a nadie; cada parte la resuelve su @ResolveField, así que si un
 * servicio no responde solo sus campos vuelven null con SERVICIO_NO_DISPONIBLE y el resto llega.
 */
@Resolver(() => Tablero)
export class TableroResolver {
  constructor(private readonly obrasCliente: ObrasCliente) {}

  @Roles('admin', 'gerente', 'residente')
  @Query(() => Tablero)
  tablero(): Tablero {
    return {};
  }

  @ResolveField(() => IndicadoresTablero, { nullable: true })
  indicadores(): IndicadoresTablero {
    return {};
  }

  @ResolveField(() => [FilaTablero], { nullable: true })
  async obras(@Context() contexto: ContextoGraphql): Promise<FilaTablero[]> {
    return (await obrasEnEjecucion(this.obrasCliente, contexto)).map(
      filaTablero,
    );
  }
}

/** Materiales bajos de cada fila: todas las filas en una sola llamada a Materiales (DataLoader de la petición). */
@Resolver(() => FilaTablero)
export class FilaTableroResolver {
  constructor(private readonly materialesCliente: MaterialesCliente) {}

  @ResolveField(() => Int, { nullable: true })
  materialesBajos(
    @Parent() fila: FilaTablero,
    @Context() contexto: ContextoGraphql,
  ): Promise<number> {
    return this.materialesCliente.materialesBajos(fila.obraId, contexto);
  }
}

/** Indicadores: obras en ejecución y en riesgo (Obras), materiales bajos (Materiales) y cobros vencidos (Finanzas). */
@Resolver(() => IndicadoresTablero)
export class IndicadoresTableroResolver {
  constructor(
    private readonly obrasCliente: ObrasCliente,
    private readonly materialesCliente: MaterialesCliente,
    private readonly finanzasCliente: FinanzasCliente,
  ) {}

  @ResolveField(() => Int, { nullable: true })
  async obrasEnEjecucion(
    @Context() contexto: ContextoGraphql,
  ): Promise<number> {
    return (await obrasEnEjecucion(this.obrasCliente, contexto)).length;
  }

  @ResolveField(() => Int, { nullable: true })
  async obrasEnRiesgo(@Context() contexto: ContextoGraphql): Promise<number> {
    return (await obrasEnEjecucion(this.obrasCliente, contexto)).filter(
      (obra) => obra.enRiesgo,
    ).length;
  }

  /** Suma de las obras del tablero; usa el mismo DataLoader que las filas (una sola llamada a Materiales). */
  @ResolveField(() => Int, { nullable: true })
  async materialesBajos(@Context() contexto: ContextoGraphql): Promise<number> {
    const obras = await obrasEnEjecucion(this.obrasCliente, contexto);
    const cantidades = await Promise.all(
      obras.map((obra) =>
        this.materialesCliente.materialesBajos(obra.id, contexto),
      ),
    );
    return cantidades.reduce((suma, cantidad) => suma + cantidad, 0);
  }

  /** null sin error (y sin llamar a Finanzas) si el rol efectivo no es admin ni gerente. */
  @ResolveField(() => ResumenMonto, { nullable: true })
  async cobrosVencidos(
    @Context() contexto: ContextoGraphql,
  ): Promise<ResumenMonto | null> {
    if (!tieneAlgunRol(contexto.req.usuario, ROLES_FINANZAS)) return null;
    return (await this.finanzasCliente.resumenCobros(contexto)).vencidos;
  }
}
