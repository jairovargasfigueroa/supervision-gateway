import { Module } from '@nestjs/common';
import { ObrasCliente } from './obras.cliente.js';
import { ObrasResolver } from './obras.resolver.js';

@Module({
  providers: [ObrasCliente, ObrasResolver],
})
export class ObrasModule {}
