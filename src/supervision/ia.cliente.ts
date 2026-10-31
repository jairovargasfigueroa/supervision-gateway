import { Injectable } from '@nestjs/common';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { ClienteServicio } from '../comun/http/cliente-servicio.js';

/** Máximo de obras por llamada a `GET /predicciones` (más: `400 DEMASIADAS_OBRAS`, contrato de IA). */
export const OBRAS_POR_LOTE_IA = 100;

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

  /** `GET /modelos/riesgo-retraso` (402); sin modelo cargado, 503 MODELO_NO_DISPONIBLE. */
  modeloRiesgo(contexto: ContextoGraphql): Promise<ModeloRiesgoRest> {
    return this.cliente.consultar<ModeloRiesgoRest>(
      'ia',
      '/modelos/riesgo-retraso',
      contexto,
    );
  }
}
