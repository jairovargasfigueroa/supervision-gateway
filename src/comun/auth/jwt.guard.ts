import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import type { ContextoGraphql } from './contexto.js';
import { ES_PUBLICO } from './publico.decorator.js';
import { VERIFICADOR_TOKEN, VerificadorToken } from './verificador-token.js';

/**
 * Guard global: toda consulta o mutación exige un token válido de Keycloak, salvo las marcadas con @Publico().
 * El token se verifica una vez por petición y queda en el contexto para reenviarlo a los servicios.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(VERIFICADOR_TOKEN) private readonly verificador: VerificadorToken,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublico || contexto.getType<string>() !== 'graphql') return true;

    const { req } = GqlExecutionContext.create(contexto).getContext<ContextoGraphql>();
    if (req.usuario) return true;

    const token = /^Bearer (.+)$/i.exec(req.headers.authorization ?? '')?.[1];
    if (!token) throw noAutenticado();
    try {
      req.usuario = await this.verificador.verificar(token);
      req.token = token;
      return true;
    } catch {
      throw noAutenticado();
    }
  }
}

function noAutenticado(): GraphQLError {
  return new GraphQLError('No autenticado', {
    extensions: { codigo: 'NO_AUTENTICADO', servicio: 'gateway' },
  });
}
