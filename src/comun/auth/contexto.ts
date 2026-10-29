import type { Request, Response } from 'express';
import type { UsuarioToken } from './verificador-token.js';

/** Petición HTTP con lo que agregan el middleware de X-Request-Id y el JwtGuard. */
export interface PeticionGateway extends Request {
  requestId: string;
  usuario?: UsuarioToken;
  /** Token del usuario tal como llegó; se reenvía a los servicios. */
  token?: string;
  /** Segundos que debe esperar el usuario si pasó el límite de peticiones (0 si puede seguir). */
  esperaLimite?: number;
}

/** Contexto de cada consulta GraphQL. */
export interface ContextoGraphql {
  req: PeticionGateway;
  res: Response;
}
