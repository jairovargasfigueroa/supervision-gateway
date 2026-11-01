import { GraphQLError } from 'graphql';
import type { ContextoGraphql } from '../comun/auth/contexto.js';
import { servicioNoDisponible } from '../comun/http/errores.js';
import type { KeycloakAdminCliente } from '../comun/keycloak/keycloak-admin.cliente.js';
import type { IaCliente } from './ia.cliente.js';
import { AtajoReporte } from './modelos/reporte.modelo.js';
import { ReportesResolver } from './reportes.resolver.js';

const contexto = {
  req: { requestId: 'req-1', token: 't' },
} as unknown as ContextoGraphql;

function crear() {
  const ia = {
    catalogoReportes: vi.fn().mockResolvedValue({ conjuntos: [], atajos: [] }),
    consultasReporte: vi.fn().mockResolvedValue([]),
    consultarReporte: vi
      .fn()
      .mockResolvedValue({ id: 'r1', receta: { conjunto: 'OBRAS' } }),
  };
  const keycloak = {
    usuariosConRolEnCache: vi
      .fn()
      .mockResolvedValue([
        { id: 'c1', nombre: 'Constructora Andina', correo: 'a@b.bo' },
      ]),
  };
  return {
    ia,
    keycloak,
    resolver: new ReportesResolver(
      ia as unknown as IaCliente,
      keycloak as unknown as KeycloakAdminCliente,
    ),
  };
}

describe('ReportesResolver', () => {
  it('catalogoReportes devuelve el catálogo de IA tal cual', async () => {
    const { ia, resolver } = crear();
    await expect(resolver.catalogoReportes(contexto)).resolves.toEqual({
      conjuntos: [],
      atajos: [],
    });
    expect(ia.catalogoReportes).toHaveBeenCalledWith(contexto);
  });

  it('consultasReporte pasa el límite (o nada) a IA', async () => {
    const { ia, resolver } = crear();
    await resolver.consultasReporte(contexto, 5);
    expect(ia.consultasReporte).toHaveBeenLastCalledWith(5, contexto);
    await resolver.consultasReporte(contexto);
    expect(ia.consultasReporte).toHaveBeenLastCalledWith(undefined, contexto);
  });

  describe('consultarReporte', () => {
    it('envía el texto con el directorio de clientes (id y nombre) y no expone la receta', async () => {
      const { ia, keycloak, resolver } = crear();
      await expect(
        resolver.consultarReporte(contexto, 'Cobros vencidos'),
      ).resolves.toEqual({ id: 'r1' });
      expect(keycloak.usuariosConRolEnCache).toHaveBeenCalledWith(
        'cliente',
        'req-1',
      );
      expect(ia.consultarReporte).toHaveBeenCalledWith(
        {
          texto: 'Cobros vencidos',
          directorio: {
            clientes: [{ id: 'c1', nombre: 'Constructora Andina' }],
          },
        },
        contexto,
      );
    });

    it('envía el atajo; si Keycloak falla, sin directorio', async () => {
      const { ia, keycloak, resolver } = crear();
      keycloak.usuariosConRolEnCache.mockRejectedValue(
        servicioNoDisponible('keycloak'),
      );
      await resolver.consultarReporte(
        contexto,
        null,
        AtajoReporte.COBROS_VENCIDOS,
      );
      expect(ia.consultarReporte).toHaveBeenCalledWith(
        { atajo: 'COBROS_VENCIDOS' },
        contexto,
      );
    });

    it.each([
      ['los dos', 'Cobros', AtajoReporte.COBROS_VENCIDOS],
      ['ninguno', undefined, undefined],
      ['ninguno (null)', null, null],
    ])(
      'con %s responde DATOS_INVALIDOS sin llamar a IA ni a Keycloak',
      async (_caso, texto, atajo) => {
        const { ia, keycloak, resolver } = crear();
        const error = await resolver
          .consultarReporte(contexto, texto, atajo)
          .catch((e: unknown) => e);
        expect(error).toBeInstanceOf(GraphQLError);
        expect((error as GraphQLError).extensions).toMatchObject({
          codigo: 'DATOS_INVALIDOS',
          servicio: 'gateway',
        });
        expect(ia.consultarReporte).not.toHaveBeenCalled();
        expect(keycloak.usuariosConRolEnCache).not.toHaveBeenCalled();
      },
    );
  });
});
