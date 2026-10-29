import { Args, Context, ID, Int, Query, Resolver } from '@nestjs/graphql';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { Roles } from '../comun/auth/roles.decorator.js';
import { MaterialesCliente } from './materiales.cliente.js';
import { MaterialesPagina } from './modelos/material.modelo.js';
import { StockMaterial } from './modelos/stock-material.modelo.js';

/** 003: catálogo de materiales y stock mínimo por obra. Las reglas (código único, visibilidad, estado) las aplica Materiales. */
@Resolver()
export class MaterialesResolver {
  constructor(private readonly materialesCliente: MaterialesCliente) {}

  /** Catálogo paginado con búsqueda por código o nombre. */
  @Roles('admin', 'gerente', 'residente')
  @Query(() => MaterialesPagina)
  materiales(
    @Context() contexto: ContextoGraphql,
    @Args('busqueda', { type: () => String, nullable: true }) busqueda?: string,
    @Args('soloActivos', { type: () => Boolean, nullable: true }) soloActivos?: boolean,
    @Args('pagina', { type: () => Int, defaultValue: 1 }) pagina?: number,
    @Args('tamano', { type: () => Int, defaultValue: 20 }) tamano?: number,
  ): Promise<MaterialesPagina> {
    return this.materialesCliente.listar({ busqueda, soloActivos, pagina, tamano }, contexto);
  }

  /** Stock de la obra; si el usuario no la ve, Materiales responde 404 y llega OBRA_NO_ENCONTRADA. */
  @Roles('admin', 'gerente', 'residente')
  @Query(() => [StockMaterial])
  stockObra(
    @Context() contexto: ContextoGraphql,
    @Args('obraId', { type: () => ID }) obraId: string,
  ): Promise<StockMaterial[]> {
    return this.materialesCliente.stockObra(obraId, contexto);
  }
}
