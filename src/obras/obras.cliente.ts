import { Injectable } from '@nestjs/common';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { ClienteServicio } from '../comun/http/cliente-servicio.js';
import type { EstadoObra, ObraResumen } from './modelos/obra-resumen.modelo.js';

/** Detalle de la obra tal como lo devuelve Obras (`GET /obras/{id}` y `POST /obras`). */
export interface ObraRest {
  id: string;
  nombre: string;
  ubicacion: string;
  estado: EstadoObra;
  motivoRechazoContrato: string | null;
  fechaInicio: string;
  asignaciones: {
    residenteId: string;
    maestroId: string;
    almaceneroId: string;
    clienteId: string;
  };
  contrato: {
    contratoId: string | null;
    monto: number;
    plazoDias: number;
    anticipoPct: number;
    retencionPct: number;
  };
  avancePct: number;
  plazoPct: number;
  enRiesgo: boolean;
  partidas: {
    id: string;
    codigo: string;
    nombre: string;
    unidad: string;
    cantidadContratada: number;
    precioUnitario: number;
    meses: string | null;
    ejecutadaAcumulada: number;
    avancePct: number;
    insumos: { materialId: string; cantidadPorUnidad: number }[];
  }[];
}

/** Cuerpo de `POST /obras` (mismo JSON que la entrada GraphQL `RegistrarObraEntrada`). */
export interface RegistrarObraRest {
  nombre: string;
  ubicacion: string;
  fechaInicio: string;
  asignaciones: {
    residenteId: string;
    maestroId: string;
    almaceneroId: string;
    clienteId: string;
  };
  contrato: {
    monto: number;
    plazoDias: number;
    anticipoPct: number;
    retencionPct: number;
    firmadoEn: string;
  };
  partidas: {
    codigo: string;
    nombre: string;
    unidad: string;
    cantidadContratada: number;
    precioUnitario: number;
    meses?: string | null;
    insumos?: { materialId: string; cantidadPorUnidad: number }[] | null;
  }[];
}

/** Llamadas REST a Obras (docs/contratos.md, «Consume»). Los errores llegan con su `codigo` (ClienteServicio). */
@Injectable()
export class ObrasCliente {
  constructor(private readonly cliente: ClienteServicio) {}

  listar(
    filtros: { estado?: EstadoObra; busqueda?: string },
    contexto: ContextoGraphql,
  ): Promise<ObraResumen[]> {
    const parametros = new URLSearchParams();
    if (filtros.estado) parametros.set('estado', filtros.estado);
    if (filtros.busqueda) parametros.set('busqueda', filtros.busqueda);
    const consulta = parametros.size ? `?${parametros.toString()}` : '';
    return this.cliente.consultar<ObraResumen[]>(
      'obras',
      `/obras${consulta}`,
      contexto,
    );
  }

  /** `GET /obras/{id}`; si el usuario no la ve, Obras responde 404 OBRA_NO_ENCONTRADA. */
  obtener(id: string, contexto: ContextoGraphql): Promise<ObraRest> {
    return this.cliente.consultar<ObraRest>(
      'obras',
      `/obras/${encodeURIComponent(id)}`,
      contexto,
    );
  }

  /** `POST /obras` (002): sin reintento; los 422 llegan con su codigo (PRESUPUESTO_NO_COINCIDE, …). */
  registrar(
    entrada: RegistrarObraRest,
    contexto: ContextoGraphql,
  ): Promise<ObraRest> {
    return this.cliente.enviar<ObraRest>(
      'obras',
      'POST',
      '/obras',
      entrada,
      contexto,
    );
  }
}
