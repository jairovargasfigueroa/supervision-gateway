import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import type { ContextoGraphql } from './contexto.js';
import { ES_PUBLICO } from './publico.decorator.js';
import { Limitador } from './limitador.js';
import { ClavesNoDisponiblesError, VERIFICADOR_TOKEN, VerificadorToken } from './verificador-token.js';

/**
 * Guard global: toda consulta o mutación exige un token válido de Keycloak, salvo las marcadas con @Publico().
 * El token se verifica una vez por petición y queda en el contexto para reenviarlo a los servicios.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(VERIFICADOR_TOKEN) private readonly verificador: VerificadorToken,
    private readonly limitador: Limitador,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublico || contexto.getType<string>() !== 'graphql') return true;

    const { req, res } = GqlExecutionContext.create(contexto).getContext<ContextoGraphql>();
    if (!req.usuario) {
      const token = /^Bearer (.+)$/i.exec(req.headers.authorization ?? '')?.[1];
      if (!token) throw noAutenticado();
      try {
        req.usuario = await this.verificador.verificar(token);
        req.token = token;
      } catch (error) {
        // Keycloak caído: no se cierra la sesión del usuario por una falla del servidor
        if (error instanceof ClavesNoDisponiblesError) throw keycloakNoDisponible();
        throw noAutenticado();
      }
      // Se cuenta una vez por petición HTTP, aunque traiga varias consultas
      req.esperaLimite = this.limitador.registrar(req.usuario.id);
    }
    if (req.esperaLimite) {
      res.setHeader('Retry-After', String(req.esperaLimite));
      throw demasiadasPeticiones();
    }
    return true;
  }
}

function noAutenticado(): GraphQLError {
  return new GraphQLError('No autenticado', {
    extensions: { codigo: 'NO_AUTENTICADO', servicio: 'gateway' },
  });
}

function keycloakNoDisponible(): GraphQLError {
  return new GraphQLError('No se pudo validar el token: Keycloak no responde', {
    extensions: { codigo: 'SERVICIO_NO_DISPONIBLE', servicio: 'keycloak', estado: 503 },
  });
}

function demasiadasPeticiones(): GraphQLError {
  return new GraphQLError('Demasiadas peticiones', {
    extensions: { codigo: 'DEMASIADAS_PETICIONES', servicio: 'gateway', estado: 429 },
  });
}
