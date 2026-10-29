import { Module } from '@nestjs/common';
import { FotosResolver } from './fotos.resolver.js';
import { ObrasCliente } from './obras.cliente.js';
import { ObrasResolver } from './obras.resolver.js';

@Module({
  providers: [ObrasCliente, ObrasResolver, FotosResolver],
  // Materiales lo usa para materialComparado (material previsto de Obras)
  exports: [ObrasCliente],
})
export class ObrasModule {}
