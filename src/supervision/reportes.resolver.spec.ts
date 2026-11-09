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
    consultarReporte: vi.fn().mockResolvedValue({
      conversacionId: 'conv-1',
      tipo: 'REPORTE',
      consulta: { id: 'r1', receta: { conjunto: 'OBRAS' } },
      aclaracion: null,
    }),
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
    it('envía el texto con el directorio de clientes (id y nombre) y devuelve el reporte sin la receta', async () => {
      const { ia, keycloak, resolver } = crear();
      await expect(
        resolver.consultarReporte(contexto, 'Cobros vencidos'),
      ).resolves.toEqual({
        conversacionId: 'conv-1',
        tipo: 'REPORTE',
        consulta: { id: 'r1' },
        aclaracion: null,
      });
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

    it('505: reenvía el conversacionId que viene, antes del directorio', async () => {
      const { ia, resolver } = crear();
      await resolver.consultarReporte(contexto, 'IP-30', null, 'conv-1');
      const pedido = ia.consultarReporte.mock.calls[0][0] as object;
      expect(pedido).toEqual({
        texto: 'IP-30',
        conversacionId: 'conv-1',
        directorio: {
          clientes: [{ id: 'c1', nombre: 'Constructora Andina' }],
        },
      });
      expect(Object.keys(pedido)).toEqual([
        'texto',
        'conversacionId',
        'directorio',
      ]);
    });

    it.each([undefined, null])(
      '505: sin conversacionId (%s) no lo envía',
      async (conversacionId) => {
        const { ia, resolver } = crear();
        await resolver.consultarReporte(
          contexto,
          'Cobros vencidos',
          undefined,
          conversacionId,
        );
        expect(ia.consultarReporte.mock.calls[0][0]).not.toHaveProperty(
          'conversacionId',
        );
      },
    );

    it('505: una aclaración llega con la pregunta y consulta null', async () => {
      const { ia, resolver } = crear();
      const aclaracion = {
        pregunta: '«cemento» coincide con dos materiales. ¿Cuál?',
        opciones: ['Cemento IP-30', 'Cemento cola', 'Todos'],
        preguntasRestantes: 4,
      };
      ia.consultarReporte.mockResolvedValue({
        conversacionId: 'conv-2',
        tipo: 'ACLARACION',
        consulta: null,
        aclaracion,
      });
      await expect(
        resolver.consultarReporte(contexto, '¿Cuánto cemento se usó?'),
      ).resolves.toEqual({
        conversacionId: 'conv-2',
        tipo: 'ACLARACION',
        consulta: null,
        aclaracion,
      });
    });

    it('505: CONVERSACION_NO_ENCONTRADA de IA pasa tal cual', async () => {
      const { ia, resolver } = crear();
      const error = new GraphQLError('La conversación no existe', {
        extensions: {
          codigo: 'CONVERSACION_NO_ENCONTRADA',
          servicio: 'ia',
          estado: 404,
        },
      });
      ia.consultarReporte.mockRejectedValue(error);
      await expect(
        resolver.consultarReporte(contexto, 'sí', null, 'conv-vieja'),
      ).rejects.toBe(error);
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
          .consultarReporte(contexto, texto, atajo, 'conv-1')
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
