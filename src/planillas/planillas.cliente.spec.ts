import type { ContextoGraphql } from '../comun/auth/contexto.js';
import type { ClienteServicio } from '../comun/http/cliente-servicio.js';
import { PlanillasCliente } from './planillas.cliente.js';

const contexto = {
  req: { requestId: 'req-1', token: 't' },
} as unknown as ContextoGraphql;

function crear() {
  const servicio = {
    consultar: vi.fn().mockResolvedValue({ id: 'pl1' }),
    enviar: vi.fn().mockResolvedValue({ id: 'pl1' }),
  };
  return {
    servicio,
    planillas: new PlanillasCliente(servicio as unknown as ClienteServicio),
  };
}

describe('PlanillasCliente', () => {
  it('deObra pide GET /obras/{obraId}/planillas con el id escapado', async () => {
    const { servicio, planillas } = crear();
    await planillas.deObra('a/b', contexto);
    expect(servicio.consultar).toHaveBeenCalledWith(
      'obras',
      '/obras/a%2Fb/planillas',
      contexto,
    );
  });

  it('obtener pide GET /planillas/{id}', async () => {
    const { servicio, planillas } = crear();
    await planillas.obtener('pl1', contexto);
    expect(servicio.consultar).toHaveBeenCalledWith(
      'obras',
      '/planillas/pl1',
      contexto,
    );
  });

  it('crear envía POST /obras/{obraId}/planillas con { periodo } (sin reintento: enviar)', async () => {
    const { servicio, planillas } = crear();
    await planillas.crear('o1', '2027-03', contexto);
    expect(servicio.enviar).toHaveBeenCalledWith(
      'obras',
      'POST',
      '/obras/o1/planillas',
      { periodo: '2027-03' },
      contexto,
    );
    expect(servicio.consultar).not.toHaveBeenCalled();
  });

  it('guardar envía PUT /planillas/{id} con versión, líneas y fotos tal cual', async () => {
    const { servicio, planillas } = crear();
    const entrada = {
      version: 2,
      lineas: [{ partidaId: 'p1', cantidadPeriodo: 120 }],
      fotoIds: ['f1'],
    };
    await planillas.guardar('pl1', entrada, contexto);
    expect(servicio.enviar).toHaveBeenCalledWith(
      'obras',
      'PUT',
      '/planillas/pl1',
      entrada,
      contexto,
    );
  });

  it('presentar envía POST /planillas/{id}/presentar con { version }', async () => {
    const { servicio, planillas } = crear();
    await planillas.presentar('a/b', 3, contexto);
    expect(servicio.enviar).toHaveBeenCalledWith(
      'obras',
      'POST',
      '/planillas/a%2Fb/presentar',
      { version: 3 },
      contexto,
    );
  });
});
