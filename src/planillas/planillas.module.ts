import { Module } from '@nestjs/common';
import { PlanillasCliente } from './planillas.cliente.js';
import {
  ObraPlanillasResolver,
  PlanillasResolver,
} from './planillas.resolver.js';

@Module({
  providers: [PlanillasCliente, PlanillasResolver, ObraPlanillasResolver],
})
export class PlanillasModule {}
