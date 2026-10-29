import { Injectable } from '@nestjs/common';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { ClienteServicio } from '../comun/http/cliente-servicio.js';
import type { EstadoObra, ObraResumen } from './modelos/obra-resumen.modelo.js';

/** Llamadas REST a Obras (docs/contratos.md, «Consume»). */
@Injectable()
export class ObrasCliente {
  constructor(private readonly cliente: ClienteServicio) {}

  listar(filtros: { estado?: EstadoObra; busqueda?: string }, contexto: ContextoGraphql): Promise<ObraResumen[]> {
    const parametros = new URLSearchParams();
    if (filtros.estado) parametros.set('estado', filtros.estado);
    if (filtros.busqueda) parametros.set('busqueda', filtros.busqueda);
    const consulta = parametros.size ? `?${parametros.toString()}` : '';
    return this.cliente.consultar<ObraResumen[]>('obras', `/obras${consulta}`, contexto);
  }
}
