import { Module } from '@nestjs/common';
import { IaCliente } from './ia.cliente.js';

/** Capas 4 y 5: campos que vienen del servicio de IA (riesgo de retraso, 402). */
@Module({
  providers: [IaCliente],
  exports: [IaCliente],
})
export class SupervisionModule {}
