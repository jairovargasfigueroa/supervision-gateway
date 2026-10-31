import {
  Args,
  Context,
  Int,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { Roles } from '../comun/auth/roles.decorator.js';
import { Obra } from '../obras/modelos/obra.modelo.js';
import type { ObraRest } from '../obras/obras.cliente.js';
import { HISTORIAL_POR_DEFECTO, IaCliente } from './ia.cliente.js';
import {
  ModeloRiesgo,
  PuntoRiesgo,
  RiesgoRetraso,
} from './modelos/riesgo.modelo.js';
import { riesgoDesdePrediccion } from './riesgo.js';

/**
 * 402: riesgo del modelo en el detalle de la obra. `riesgoRetraso` e `historialRiesgo` salen de una sola llamada a
 * `GET /obras/{id}/prediccion` (DataLoader de la petición); si IA no responde, solo estos campos vuelven null con
 * SERVICIO_NO_DISPONIBLE y el resto de la obra llega.
 */
@Resolver(() => Obra)
export class ObraRiesgoResolver {
  constructor(private readonly iaCliente: IaCliente) {}

  @ResolveField(() => RiesgoRetraso, { nullable: true })
  async riesgoRetraso(
    @Parent() obra: ObraRest,
    @Context() contexto: ContextoGraphql,
  ): Promise<RiesgoRetraso> {
    return riesgoDesdePrediccion(
      await this.iaCliente.prediccionDeObra(obra.id, undefined, contexto),
    );
  }

  /** Del más antiguo al más reciente; IA omite los cálculos SIN_DATOS. */
  @ResolveField(() => [PuntoRiesgo], { nullable: true })
  async historialRiesgo(
    @Parent() obra: ObraRest,
    @Context() contexto: ContextoGraphql,
    @Args('limite', { type: () => Int, defaultValue: HISTORIAL_POR_DEFECTO })
    limite: number,
  ): Promise<PuntoRiesgo[]> {
    return (await this.iaCliente.prediccionDeObra(obra.id, limite, contexto))
      .historial;
  }
}

/** 402: datos del modelo para el panel «Sobre el modelo» (`GET /modelos/riesgo-retraso`). */
@Resolver(() => ModeloRiesgo)
export class ModeloRiesgoResolver {
  constructor(private readonly iaCliente: IaCliente) {}

  /** Sin modelo cargado: null con MODELO_NO_DISPONIBLE; IA caído: null con SERVICIO_NO_DISPONIBLE. */
  @Roles('admin', 'gerente', 'residente')
  @Query(() => ModeloRiesgo, { nullable: true })
  async modeloRiesgo(
    @Context() contexto: ContextoGraphql,
  ): Promise<ModeloRiesgo> {
    const { umbrales, ...modelo } = await this.iaCliente.modeloRiesgo(contexto);
    return {
      versionModelo: modelo.versionModelo,
      entrenadoEn: modelo.entrenadoEn,
      datos: modelo.datos,
      filasEntrenamiento: modelo.filasEntrenamiento,
      metricas: modelo.metricas,
      umbralMedio: umbrales.medio,
      umbralAlto: umbrales.alto,
      variables: modelo.variables,
    };
  }
}
