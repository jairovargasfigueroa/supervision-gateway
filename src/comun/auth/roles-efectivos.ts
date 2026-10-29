// Roles que cuentan según la aplicación desde la que se inició sesión (campo azp del token), para usuarios con
// varios roles como demo1 (convenciones, «Usuario con varios roles»).

export const ROLES_INTERNOS = ['admin', 'residente', 'gerente', 'maestro', 'almacenero'] as const;
const APLICACIONES_INTERNAS = ['erp', 'app-obra'];

/**
 * azp = portal → solo cliente; azp = erp o app-obra → solo los roles internos; otro azp (clientes de servicio como
 * gateway, ia-agentes o n8n) → los roles del token tal cual.
 */
export function rolesEfectivos(roles: readonly string[], azp: string): string[] {
  if (azp === 'portal') return roles.filter((rol) => rol === 'cliente');
  if (APLICACIONES_INTERNAS.includes(azp)) {
    return roles.filter((rol) => (ROLES_INTERNOS as readonly string[]).includes(rol));
  }
  return [...roles];
}
