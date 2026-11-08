import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClienteServicio } from './http/cliente-servicio.js';
import { KeycloakAdminCliente } from './keycloak/keycloak-admin.cliente.js';
import { UsuariosResolver } from './keycloak/usuarios.resolver.js';

/**
 * Lo que usan todos los módulos de área: el cliente REST hacia los servicios y la API de administración de Keycloak.
 * Las direcciones son obligatorias y sin valor por defecto (601): si falta una, el gateway no arranca.
 */
@Global()
@Module({
  providers: [
    {
      provide: ClienteServicio,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new ClienteServicio({
          urls: {
            obras: config.getOrThrow<string>('OBRAS_URL'),
            materiales: config.getOrThrow<string>('MATERIALES_URL'),
            finanzas: config.getOrThrow<string>('FINANZAS_URL'),
            // Capas 4 y 5 (402): servicio de IA
            ia: config.getOrThrow<string>('IA_URL'),
          },
          // Convenciones, «Errores GraphQL»: tiempo máximo por llamada a un servicio
          tiempoMaximoMs: 3000,
        }),
    },
    {
      provide: KeycloakAdminCliente,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new KeycloakAdminCliente({
          url: config.getOrThrow<string>('KEYCLOAK_URL'),
          realm: config.get('KEYCLOAK_REALM', 'supervision'),
          clientId: config.get('KEYCLOAK_GATEWAY_CLIENT_ID', 'gateway'),
          clientSecret: config.get('KEYCLOAK_GATEWAY_CLIENT_SECRET', ''),
          tiempoMaximoMs: 3000,
        }),
    },
    UsuariosResolver,
  ],
  exports: [ClienteServicio, KeycloakAdminCliente],
})
export class ComunModule {}
