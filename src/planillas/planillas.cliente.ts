import { Injectable } from '@nestjs/common';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { ClienteServicio } from '../comun/http/cliente-servicio.js';
import type { EstadoPlanilla } from '../obras/modelos/obra-resumen.modelo.js';
import type { LineaPlanilla } from './modelos/planilla.modelo.js';

/** Elemento de `GET /obras/{obraId}/planillas` (007). */
export interface PlanillaResumenRest {
  id: string;
  numero: number;
  periodo: string;
  estado: EstadoPlanilla;
  neto: number;
  cobroId: string | null;
  cobroNumero: string | null;
}

/** Detalle de `GET /planillas/{id}` (007); lo devuelven también crear, guardar y presentar. */
export interface PlanillaRest {
  id: string;
  obraId: string;
  numero: number;
  periodo: string;
  estado: EstadoPlanilla;
  version: number;
  lineas: LineaPlanilla[];
  subtotal: number;
  descuentoAnticipo: number;
  retencion: number;
  neto: number;
  anticipoPct: number;
  retencionPct: number;
  observacion: string | null;
  cobroId: string | null;
  cobroNumero: string | null;
  fotoIds: string[];
}

/** Cuerpo de `PUT /planillas/{id}` (mismo JSON que la entrada GraphQL `GuardarPlanillaEntrada`). */
export interface GuardarPlanillaRest {
  version: number;
  lineas: { partidaId: string; cantidadPeriodo: number }[];
  fotoIds: string[];
}

/** Llamadas REST a Obras para las planillas (docs/contratos.md, «Consume»). Los errores llegan con su `codigo`. */
@Injectable()
export class PlanillasCliente {
  constructor(private readonly cliente: ClienteServicio) {}

  /** `GET /obras/{obraId}/planillas`. */
  deObra(
    obraId: string,
    contexto: ContextoGraphql,
  ): Promise<PlanillaResumenRest[]> {
    return this.cliente.consultar<PlanillaResumenRest[]>(
      'obras',
      `/obras/${encodeURIComponent(obraId)}/planillas`,
      contexto,
    );
  }

  /** `GET /planillas/{id}`; si el usuario no ve la obra, Obras responde 404. */
  obtener(id: string, contexto: ContextoGraphql): Promise<PlanillaRest> {
    return this.cliente.consultar<PlanillaRest>(
      'obras',
      `/planillas/${encodeURIComponent(id)}`,
      contexto,
    );
  }

  /** `POST /obras/{obraId}/planillas` (sin reintento): 409 PLANILLA_ABIERTA_EXISTE, 422 PERIODO_NO_POSTERIOR, … */
  crear(
    obraId: string,
    periodo: string,
    contexto: ContextoGraphql,
  ): Promise<PlanillaRest> {
    return this.cliente.enviar<PlanillaRest>(
      'obras',
      'POST',
      `/obras/${encodeURIComponent(obraId)}/planillas`,
      { periodo },
      contexto,
    );
  }

  /** `PUT /planillas/{id}` (sin reintento): 409 VERSION_DESACTUALIZADA, 422 SUPERA_CANTIDAD_CONTRATADA con errores[], … */
  guardar(
    id: string,
    entrada: GuardarPlanillaRest,
    contexto: ContextoGraphql,
  ): Promise<PlanillaRest> {
    return this.cliente.enviar<PlanillaRest>(
      'obras',
      'PUT',
      `/planillas/${encodeURIComponent(id)}`,
      entrada,
      contexto,
    );
  }

  /** `POST /planillas/{id}/presentar` (sin reintento): 409 VERSION_DESACTUALIZADA, 422 SUBTOTAL_CERO, … */
  presentar(
    id: string,
    version: number,
    contexto: ContextoGraphql,
  ): Promise<PlanillaRest> {
    return this.cliente.enviar<PlanillaRest>(
      'obras',
      'POST',
      `/planillas/${encodeURIComponent(id)}/presentar`,
      { version },
      contexto,
    );
  }
}
