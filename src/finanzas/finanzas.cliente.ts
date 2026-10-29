import { Injectable } from '@nestjs/common';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { cadaUno, cargador } from '../comun/dataloaders/dataloaders.js';
import { ClienteServicio } from '../comun/http/cliente-servicio.js';
import type { Cobro } from './modelos/cobro.modelo.js';

/** Contrato tal como lo devuelve Finanzas (`GET /contratos?obraId=`). */
export interface ContratoRest {
  id: string;
  obraId: string;
  monto: number;
  plazoDias: number;
  anticipoPct: number;
  retencionPct: number;
  firmadoEn: string;
  saldoDisponible: number;
  totalCobrado: number;
  totalReservado: number;
}

/** Página de `GET /cobros` (convenciones, «Listas y paginación»). */
export interface CobrosPaginaRest {
  items: (Cobro & { obraId: string })[];
  total: number;
  pagina: number;
  tamano: number;
}

/** Cantidad y monto de un grupo de cobros (`GET /cobros/resumen`, 009). */
export interface ResumenMontoRest {
  cantidad: number;
  monto: number;
}

/** `GET /cobros/resumen` (009). */
export interface ResumenCobrosRest {
  vencidos: ResumenMontoRest;
  porVencer30Dias: ResumenMontoRest;
}

/**
 * Llamadas REST a Finanzas (docs/contratos.md, «Consume»), con el DataLoader de la petición: cada obra se pide una
 * sola vez aunque varios campos la necesiten. Roles en Finanzas: admin y gerente.
 */
@Injectable()
export class FinanzasCliente {
  constructor(private readonly cliente: ClienteServicio) {}

  /** `GET /contratos?obraId=` (0 o 1 elemento): null si la obra todavía no tiene contrato en Finanzas. */
  contratoDeObra(
    obraId: string,
    contexto: ContextoGraphql,
  ): Promise<ContratoRest | null> {
    return cargador<string, ContratoRest | null>(
      contexto,
      'contratos',
      cadaUno(async (id) => {
        const contratos = await this.cliente.consultar<ContratoRest[]>(
          'finanzas',
          `/contratos?obraId=${encodeURIComponent(id)}`,
          contexto,
        );
        return contratos[0] ?? null;
      }),
    ).load(obraId);
  }

  /** `GET /cobros?obraId=&tamano=100` (contrato GraphQL: pide tamano=100; Finanzas ordena por vencimiento). */
  cobrosDeObra(obraId: string, contexto: ContextoGraphql): Promise<Cobro[]> {
    return cargador<string, Cobro[]>(
      contexto,
      'cobros',
      cadaUno(async (id) => {
        const pagina = await this.cliente.consultar<CobrosPaginaRest>(
          'finanzas',
          `/cobros?obraId=${encodeURIComponent(id)}&tamano=100`,
          contexto,
        );
        return pagina.items;
      }),
    ).load(obraId);
  }

  /** `GET /cobros/resumen` (009; roles admin y gerente): cobros vencidos y por vencer en 30 días. */
  resumenCobros(contexto: ContextoGraphql): Promise<ResumenCobrosRest> {
    return this.cliente.consultar<ResumenCobrosRest>(
      'finanzas',
      '/cobros/resumen',
      contexto,
    );
  }
}
