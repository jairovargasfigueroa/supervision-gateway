import type { ContextoGraphql } from '../comun/auth/contexto.js';
import type { ClienteServicio } from '../comun/http/cliente-servicio.js';
import { IaCliente } from './ia.cliente.js';

const contexto = {
  req: { requestId: 'req-1', token: 't' },
} as unknown as ContextoGraphql;

function crear() {
  const servicio = { consultar: vi.fn().mockResolvedValue([]) };
  return {
    servicio,
    ia: new IaCliente(servicio as unknown as ClienteServicio),
  };
}

describe('IaCliente', () => {
  it('predicciones pide GET /predicciones con los ids separados por coma y escapados', async () => {
    const { servicio, ia } = crear();
    await ia.predicciones(['o1', 'a/b'], contexto);
    expect(servicio.consultar).toHaveBeenCalledWith(
      'ia',
      '/predicciones?obraIds=o1,a%2Fb',
      contexto,
    );
  });

  it('prediccionObra pide GET /obras/{id}/prediccion con el historial', async () => {
    const { servicio, ia } = crear();
    await ia.prediccionObra('a/b', 30, contexto);
    expect(servicio.consultar).toHaveBeenCalledWith(
      'ia',
      '/obras/a%2Fb/prediccion?historial=30',
      contexto,
    );
  });

  it('modeloRiesgo pide GET /modelos/riesgo-retraso', async () => {
    const { servicio, ia } = crear();
    await ia.modeloRiesgo(contexto);
    expect(servicio.consultar).toHaveBeenCalledWith(
      'ia',
      '/modelos/riesgo-retraso',
      contexto,
    );
  });
});
