import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import type { ContextoGraphql } from './contexto.js';
import { ROLES } from './roles.decorator.js';
import { rolesEfectivos } from './roles-efectivos.js';

/**
 * Guard global que corre después del JwtGuard: si la consulta tiene @Roles, el usuario debe tener alguno de esos
 * roles entre sus roles efectivos (regla del azp). Si no, SIN_PERMISO (403), sin llamar a ningún servicio.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<string[] | undefined>(ROLES, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (!requeridos?.length || contexto.getType<string>() !== 'graphql') return true;

    const { req } = GqlExecutionContext.create(contexto).getContext<ContextoGraphql>();
    const usuario = req.usuario;
    if (usuario && rolesEfectivos(usuario.roles, usuario.azp).some((rol) => requeridos.includes(rol))) {
      return true;
    }
    throw new GraphQLError('Sin permiso', {
      extensions: { codigo: 'SIN_PERMISO', servicio: 'gateway', estado: 403 },
    });
  }
}
