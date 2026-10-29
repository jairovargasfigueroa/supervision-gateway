import { GraphQLError } from 'graphql';
import type { MaterialPrevistoRest } from '../obras/obras.cliente.js';
import type { ConsumoRest } from './materiales.cliente.js';
import type {
  ComparacionMaterial,
  FilaComparacion,
} from './modelos/comparacion-material.modelo.js';
import type { Material } from './modelos/material.modelo.js';

/** Las cantidades tienen hasta 3 decimales (convenciones): se comparan en milésimas, sin errores de redondeo. */
const milesimas = (cantidad: number) => Math.round(cantidad * 1000);

/**
 * Une el material previsto del periodo (Obras) con lo usado (Materiales) por partida y material. Una fila por cada
 * par que aparece en alguno de los dos; lo que falta de un lado cuenta como 0. Orden: el de las partidas de la obra
 * y, dentro de cada partida, por código de material.
 */
export function compararMaterial(
  partidas: readonly { id: string; codigo: string }[],
  previsto: MaterialPrevistoRest,
  consumos: readonly ConsumoRest[],
  catalogo: ReadonlyMap<string, Material>,
): ComparacionMaterial {
  const filas = new Map<
    string,
    { partidaId: string; materialId: string; previsto: number; usado: number }
  >();
  const fila = (partidaId: string, materialId: string) => {
    const clave = `${partidaId}|${materialId}`;
    let encontrada = filas.get(clave);
    if (!encontrada) {
      encontrada = { partidaId, materialId, previsto: 0, usado: 0 };
      filas.set(clave, encontrada);
    }
    return encontrada;
  };
  for (const item of previsto.items)
    fila(item.partidaId, item.materialId).previsto += item.cantidadPrevista;
  for (const consumo of consumos)
    fila(consumo.partidaId, consumo.materialId).usado += consumo.cantidad;

  const posicion = new Map(partidas.map((partida, i) => [partida.id, i]));
  const codigo = new Map(
    partidas.map((partida) => [partida.id, partida.codigo]),
  );

  const resultado: FilaComparacion[] = [...filas.values()].map((datos) => {
    const material = catalogo.get(datos.materialId);
    if (!material) {
      // Obras y Materiales referencian un material que no está en el catálogo: datos inconsistentes
      throw new GraphQLError('Material no encontrado en el catálogo', {
        extensions: {
          codigo: 'ERROR_INTERNO',
          servicio: 'materiales',
          materialId: datos.materialId,
        },
      });
    }
    const previstoM = milesimas(datos.previsto);
    const usadoM = milesimas(datos.usado);
    return {
      partidaId: datos.partidaId,
      partidaCodigo: codigo.get(datos.partidaId) ?? '',
      material,
      previsto: previstoM / 1000,
      usado: usadoM / 1000,
      diferencia: (usadoM - previstoM) / 1000,
      // usado > 1,20 × previsto ⇔ 5 × usado > 6 × previsto (en milésimas enteras)
      excedido: 5 * usadoM > 6 * previstoM,
    };
  });

  resultado.sort(
    (a, b) =>
      (posicion.get(a.partidaId) ?? Infinity) -
        (posicion.get(b.partidaId) ?? Infinity) ||
      a.material.codigo.localeCompare(b.material.codigo, 'es'),
  );
  return {
    periodo: previsto.periodo,
    hayPlanilla: previsto.hayPlanilla,
    filas: resultado,
  };
}
