import { Module } from '@nestjs/common';
import { ObrasModule } from '../obras/obras.module.js';
import { InsumosResolver } from './insumos.resolver.js';
import { MaterialComparadoResolver } from './material-comparado.resolver.js';
import { MaterialesCliente } from './materiales.cliente.js';
import { MaterialesResolver } from './materiales.resolver.js';

@Module({
  imports: [ObrasModule],
  providers: [
    MaterialesCliente,
    MaterialesResolver,
    InsumosResolver,
    MaterialComparadoResolver,
  ],
  // El tablero (009) lo usa para los materiales bajos de cada obra
  exports: [MaterialesCliente],
})
export class MaterialesModule {}
