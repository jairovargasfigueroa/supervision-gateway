import { Module } from '@nestjs/common';
import { MaterialesCliente } from './materiales.cliente.js';
import { MaterialesResolver } from './materiales.resolver.js';

@Module({
  providers: [MaterialesCliente, MaterialesResolver],
})
export class MaterialesModule {}
