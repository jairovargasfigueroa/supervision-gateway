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
}
