import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { unaVezPorPeticion } from '../comun/dataloaders/dataloaders.js';
import {
  EstadoObra,
  type ObraResumen,
} from '../obras/modelos/obra-resumen.modelo.js';
import type { ObrasCliente } from '../obras/obras.cliente.js';

/**
 * Obras EN_EJECUCION que ve el usuario, pedidas una sola vez por petición (las usan las filas y los indicadores del
 * tablero, también los de IA: 402).
 */
export function obrasEnEjecucion(
  obrasCliente: ObrasCliente,
  contexto: ContextoGraphql,
): Promise<ObraResumen[]> {
  return unaVezPorPeticion(contexto, 'tableroObras', () =>
    obrasCliente.listar({ estado: EstadoObra.EN_EJECUCION }, contexto),
  );
}
