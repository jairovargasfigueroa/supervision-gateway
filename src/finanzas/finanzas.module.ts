import { Module } from '@nestjs/common';
import { FinanzasCliente } from './finanzas.cliente.js';
import { FinanzasResolver } from './finanzas.resolver.js';

@Module({
  providers: [FinanzasCliente, FinanzasResolver],
  // El tablero (009) lo usa para los cobros vencidos
  exports: [FinanzasCliente],
})
export class FinanzasModule {}
