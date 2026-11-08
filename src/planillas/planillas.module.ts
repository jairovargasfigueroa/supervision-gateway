import { Module } from '@nestjs/common';
import { FinanzasModule } from '../finanzas/finanzas.module.js';
import { PlanillasCliente } from './planillas.cliente.js';
import {
  CobroPlanillaResolver,
  ObraPlanillasResolver,
  PlanillasResolver,
} from './planillas.resolver.js';

@Module({
  // 008: el detalle del cobro de la planilla lo da Finanzas
  imports: [FinanzasModule],
  providers: [
    PlanillasCliente,
    PlanillasResolver,
    ObraPlanillasResolver,
    CobroPlanillaResolver,
  ],
})
export class PlanillasModule {}
