import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import type { Request, Response } from 'express';
import { Limitador } from './comun/auth/limitador.js';
import { limitarConsultas } from './comun/graphql/limites.js';
import { JwtGuard } from './comun/auth/jwt.guard.js';
import { RolesGuard } from './comun/auth/roles.guard.js';
import {
  VERIFICADOR_TOKEN,
  VerificadorToken,
} from './comun/auth/verificador-token.js';
import { ComunModule } from './comun/comun.module.js';
import { RequestIdMiddleware } from './comun/http/request-id.middleware.js';
import { FinanzasModule } from './finanzas/finanzas.module.js';
import { MaterialesModule } from './materiales/materiales.module.js';
import { ObrasModule } from './obras/obras.module.js';
import { PlanillasModule } from './planillas/planillas.module.js';
import { SaludResolver } from './salud/salud.resolver.js';

const enProduccion = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    // Lee las variables del archivo .env (no se sube al repositorio)
    ConfigModule.forRoot({ isGlobal: true }),
    // Esquema code-first: se genera en memoria a partir de los resolvers
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      // La petición (con su X-Request-Id, usuario y token) llega a guards y resolvers
      context: ({ req, res }: { req: Request; res: Response }) => ({
        req,
        res,
      }),
      // Convenciones, «Seguridad»: profundidad y complejidad máximas; introspección y Sandbox solo en desarrollo
      validationRules: [limitarConsultas()],
      introspection: !enProduccion,
      playground: false,
      plugins: enProduccion
        ? []
        : [ApolloServerPluginLandingPageLocalDefault()],
    }),
    ComunModule,
    ObrasModule,
    MaterialesModule,
    FinanzasModule,
    PlanillasModule,
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
    // 120 peticiones por minuto por usuario (convenciones, «Seguridad»)
    { provide: Limitador, useValue: new Limitador(120) },
    { provide: APP_GUARD, useClass: JwtGuard },
    // Después del token (los APP_GUARD corren en el orden en que se registran)
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumidor: MiddlewareConsumer): void {
    consumidor.apply(RequestIdMiddleware).forRoutes('*path');
  }
}
