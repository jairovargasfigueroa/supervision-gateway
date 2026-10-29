import { Module } from '@nestjs/common';
import { InsumosResolver } from './insumos.resolver.js';
import { MaterialesCliente } from './materiales.cliente.js';
import { MaterialesResolver } from './materiales.resolver.js';

@Module({
  providers: [MaterialesCliente, MaterialesResolver, InsumosResolver],
})
export class MaterialesModule {}
