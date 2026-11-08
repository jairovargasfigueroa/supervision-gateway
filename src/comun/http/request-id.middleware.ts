import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { PeticionGateway } from '../auth/contexto.js';

export const ENCABEZADO_REQUEST_ID = 'x-request-id';
const VALOR_VALIDO = /^[A-Za-z0-9._-]{1,100}$/;

/** Crea el X-Request-Id si no viene (o si viene con un valor raro) y lo devuelve en la respuesta con los encabezados de seguridad. */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: PeticionGateway, res: Response, next: NextFunction): void {
    const recibido = req.headers[ENCABEZADO_REQUEST_ID];
    req.requestId =
      typeof recibido === 'string' && VALOR_VALIDO.test(recibido)
        ? recibido
        : randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    // Encabezados de seguridad de las convenciones («Seguridad»)
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  }
}
