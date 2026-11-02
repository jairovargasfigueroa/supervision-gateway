import { Module } from '@nestjs/common';
import { FinanzasCliente } from './finanzas.cliente.js';
import { CobroResolver, FinanzasResolver } from './finanzas.resolver.js';

@Module({
  providers: [FinanzasCliente, FinanzasResolver, CobroResolver],
  // El tablero (009) lo usa para los cobros vencidos
  exports: [FinanzasCliente],
})
export class FinanzasModule {}
