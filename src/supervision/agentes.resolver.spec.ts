import type { ContextoGraphql } from '../comun/auth/contexto.js';
import type { KeycloakAdminCliente } from '../comun/keycloak/keycloak-admin.cliente.js';
import {
  AgentesResolver,
  EjecucionAgenteResolver,
  SugerenciaResolver,
} from './agentes.resolver.js';
import type { IaCliente } from './ia.cliente.js';
import {
  Agente,
  EstadoEjecucion,
  EstadoSugerencia,
  type EjecucionAgente,
  type Sugerencia,
} from './modelos/agente.modelo.js';

const contexto = {
  req: { requestId: 'req-1', token: 't' },
} as unknown as ContextoGraphql;

function crear() {
  const ia = {
    agentes: vi.fn().mockResolvedValue([]),
    ejecuciones: vi.fn().mockResolvedValue([]),
    ejecucion: vi.fn().mockResolvedValue({
      id: 'e1',
      agente: 'CONTROL_COBROS',
      terminadaEn: '2027-04-20T10:01:12Z',
      hallazgos: [{ obraId: 'o1' }],
    }),
    hallazgos: vi.fn().mockResolvedValue([]),
    sugerencias: vi.fn().mockResolvedValue([]),
  };
  const keycloak = {
    usuarioEnPeticion: vi
      .fn()
      .mockResolvedValue({ id: 'u1', nombre: 'Ana Rojas', correo: null }),
  };
  return {
    ia,
    keycloak,
    agentes: new AgentesResolver(ia as unknown as IaCliente),
    ejecucion: new EjecucionAgenteResolver(
      keycloak as unknown as KeycloakAdminCliente,
    ),
    sugerencia: new SugerenciaResolver(
      keycloak as unknown as KeycloakAdminCliente,
    ),
  };
}

describe('AgentesResolver', () => {
  it('pasa los filtros a IA', async () => {
    const { ia, agentes } = crear();
    await agentes.agentes(contexto);
    expect(ia.agentes).toHaveBeenCalledWith(contexto);
    await agentes.ejecucionesAgente(
      contexto,
      Agente.CONTROL_MATERIALES,
      EstadoEjecucion.FALLIDA,
      5,
    );
    expect(ia.ejecuciones).toHaveBeenCalledWith(
      { agente: 'CONTROL_MATERIALES', estado: 'FALLIDA', limite: 5 },
      contexto,
    );
    await agentes.hallazgos(contexto, Agente.SEGUIMIENTO_OBRAS, 'o1');
    expect(ia.hallazgos).toHaveBeenCalledWith(
      { agente: 'SEGUIMIENTO_OBRAS', obraId: 'o1' },
      contexto,
    );
    await agentes.sugerencias(contexto, EstadoSugerencia.PENDIENTE);
    expect(ia.sugerencias).toHaveBeenCalledWith(
      {
        estado: 'PENDIENTE',
        agente: undefined,
        obraId: undefined,
        limite: undefined,
      },
      contexto,
    );
  });

  it('ejecucionAgente completa los hallazgos con los datos de la ejecución', async () => {
    const { ia, agentes } = crear();
    const ejecucion = await agentes.ejecucionAgente(contexto, 'e1');
    expect(ia.ejecucion).toHaveBeenCalledWith('e1', contexto);
    expect(ejecucion.hallazgos).toEqual([
      {
        obraId: 'o1',
        ejecucionId: 'e1',
        agente: 'CONTROL_COBROS',
        detectadoEn: '2027-04-20T10:01:12Z',
      },
    ]);
  });
});

describe('solicitadaPor y decididaPor', () => {
  it('se piden a Keycloak con el DataLoader de la petición', async () => {
    const { keycloak, ejecucion, sugerencia } = crear();
    await expect(
      ejecucion.solicitadaPor(
        { solicitadaPor: 'u1' } as EjecucionAgente,
        contexto,
      ),
    ).resolves.toMatchObject({ nombre: 'Ana Rojas' });
    await sugerencia.decididaPor({ decididaPor: 'u2' } as Sugerencia, contexto);
    expect(keycloak.usuarioEnPeticion).toHaveBeenNthCalledWith(
      1,
      'u1',
      contexto,
    );
    expect(keycloak.usuarioEnPeticion).toHaveBeenNthCalledWith(
      2,
      'u2',
      contexto,
    );
  });

  it('sin id (programada o pendiente) devuelven null sin llamar a Keycloak', async () => {
    const { keycloak, ejecucion, sugerencia } = crear();
    await expect(
      ejecucion.solicitadaPor(
        { solicitadaPor: null } as EjecucionAgente,
        contexto,
      ),
    ).resolves.toBeNull();
    await expect(
      sugerencia.decididaPor({ decididaPor: null } as Sugerencia, contexto),
    ).resolves.toBeNull();
    expect(keycloak.usuarioEnPeticion).not.toHaveBeenCalled();
  });
});
