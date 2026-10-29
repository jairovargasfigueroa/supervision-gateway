import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/** Datos del usuario que salen del token de Keycloak. */
export interface UsuarioToken {
  id: string;
  nombre: string;
  roles: string[];
  /** Cliente con el que inició sesión (erp, portal, app-obra): decide qué roles cuentan (convenciones). */
  azp: string;
}

/** Proveedor de inyección del verificador; las pruebas lo reemplazan por uno con claves locales. */
export const VERIFICADOR_TOKEN = Symbol('VERIFICADOR_TOKEN');

/**
 * Valida firma (JWKS del realm), vencimiento, emisor y audiencia plataforma-api (convenciones, «Autenticación y permisos»).
 * El JWKS se pide la primera vez que llega un token y jose lo guarda en caché.
 */
export class VerificadorToken {
  constructor(
    private readonly claves: JWTVerifyGetKey,
    private readonly emisor: string,
    private readonly audiencia: string,
  ) {}

  static desdeKeycloak(keycloakUrl: string, realm: string, audiencia: string): VerificadorToken {
    const emisor = `${keycloakUrl}/realms/${realm}`;
    const claves = createRemoteJWKSet(new URL(`${emisor}/protocol/openid-connect/certs`));
    return new VerificadorToken(claves, emisor, audiencia);
  }

  async verificar(token: string): Promise<UsuarioToken> {
    const { payload } = await jwtVerify(token, this.claves, {
      issuer: this.emisor,
      audience: this.audiencia,
    });
    const accesoRealm = payload['realm_access'] as { roles?: string[] } | undefined;
    return {
      id: payload.sub ?? '',
      nombre: typeof payload['name'] === 'string' ? payload['name'] : '',
      roles: accesoRealm?.roles ?? [],
      azp: typeof payload['azp'] === 'string' ? payload['azp'] : '',
    };
  }
}
