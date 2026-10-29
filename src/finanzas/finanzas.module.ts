import { Module } from '@nestjs/common';
import { FinanzasCliente } from './finanzas.cliente.js';
import { FinanzasResolver } from './finanzas.resolver.js';

@Module({
  providers: [FinanzasCliente, FinanzasResolver],
})
export class FinanzasModule {}
