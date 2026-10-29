import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClienteServicio } from './http/cliente-servicio.js';

/** Lo que usan todos los módulos de área: el cliente REST hacia los servicios. */
@Global()
@Module({
  providers: [
    {
      provide: ClienteServicio,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new ClienteServicio({
          urls: {
            obras: config.get('OBRAS_URL', 'http://localhost:8081'),
            materiales: config.get('MATERIALES_URL', 'http://localhost:8082'),
            finanzas: config.get('FINANZAS_URL', 'http://localhost:8083'),
          },
          // Convenciones, «Errores GraphQL»: tiempo máximo por llamada a un servicio
          tiempoMaximoMs: 3000,
        }),
    },
  ],
  exports: [ClienteServicio],
})
export class ComunModule {}
