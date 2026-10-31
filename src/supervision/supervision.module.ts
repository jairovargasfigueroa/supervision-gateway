import { Module } from '@nestjs/common';
import { ObrasModule } from '../obras/obras.module.js';
import { IaCliente } from './ia.cliente.js';
import {
  FilaTableroRiesgoResolver,
  IndicadoresRiesgoResolver,
} from './riesgo-tablero.resolver.js';

/** Capas 4 y 5: campos que vienen del servicio de IA (riesgo de retraso, 402). */
@Module({
  imports: [ObrasModule],
  providers: [IaCliente, FilaTableroRiesgoResolver, IndicadoresRiesgoResolver],
  exports: [IaCliente],
})
export class SupervisionModule {}
