import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClienteServicio } from './http/cliente-servicio.js';
import { KeycloakAdminCliente } from './keycloak/keycloak-admin.cliente.js';
import { UsuariosResolver } from './keycloak/usuarios.resolver.js';

/** Lo que usan todos los módulos de área: el cliente REST hacia los servicios y la API de administración de Keycloak. */
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
    {
      provide: KeycloakAdminCliente,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new KeycloakAdminCliente({
          url: config.get('KEYCLOAK_URL', 'http://localhost:8080'),
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
