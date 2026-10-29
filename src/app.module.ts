import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import type { Request, Response } from 'express';
import { JwtGuard } from './comun/auth/jwt.guard.js';
import { VERIFICADOR_TOKEN, VerificadorToken } from './comun/auth/verificador-token.js';
import { ClienteServicio } from './comun/http/cliente-servicio.js';
import { RequestIdMiddleware } from './comun/http/request-id.middleware.js';
import { SaludResolver } from './salud/salud.resolver.js';

@Module({
  imports: [
    // Lee las variables del archivo .env (no se sube al repositorio)
    ConfigModule.forRoot({ isGlobal: true }),
    // Esquema code-first: se genera en memoria a partir de los resolvers
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      // La petición (con su X-Request-Id, usuario y token) llega a guards y resolvers
      context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),
    }),
  ],
  providers: [
    SaludResolver,
    {
      provide: VERIFICADOR_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        VerificadorToken.desdeKeycloak(
          config.get('KEYCLOAK_URL', 'http://localhost:8080'),
          config.get('KEYCLOAK_REALM', 'supervision'),
          'plataforma-api',
        ),
    },
    { provide: APP_GUARD, useClass: JwtGuard },
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
          tiempoMaximoMs: 3000,
        }),
    },
  ],
  exports: [ClienteServicio],
})
export class AppModule implements NestModule {
  configure(consumidor: MiddlewareConsumer): void {
    consumidor.apply(RequestIdMiddleware).forRoutes('*path');
  }
}
