import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWTPayload,
} from 'jose';
import { VerificadorToken } from '../../src/comun/auth/verificador-token.js';

export const EMISOR = 'http://localhost:8080/realms/supervision';
export const AUDIENCIA = 'plataforma-api';

/** Claves RSA de prueba: el verificador las usa en lugar del JWKS de Keycloak. */
export async function crearClavesPrueba() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'prueba', alg: 'RS256' };
  const verificador = new VerificadorToken(
    createLocalJWKSet({ keys: [jwk] }),
    EMISOR,
    AUDIENCIA,
  );

  const firmar = (
    datos: JWTPayload,
    opciones: { clave?: CryptoKey; vence?: string | number } = {},
  ) =>
    new SignJWT({ azp: 'erp', ...datos })
      .setProtectedHeader({ alg: 'RS256', kid: 'prueba' })
      .setIssuer(datos.iss ?? EMISOR)
      .setAudience(datos.aud ?? [AUDIENCIA, 'account'])
      .setIssuedAt()
      .setExpirationTime(opciones.vence ?? '5m')
      .sign(opciones.clave ?? privateKey);

  return { verificador, firmar };
}
