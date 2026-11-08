import type { PrediccionRest } from './ia.cliente.js';
import { NivelRiesgo, type RiesgoRetraso } from './modelos/riesgo.modelo.js';

/** Obra sin predicción en IA (402): «Sin datos suficientes». */
export function sinPrediccion(): RiesgoRetraso {
  return {
    probabilidad: null,
    nivel: NivelRiesgo.SIN_DATOS,
    factores: [],
    versionModelo: null,
    calculadaEn: null,
  };
}

/** RiesgoRetraso desde la predicción de IA (mismos nombres; sin `obraId` ni `historial`). */
export function riesgoDesdePrediccion(
  prediccion: PrediccionRest,
): RiesgoRetraso {
  return {
    probabilidad: prediccion.probabilidad ?? null,
    nivel: prediccion.nivel as NivelRiesgo,
    factores: prediccion.factores ?? [],
    versionModelo: prediccion.versionModelo ?? null,
    calculadaEn: prediccion.calculadaEn ?? null,
  };
}
