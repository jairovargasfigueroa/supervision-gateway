import { Injectable } from '@nestjs/common';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { ClienteServicio } from '../comun/http/cliente-servicio.js';
import type { Material, MaterialesPagina } from './modelos/material.modelo.js';
import type { StockMaterial } from './modelos/stock-material.modelo.js';

export interface FiltrosMateriales {
  busqueda?: string;
  soloActivos?: boolean;
  pagina?: number;
  tamano?: number;
}

/** Cuerpo de `POST /materiales` y `PUT /materiales/{id}` (mismo JSON que la entrada GraphQL `MaterialEntrada`). */
export interface MaterialRest {
  codigo: string;
  nombre: string;
  tipo: Material['tipo'];
  unidad: string;
  unidadPlural: string;
  precioReferencial: number;
  activo?: boolean | null;
  atributos?: { nombre: string; valor: string }[] | null;
}

/** Llamadas REST a Materiales (docs/contratos.md, «Consume»). Los errores llegan con su `codigo` (ClienteServicio). */
@Injectable()
export class MaterialesCliente {
  constructor(private readonly cliente: ClienteServicio) {}

  /** `GET /materiales` paginado (convenciones); Materiales ordena por código. */
  listar(
    filtros: FiltrosMateriales,
    contexto: ContextoGraphql,
  ): Promise<MaterialesPagina> {
    const parametros = new URLSearchParams();
    if (filtros.busqueda) parametros.set('busqueda', filtros.busqueda);
    if (filtros.soloActivos !== undefined && filtros.soloActivos !== null) {
      parametros.set('soloActivos', String(filtros.soloActivos));
    }
    if (filtros.pagina !== undefined)
      parametros.set('pagina', String(filtros.pagina));
    if (filtros.tamano !== undefined)
      parametros.set('tamano', String(filtros.tamano));
    const consulta = parametros.size ? `?${parametros.toString()}` : '';
    return this.cliente.consultar<MaterialesPagina>(
      'materiales',
      `/materiales${consulta}`,
      contexto,
    );
  }

  /** `GET /obras/{obraId}/stock`; si el usuario no ve la obra, Materiales responde 404 OBRA_NO_ENCONTRADA. */
  stockObra(
    obraId: string,
    contexto: ContextoGraphql,
  ): Promise<StockMaterial[]> {
    return this.cliente.consultar<StockMaterial[]>(
      'materiales',
      `/obras/${encodeURIComponent(obraId)}/stock`,
      contexto,
    );
  }

  /** `POST /materiales` (sin reintento); `409 CODIGO_MATERIAL_REPETIDO` llega con su codigo. */
  crear(entrada: MaterialRest, contexto: ContextoGraphql): Promise<Material> {
    return this.cliente.enviar<Material>(
      'materiales',
      'POST',
      '/materiales',
      entrada,
      contexto,
    );
  }

  /** `PUT /materiales/{id}` con el material completo (incluye `activo`). */
  actualizar(
    id: string,
    entrada: MaterialRest,
    contexto: ContextoGraphql,
  ): Promise<Material> {
    return this.cliente.enviar<Material>(
      'materiales',
      'PUT',
      `/materiales/${encodeURIComponent(id)}`,
      entrada,
      contexto,
    );
  }

  /** `PUT /obras/{obraId}/stock/{materialId}/minimo` (upsert de la fila de stock). */
  definirMinimo(
    obraId: string,
    materialId: string,
    minimo: number,
    contexto: ContextoGraphql,
  ): Promise<StockMaterial> {
    return this.cliente.enviar<StockMaterial>(
      'materiales',
      'PUT',
      `/obras/${encodeURIComponent(obraId)}/stock/${encodeURIComponent(materialId)}/minimo`,
      { minimo },
      contexto,
    );
  }
}
