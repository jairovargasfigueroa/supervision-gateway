import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { SaludResolver } from './salud/salud.resolver.js';

@Module({
  imports: [
    // Lee las variables del archivo .env (no se sube al repositorio)
    ConfigModule.forRoot({ isGlobal: true }),
    // Esquema code-first: se genera en memoria a partir de los resolvers
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
    }),
  ],
  providers: [SaludResolver],
})
export class AppModule {}
