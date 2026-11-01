import type { EjecucionAgenteRest } from './ia.cliente.js';
import type { EjecucionAgente, Hallazgo } from './modelos/agente.modelo.js';

/**
 * `GET /ejecuciones/{id}` (502) manda los hallazgos sin `ejecucionId`, `agente` ni `detectadoEn` (los trae solo
 * `GET /hallazgos`); salen de la propia ejecución. `detectadoEn` = `terminadaEn` (502: «detectadoEn (= terminadaEn)»);
 * si IA ya los manda, se respetan.
 */
export function ejecucionDesdeRest(
  ejecucion: EjecucionAgenteRest,
): EjecucionAgente {
  return {
    ...ejecucion,
    hallazgos: ejecucion.hallazgos.map((hallazgo) => ({
      ...hallazgo,
      ejecucionId: hallazgo.ejecucionId ?? ejecucion.id,
      agente: hallazgo.agente ?? ejecucion.agente,
      detectadoEn:
        hallazgo.detectadoEn ?? ejecucion.terminadaEn ?? ejecucion.iniciadaEn,
    })) as Hallazgo[],
  } as EjecucionAgente;
}
