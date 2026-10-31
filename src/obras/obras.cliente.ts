import { Injectable } from '@nestjs/common';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { ClienteServicio } from '../comun/http/cliente-servicio.js';
import type { FotosPagina } from './modelos/foto.modelo.js';
import type {
  EstadoObra,
  ObraResumen,
  ZonaObra,
} from './modelos/obra-resumen.modelo.js';

/** Detalle de la obra tal como lo devuelve Obras (`GET /obras/{id}` y `POST /obras`). */
export interface ObraRest {
  id: string;
  nombre: string;
  ubicacion: string;
  /** 401: null = sin zona. */
  zona?: ZonaObra | null;
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
  zona?: ZonaObra | null;
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

/** Material previsto del periodo (`GET /obras/{id}/material-previsto`, 006). */
export interface MaterialPrevistoRest {
  periodo: string;
  hayPlanilla: boolean;
  items: { partidaId: string; materialId: string; cantidadPrevista: number }[];
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

  /** `GET /obras/{id}/material-previsto?periodo=AAAA-MM` (006): previsto 0 y `hayPlanilla: false` sin planilla. */
  materialPrevisto(
    id: string,
    periodo: string,
    contexto: ContextoGraphql,
  ): Promise<MaterialPrevistoRest> {
    return this.cliente.consultar<MaterialPrevistoRest>(
      'obras',
      `/obras/${encodeURIComponent(id)}/material-previsto?periodo=${encodeURIComponent(periodo)}`,
      contexto,
    );
  }

  /** `GET /obras/{id}/fotos?partidaId=&pagina=&tamano=` (005): página de fotos, de la más reciente a la más antigua. */
  fotos(
    id: string,
    filtros: { partidaId?: string | null; pagina: number; tamano: number },
    contexto: ContextoGraphql,
  ): Promise<FotosPagina> {
    const parametros = new URLSearchParams();
    if (filtros.partidaId) parametros.set('partidaId', filtros.partidaId);
    parametros.set('pagina', String(filtros.pagina));
    parametros.set('tamano', String(filtros.tamano));
    return this.cliente.consultar<FotosPagina>(
      'obras',
      `/obras/${encodeURIComponent(id)}/fotos?${parametros.toString()}`,
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
