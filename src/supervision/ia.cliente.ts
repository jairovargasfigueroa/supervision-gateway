import { Injectable } from '@nestjs/common';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { cargador } from '../comun/dataloaders/dataloaders.js';
import { ClienteServicio } from '../comun/http/cliente-servicio.js';
import type {
  ConsumoAtipico,
  EstadoRevision,
} from './modelos/consumo-atipico.modelo.js';
import type { RiesgoRetraso } from './modelos/riesgo.modelo.js';
import { riesgoDesdePrediccion, sinPrediccion } from './riesgo.js';

/** Máximo de obras por llamada a `GET /predicciones` (más: `400 DEMASIADAS_OBRAS`, contrato de IA). */
export const OBRAS_POR_LOTE_IA = 100;

/** Historial que devuelve IA si no se pide otro (`GET /obras/{id}/prediccion`, 1 a 90). */
export const HISTORIAL_POR_DEFECTO = 30;

/** Clave del DataLoader de la predicción de una obra: `limite` solo para `historialRiesgo`. */
interface ClavePrediccionObra {
  obraId: string;
  limite?: number;
}

export type NivelRiesgoRest = 'BAJO' | 'MEDIO' | 'ALTO' | 'SIN_DATOS';

/** Predicción de una obra tal como la devuelve IA (`GET /predicciones`, 402). */
export interface PrediccionRest {
  obraId: string;
  /** null con `SIN_DATOS`. */
  probabilidad: number | null;
  nivel: NivelRiesgoRest;
  factores: { variable: string; descripcion: string; peso: number }[];
  versionModelo: string | null;
  calculadaEn: string | null;
}

/** `GET /obras/{obraId}/prediccion?historial=` (402): la predicción con su historial (del más antiguo al más reciente). */
export interface PrediccionObraRest extends PrediccionRest {
  historial: { probabilidad: number; calculadaEn: string }[];
}

/** `GET /modelos/riesgo-retraso` (402). */
export interface ModeloRiesgoRest {
  versionModelo: string;
  entrenadoEn: string;
  /** `SINTETICOS` o `REALES`; se pasa tal cual. */
  datos: string;
  filasEntrenamiento: number;
  metricas: {
    aucRoc: number;
    aucRocRegla: number;
    recallMedio: number;
    precisionAlto: number;
    brier: number;
  };
  umbrales: { medio: number; alto: number };
  variables: { nombre: string; descripcion: string }[];
}

/**
 * Llamadas REST al servicio de IA (docs/contratos.md, «Consume»). Pasan por ClienteServicio: token del usuario,
 * X-Request-Id, 3 s, un reintento en consultas y errores con `extensions.servicio = "ia"`.
 */
@Injectable()
export class IaCliente {
  constructor(private readonly cliente: ClienteServicio) {}

  /** `GET /predicciones?obraIds=a,b,c` (402): hasta 100 obras; solo vienen las visibles que tienen predicción. */
  predicciones(
    obraIds: readonly string[],
    contexto: ContextoGraphql,
  ): Promise<PrediccionRest[]> {
    return this.cliente.consultar<PrediccionRest[]>(
      'ia',
      `/predicciones?obraIds=${obraIds.map(encodeURIComponent).join(',')}`,
      contexto,
    );
  }

  /**
   * Riesgo de una obra con el DataLoader de la petición (402): todas las obras pedidas en la misma petición (filas e
   * indicador del tablero) se juntan en llamadas a `GET /predicciones` de hasta 100 obras, en paralelo. Una obra que
   * IA no devuelve queda `SIN_DATOS`.
   */
  riesgoEnLote(
    obraId: string,
    contexto: ContextoGraphql,
  ): Promise<RiesgoRetraso> {
    return cargador<string, RiesgoRetraso>(
      contexto,
      'prediccionesIa',
      async (obraIds) => {
        const predicciones = await this.predicciones(obraIds, contexto);
        const porObra = new Map(
          predicciones.map((prediccion) => [prediccion.obraId, prediccion]),
        );
        return obraIds.map((id) => {
          const prediccion = porObra.get(id);
          return prediccion
            ? riesgoDesdePrediccion(prediccion)
            : sinPrediccion();
        });
      },
      { maxBatchSize: OBRAS_POR_LOTE_IA },
    ).load(obraId);
  }

  /**
   * Predicción e historial de una obra con el DataLoader de la petición (402): `Obra.riesgoRetraso` y
   * `Obra.historialRiesgo(limite)` de la misma obra salen de **una sola** llamada a `GET /obras/{id}/prediccion`,
   * pedida con el mayor `limite` de la petición (30 si nadie pide historial); cada `historialRiesgo` recibe sus
   * últimos `limite` puntos. Si la llamada de una obra falla, solo los campos de esa obra reciben el error.
   */
  prediccionDeObra(
    obraId: string,
    limite: number | undefined,
    contexto: ContextoGraphql,
  ): Promise<PrediccionObraRest> {
    return cargador<ClavePrediccionObra, PrediccionObraRest, string>(
      contexto,
      'prediccionObraIa',
      async (claves) => {
        const historialPorObra = new Map<string, number | undefined>();
        for (const { obraId: id, limite: pedido } of claves) {
          const actual = historialPorObra.get(id);
          historialPorObra.set(
            id,
            pedido === undefined
              ? actual
              : Math.max(actual ?? Number.NEGATIVE_INFINITY, pedido),
          );
        }
        const respuestas = new Map(
          [...historialPorObra].map(([id, historial]) => [
            id,
            this.prediccionObra(
              id,
              historial ?? HISTORIAL_POR_DEFECTO,
              contexto,
            ).catch((error: unknown) =>
              error instanceof Error ? error : new Error(String(error)),
            ),
          ]),
        );
        return Promise.all(
          claves.map(async ({ obraId: id, limite: pedido }) => {
            const respuesta = await respuestas.get(id)!;
            if (respuesta instanceof Error || pedido === undefined)
              return respuesta;
            return {
              ...respuesta,
              historial: (respuesta.historial ?? []).slice(-pedido),
            };
          }),
        );
      },
      { cacheKeyFn: (clave) => `${clave.obraId}:${clave.limite ?? ''}` },
    ).load({ obraId, limite });
  }

  /** `GET /obras/{obraId}/prediccion?historial=N` (402); si no la ve, 404 OBRA_NO_ENCONTRADA. */
  prediccionObra(
    obraId: string,
    historial: number,
    contexto: ContextoGraphql,
  ): Promise<PrediccionObraRest> {
    return this.cliente.consultar<PrediccionObraRest>(
      'ia',
      `/obras/${encodeURIComponent(obraId)}/prediccion?historial=${historial}`,
      contexto,
    );
  }

  /**
   * `GET /consumos-atipicos?obraId=&estado=` (403): de la más reciente a la más antigua (máximo 200). Si el usuario no
   * ve la obra, 404 OBRA_NO_ENCONTRADA.
   */
  consumosAtipicos(
    filtros: { obraId: string; estado?: EstadoRevision | null },
    contexto: ContextoGraphql,
  ): Promise<ConsumoAtipico[]> {
    const parametros = new URLSearchParams({ obraId: filtros.obraId });
    if (filtros.estado) parametros.set('estado', filtros.estado);
    return this.cliente.consultar<ConsumoAtipico[]>(
      'ia',
      `/consumos-atipicos?${parametros.toString()}`,
      contexto,
    );
  }

  /** `GET /consumos-atipicos/resumen?obraIds=a,b,c` (403): hasta 100 obras; solo vienen las visibles. */
  resumenAtipicos(
    obraIds: readonly string[],
    contexto: ContextoGraphql,
  ): Promise<{ obraId: string; pendientes: number }[]> {
    return this.cliente.consultar<{ obraId: string; pendientes: number }[]>(
      'ia',
      `/consumos-atipicos/resumen?obraIds=${obraIds.map(encodeURIComponent).join(',')}`,
      contexto,
    );
  }

  /**
   * Consumos atípicos PENDIENTE de una obra con el DataLoader de la petición (403): todas las obras del tablero (filas e
   * indicador) se juntan en llamadas a `GET /consumos-atipicos/resumen` de hasta 100 obras, en paralelo. Una obra que
   * IA no devuelve cuenta 0.
   */
  pendientesEnLote(obraId: string, contexto: ContextoGraphql): Promise<number> {
    return cargador<string, number>(
      contexto,
      'atipicosPendientesIa',
      async (obraIds) => {
        const resumen = await this.resumenAtipicos(obraIds, contexto);
        const porObra = new Map(
          resumen.map((fila) => [fila.obraId, fila.pendientes]),
        );
        return obraIds.map((id) => porObra.get(id) ?? 0);
      },
      { maxBatchSize: OBRAS_POR_LOTE_IA },
    ).load(obraId);
  }

  /** `GET /modelos/riesgo-retraso` (402); sin modelo cargado, 503 MODELO_NO_DISPONIBLE. */
  modeloRiesgo(contexto: ContextoGraphql): Promise<ModeloRiesgoRest> {
    return this.cliente.consultar<ModeloRiesgoRest>(
      'ia',
      '/modelos/riesgo-retraso',
      contexto,
    );
  }
}
