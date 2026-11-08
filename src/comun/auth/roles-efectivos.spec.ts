import { rolesEfectivos, tieneAlgunRol } from './roles-efectivos.js';

describe('rolesEfectivos', () => {
  const demo1 = ['default-roles-supervision', 'residente', 'cliente'];

  it('desde el portal solo cuenta cliente', () => {
    expect(rolesEfectivos(demo1, 'portal')).toEqual(['cliente']);
    expect(rolesEfectivos(['admin'], 'portal')).toEqual([]);
  });

  it('desde el ERP y la app solo cuentan los roles internos', () => {
    expect(rolesEfectivos(demo1, 'erp')).toEqual(['residente']);
    expect(rolesEfectivos(['maestro', 'cliente'], 'app-obra')).toEqual([
      'maestro',
    ]);
  });

  it('los clientes de servicio usan los roles del token', () => {
    expect(rolesEfectivos(['agente_ia'], 'ia-agentes')).toEqual(['agente_ia']);
  });

  it('tieneAlgunRol mira solo los roles efectivos según el azp', () => {
    expect(
      tieneAlgunRol({ roles: ['gerente'], azp: 'erp' }, ['admin', 'gerente']),
    ).toBe(true);
    expect(
      tieneAlgunRol({ roles: ['residente'], azp: 'erp' }, ['admin', 'gerente']),
    ).toBe(false);
    expect(
      tieneAlgunRol({ roles: ['admin'], azp: 'portal' }, ['admin', 'gerente']),
    ).toBe(false);
    expect(tieneAlgunRol(undefined, ['admin'])).toBe(false);
  });
});
