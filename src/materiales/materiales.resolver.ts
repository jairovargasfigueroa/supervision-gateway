import {
  Args,
  Context,
  Float,
  ID,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { Roles } from '../comun/auth/roles.decorator.js';
import { MaterialEntrada } from './entradas/material.entrada.js';
import { MaterialesCliente } from './materiales.cliente.js';
import { Material, MaterialesPagina } from './modelos/material.modelo.js';
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
    @Args('soloActivos', { type: () => Boolean, nullable: true })
    soloActivos?: boolean,
    @Args('pagina', { type: () => Int, defaultValue: 1 }) pagina?: number,
    @Args('tamano', { type: () => Int, defaultValue: 20 }) tamano?: number,
  ): Promise<MaterialesPagina> {
    return this.materialesCliente.listar(
      { busqueda, soloActivos, pagina, tamano },
      contexto,
    );
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

  /** Crea un material en el catálogo; si el código existe llega CODIGO_MATERIAL_REPETIDO (409). */
  @Roles('admin')
  @Mutation(() => Material)
  crearMaterial(
    @Context() contexto: ContextoGraphql,
    @Args('entrada', { type: () => MaterialEntrada }) entrada: MaterialEntrada,
  ): Promise<Material> {
    return this.materialesCliente.crear(entrada, contexto);
  }

  /** Reemplaza el material completo (activar o desactivar es cambiar `activo`). */
  @Roles('admin')
  @Mutation(() => Material)
  actualizarMaterial(
    @Context() contexto: ContextoGraphql,
    @Args('id', { type: () => ID }) id: string,
    @Args('entrada', { type: () => MaterialEntrada }) entrada: MaterialEntrada,
  ): Promise<Material> {
    return this.materialesCliente.actualizar(id, entrada, contexto);
  }

  /** Fija el mínimo del material en la obra (crea la fila con cantidad 0 si no existía). */
  @Roles('admin')
  @Mutation(() => StockMaterial)
  definirStockMinimo(
    @Context() contexto: ContextoGraphql,
    @Args('obraId', { type: () => ID }) obraId: string,
    @Args('materialId', { type: () => ID }) materialId: string,
    @Args('minimo', { type: () => Float }) minimo: number,
  ): Promise<StockMaterial> {
    return this.materialesCliente.definirMinimo(
      obraId,
      materialId,
      minimo,
      contexto,
    );
  }
}
