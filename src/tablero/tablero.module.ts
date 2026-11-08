import { Module } from '@nestjs/common';
import { FinanzasModule } from '../finanzas/finanzas.module.js';
import { MaterialesModule } from '../materiales/materiales.module.js';
import { ObrasModule } from '../obras/obras.module.js';
import {
  FilaTableroResolver,
  IndicadoresTableroResolver,
  TableroResolver,
} from './tablero.resolver.js';

@Module({
  imports: [ObrasModule, MaterialesModule, FinanzasModule],
  providers: [TableroResolver, FilaTableroResolver, IndicadoresTableroResolver],
})
export class TableroModule {}
