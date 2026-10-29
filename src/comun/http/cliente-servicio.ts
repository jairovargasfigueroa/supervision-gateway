import { Injectable, Logger } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import type { ContextoGraphql } from '../auth/contexto.js';
import {
  errorDesdeRespuesta,
  servicioNoDisponible,
  type Servicio,
} from './errores.js';

export interface OpcionesCliente {
  urls: Record<Servicio, string>;
  /** Tiempo máximo por llamada (convenciones: 3 s). */
  tiempoMaximoMs: number;
}

/**
 * Único camino del gateway a los servicios REST (docs/estructura.md): reenvía el token del usuario y el X-Request-Id,
 * corta a los 3 s, reintenta una vez las consultas (GET) y nunca las mutaciones, y traduce los errores a GraphQL.
 */
@Injectable()
export class ClienteServicio {
  private readonly registro = new Logger(ClienteServicio.name);

  constructor(private readonly opciones: OpcionesCliente) {}

  consultar<T>(
    servicio: Servicio,
    ruta: string,
    contexto: ContextoGraphql,
  ): Promise<T> {
    return this.pedir<T>(servicio, 'GET', ruta, undefined, contexto, 2);
  }

  enviar<T>(
    servicio: Servicio,
    metodo: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    ruta: string,
    cuerpo: unknown,
    contexto: ContextoGraphql,
  ): Promise<T> {
    return this.pedir<T>(servicio, metodo, ruta, cuerpo, contexto, 1);
  }

  private async pedir<T>(
    servicio: Servicio,
    metodo: string,
    ruta: string,
    cuerpo: unknown,
    { req }: ContextoGraphql,
    intentos: number,
  ): Promise<T> {
    const encabezados: Record<string, string> = {
      accept: 'application/json',
      'x-request-id': req.requestId,
    };
    if (req.token) encabezados['authorization'] = `Bearer ${req.token}`;
    if (cuerpo !== undefined) encabezados['content-type'] = 'application/json';

    for (let intento = 1; ; intento++) {
      try {
        const respuesta = await fetch(
          `${this.opciones.urls[servicio]}${ruta}`,
          {
            method: metodo,
            headers: encabezados,
            body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
            signal: AbortSignal.timeout(this.opciones.tiempoMaximoMs),
          },
        );
        if (respuesta.ok) {
          return (
            respuesta.status === 204 ? undefined : await respuesta.json()
          ) as T;
        }
        if (respuesta.status >= 500 && intento < intentos) continue;
        throw await errorDesdeRespuesta(respuesta, servicio);
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        if (intento < intentos) continue;
        this.registro.warn(
          `[${req.requestId}] ${servicio} no respondió: ${metodo} ${ruta} (${(error as Error).name})`,
        );
        throw servicioNoDisponible(servicio);
      }
    }
  }
}
