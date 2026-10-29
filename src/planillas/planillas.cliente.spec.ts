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
});
