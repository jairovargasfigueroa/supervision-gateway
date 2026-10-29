import { Injectable, Logger } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import type { ContextoGraphql } from '../auth/contexto.js';
import { cadaUno, cargador } from '../dataloaders/dataloaders.js';
import { servicioNoDisponible } from '../http/errores.js';
import type { Usuario } from './usuario.modelo.js';

export interface OpcionesKeycloakAdmin {
  /** URL base de Keycloak (KEYCLOAK_URL). */
  url: string;
  realm: string;
  /** Cliente confidencial `gateway` (KEYCLOAK_GATEWAY_CLIENT_ID / _SECRET). */
  clientId: string;
  clientSecret: string;
  /** Tiempo máximo por llamada (convenciones: 3 s). */
  tiempoMaximoMs: number;
  /** Segundos antes del vencimiento en que el token deja de usarse (se pide otro). */
  margenSegundos?: number;
  /** Cuánto se guarda en memoria cada usuario pedido por id (006: 5 minutos). */
  cacheUsuariosMs?: number;
}

/** Usuario tal como lo devuelve la API de administración de Keycloak (representación breve). */
interface UsuarioKeycloak {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

/** Error de Keycloak que no es "no responde": se informa como ERROR_INTERNO del servicio keycloak. */
class RespuestaKeycloakError extends Error {
  constructor(readonly estado: number) {
    super(`Keycloak respondió ${estado}`);
  }
}

/**
 * API de administración de Keycloak con el cliente confidencial `gateway` (docs/contratos.md, «Consume»).
 * El token se pide por client credentials y se guarda en memoria hasta poco antes de vencer.
 */
@Injectable()
export class KeycloakAdminCliente {
  private readonly registro = new Logger(KeycloakAdminCliente.name);
  private token?: { valor: string; venceEn: number };
  private pidiendoToken?: Promise<string>;
  /** Usuarios por id (nombres de las asignaciones y de quien registró cada foto), hasta `cacheUsuariosMs`. */
  private readonly usuarios = new Map<
    string,
    { usuario: Usuario; venceEn: number }
  >();

  constructor(
    private readonly opciones: OpcionesKeycloakAdmin,
    private readonly ahora: () => number = Date.now,
  ) {}

  /** Usuarios que tienen el rol del realm, ordenados por nombre. */
  async usuariosConRol(rol: string, requestId: string): Promise<Usuario[]> {
    const usuarios = await this.consultar<UsuarioKeycloak[]>(
      `/roles/${encodeURIComponent(rol)}/users?first=0&max=1000`,
      requestId,
    );
    return (usuarios ?? [])
      .map(aUsuario)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  /**
   * Un usuario por su id; null si Keycloak no lo conoce. Los encontrados se guardan en memoria 5 minutos (006); los
   * desconocidos y los errores no se guardan.
   */
  async usuarioPorId(id: string, requestId: string): Promise<Usuario | null> {
    const guardado = this.usuarios.get(id);
    if (guardado && this.ahora() < guardado.venceEn) return guardado.usuario;
    const encontrado = await this.consultar<UsuarioKeycloak>(
      `/users/${encodeURIComponent(id)}`,
      requestId,
    );
    if (!encontrado) {
      this.usuarios.delete(id);
      return null;
    }
    const usuario = aUsuario(encontrado);
    this.usuarios.set(id, {
      usuario,
      venceEn: this.ahora() + (this.opciones.cacheUsuariosMs ?? 5 * 60_000),
    });
    return usuario;
  }

  /** `usuarioPorId` con el DataLoader de la petición: el mismo id en varios campos se pide una sola vez. */
  usuarioEnPeticion(
    id: string,
    contexto: ContextoGraphql,
  ): Promise<Usuario | null> {
    return cargador<string, Usuario | null>(
      contexto,
      'usuarios',
      cadaUno((usuarioId) =>
        this.usuarioPorId(usuarioId, contexto.req.requestId),
      ),
    ).load(id);
  }

  /** GET a la API de administración del realm; null si responde 404. Reintenta una vez (es una consulta). */
  private async consultar<T>(
    ruta: string,
    requestId: string,
  ): Promise<T | null> {
    const url = `${this.opciones.url}/admin/realms/${this.opciones.realm}${ruta}`;
    for (let intento = 1; ; intento++) {
      try {
        const respuesta = await fetch(url, {
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${await this.tokenVigente()}`,
            'x-request-id': requestId,
          },
          signal: AbortSignal.timeout(this.opciones.tiempoMaximoMs),
        });
        if (respuesta.ok) return (await respuesta.json()) as T;
        if (respuesta.status === 404) return null;
        // Token revocado o vencido antes de tiempo: se olvida y se pide otro en el reintento
        if (respuesta.status === 401) this.token = undefined;
        if (
          (respuesta.status === 401 || respuesta.status >= 500) &&
          intento < 2
        )
          continue;
        throw new RespuestaKeycloakError(respuesta.status);
      } catch (error) {
        if (error instanceof RespuestaKeycloakError) {
          this.registro.warn(
            `[${requestId}] Keycloak respondió ${error.estado}: GET ${ruta}`,
          );
          throw errorInterno(error.estado);
        }
        if (intento < 2) continue;
        this.registro.warn(
          `[${requestId}] Keycloak no respondió: GET ${ruta} (${(error as Error).name})`,
        );
        throw servicioNoDisponible('keycloak');
      }
    }
  }

  /** Token del cliente gateway; reutiliza el guardado y, si varias consultas lo piden a la vez, lo pide una sola vez. */
  private tokenVigente(): Promise<string> {
    if (this.token && this.ahora() < this.token.venceEn)
      return Promise.resolve(this.token.valor);
    this.pidiendoToken ??= this.pedirToken().finally(
      () => (this.pidiendoToken = undefined),
    );
    return this.pidiendoToken;
  }

  private async pedirToken(): Promise<string> {
    const {
      url,
      realm,
      clientId,
      clientSecret,
      tiempoMaximoMs,
      margenSegundos = 30,
    } = this.opciones;
    const respuesta = await fetch(
      `${url}/realms/${realm}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
        signal: AbortSignal.timeout(tiempoMaximoMs),
      },
    );
    if (!respuesta.ok) throw new RespuestaKeycloakError(respuesta.status);
    const { access_token, expires_in } = (await respuesta.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.token = {
      valor: access_token,
      venceEn: this.ahora() + Math.max(expires_in - margenSegundos, 0) * 1000,
    };
    return access_token;
  }
}

function aUsuario(usuario: UsuarioKeycloak): Usuario {
  const nombre = [usuario.firstName, usuario.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return {
    id: usuario.id,
    nombre: nombre || usuario.username || usuario.id,
    correo: usuario.email ?? null,
  };
}

function errorInterno(estado: number): GraphQLError {
  return new GraphQLError('Error en keycloak', {
    extensions: { codigo: 'ERROR_INTERNO', servicio: 'keycloak', estado },
  });
}
