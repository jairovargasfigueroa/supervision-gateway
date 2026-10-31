import { Module } from '@nestjs/common';
import { MaterialesModule } from '../materiales/materiales.module.js';
import { ObrasModule } from '../obras/obras.module.js';
import {
  ConsumoAtipicoResolver,
  ObraConsumosAtipicosResolver,
} from './consumos-atipicos.resolver.js';
import { IaCliente } from './ia.cliente.js';
import {
  FilaTableroRiesgoResolver,
  IndicadoresRiesgoResolver,
} from './riesgo-tablero.resolver.js';
import { ModeloRiesgoResolver, ObraRiesgoResolver } from './riesgo.resolver.js';

/** Capas 4 y 5: campos que vienen del servicio de IA (riesgo de retraso, 402; consumos atípicos, 403). */
@Module({
  imports: [ObrasModule, MaterialesModule],
  providers: [
    IaCliente,
    FilaTableroRiesgoResolver,
    IndicadoresRiesgoResolver,
    ObraRiesgoResolver,
    ModeloRiesgoResolver,
    ObraConsumosAtipicosResolver,
    ConsumoAtipicoResolver,
  ],
  exports: [IaCliente],
})
export class SupervisionModule {}
