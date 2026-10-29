import { Context, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { tieneAlgunRol } from '../comun/auth/roles-efectivos.js';
import { Obra } from '../obras/modelos/obra.modelo.js';
import type { ObraRest } from '../obras/obras.cliente.js';
import { FinanzasCliente } from './finanzas.cliente.js';
import { Cobro } from './modelos/cobro.modelo.js';
import { FinanzasObra } from './modelos/finanzas-obra.modelo.js';

/** Roles que ven los datos de Finanzas de una obra (contrato GraphQL). */
const ROLES_FINANZAS = ['admin', 'gerente'];

/**
 * 006: campos de Obra que vienen de Finanzas. Para otros roles vuelven null sin error y sin llamar a Finanzas; si
 * Finanzas no responde, solo estos campos vuelven null con SERVICIO_NO_DISPONIBLE.
 */
@Resolver(() => Obra)
export class FinanzasResolver {
  constructor(private readonly finanzasCliente: FinanzasCliente) {}

  @ResolveField(() => FinanzasObra, { nullable: true })
  async finanzas(
    @Parent() obra: ObraRest,
    @Context() contexto: ContextoGraphql,
  ): Promise<FinanzasObra | null> {
    if (!tieneAlgunRol(contexto.req.usuario, ROLES_FINANZAS)) return null;
    const contrato = await this.finanzasCliente.contratoDeObra(
      obra.id,
      contexto,
    );
    if (!contrato) return null;
    const { saldoDisponible, totalCobrado, totalReservado } = contrato;
    return { saldoDisponible, totalCobrado, totalReservado };
  }

  @ResolveField(() => [Cobro], { nullable: true })
  cobros(
    @Parent() obra: ObraRest,
    @Context() contexto: ContextoGraphql,
  ): Promise<Cobro[] | null> {
    if (!tieneAlgunRol(contexto.req.usuario, ROLES_FINANZAS))
      return Promise.resolve(null);
    return this.finanzasCliente.cobrosDeObra(obra.id, contexto);
  }
}
