import { SetMetadata } from '@nestjs/common';

export const ROLES = 'roles';

export type Rol = 'admin' | 'residente' | 'gerente' | 'maestro' | 'almacenero' | 'cliente';

/** Roles que pueden usar la consulta o mutación (contrato GraphQL). Sin @Roles basta con un token válido. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES, roles);
