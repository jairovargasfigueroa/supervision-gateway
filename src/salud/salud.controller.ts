import { Controller, Get } from '@nestjs/common';
import { Publico } from '../comun/auth/publico.decorator.js';

/**
 * `GET /salud` (convenciones, «Registros y salud»; 601): sin token y sin llamar a ningún servicio, solo dice
 * que el proceso responde. Lo usan el HEALTHCHECK de la imagen y la prueba de humo.
 */
@Controller('salud')
export class SaludController {
  @Publico()
  @Get()
  consultar(): { estado: 'ok' } {
    return { estado: 'ok' };
  }
}
