import type { ObraResumen } from '../obras/modelos/obra-resumen.modelo.js';
import type { FilaTablero } from './modelos/tablero.modelo.js';

/**
 * Fila del tablero desde el resumen de la obra de Obras (009). `diferencia` = plazo − avance, calculada en centésimas
 * (los porcentajes llegan con 2 decimales) para no arrastrar errores de coma flotante. El orden es el de Obras; el
 * ERP ordena la tabla.
 */
export function filaTablero(obra: ObraResumen): FilaTablero {
  return {
    obraId: obra.id,
    nombre: obra.nombre,
    avancePct: obra.avancePct,
    plazoPct: obra.plazoPct,
    diferencia:
      (Math.round(obra.plazoPct * 100) - Math.round(obra.avancePct * 100)) /
      100,
    enRiesgo: obra.enRiesgo,
    ultimaPlanilla: obra.ultimaPlanilla ?? null,
  };
}
