import { Injectable } from '@nestjs/common';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import {
  cargador,
  unaVezPorPeticion,
} from '../comun/dataloaders/dataloaders.js';
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

/** Consumo del periodo por partida y material (`GET /obras/{obraId}/consumos`). */
export interface ConsumoRest {
  partidaId: string;
  materialId: string;
  cantidad: number;
}

/** Materiales en estado BAJO de una obra (`GET /stock/resumen?obraIds=`, 009). */
export interface ResumenStockRest {
  obraId: string;
  materialesBajos: number;
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

  /**
   * Catálogo completo (activos e inactivos), para poner nombre a los materiales de una obra (006). `GET /materiales`
   * no filtra por id: se pide de a 100 (máximo de la paginación) y las páginas restantes en paralelo.
   */
  async catalogo(contexto: ContextoGraphql): Promise<Material[]> {
    const tamano = 100;
    const primera = await this.listar({ pagina: 1, tamano }, contexto);
    const paginas = Math.ceil(primera.total / tamano);
    const resto = await Promise.all(
      Array.from({ length: Math.max(paginas - 1, 0) }, (_, i) =>
        this.listar({ pagina: i + 2, tamano }, contexto),
      ),
    );
    return [primera, ...resto].flatMap((pagina) => pagina.items);
  }

  /** El catálogo indexado por id, pedido una sola vez por petición (DataLoader de la petición). */
  catalogoPorId(contexto: ContextoGraphql): Promise<Map<string, Material>> {
    return unaVezPorPeticion(
      contexto,
      'catalogoMateriales',
      async () =>
        new Map(
          (await this.catalogo(contexto)).map((material) => [
            material.id,
            material,
          ]),
        ),
    );
  }

  /** `GET /obras/{obraId}/consumos?periodo=AAAA-MM` (006): suma de salidas por partida y material. */
  consumos(
    obraId: string,
    periodo: string,
    contexto: ContextoGraphql,
  ): Promise<ConsumoRest[]> {
    return this.cliente.consultar<ConsumoRest[]>(
      'materiales',
      `/obras/${encodeURIComponent(obraId)}/consumos?periodo=${encodeURIComponent(periodo)}`,
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

  /** `GET /stock/resumen?obraIds=a,b,c` (009): solo devuelve las obras pedidas que el usuario puede ver. */
  resumenStock(
    obraIds: readonly string[],
    contexto: ContextoGraphql,
  ): Promise<ResumenStockRest[]> {
    return this.cliente.consultar<ResumenStockRest[]>(
      'materiales',
      `/stock/resumen?obraIds=${obraIds.map(encodeURIComponent).join(',')}`,
      contexto,
    );
  }

  /**
   * Materiales BAJO de una obra con el DataLoader de la petición (009): todas las obras pedidas en la misma petición
   * se resuelven con una sola llamada a `GET /stock/resumen`. Una obra que Materiales no devuelve cuenta 0.
   */
  materialesBajos(obraId: string, contexto: ContextoGraphql): Promise<number> {
    return cargador<string, number>(
      contexto,
      'materialesBajos',
      async (obraIds) => {
        const resumen = await this.resumenStock(obraIds, contexto);
        const porObra = new Map(
          resumen.map((fila) => [fila.obraId, fila.materialesBajos]),
        );
        return obraIds.map((id) => porObra.get(id) ?? 0);
      },
    ).load(obraId);
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
