import type { ContextoGraphql } from '../comun/auth/contexto.js';
import type { ClienteServicio } from '../comun/http/cliente-servicio.js';
import { IaCliente } from './ia.cliente.js';
import { EstadoRevision } from './modelos/consumo-atipico.modelo.js';

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

  it('consumosAtipicos pide GET /consumos-atipicos con la obra y, si viene, el estado', async () => {
    const { servicio, ia } = crear();
    await ia.consumosAtipicos({ obraId: 'a/b' }, contexto);
    expect(servicio.consultar).toHaveBeenLastCalledWith(
      'ia',
      '/consumos-atipicos?obraId=a%2Fb',
      contexto,
    );
    await ia.consumosAtipicos(
      { obraId: 'o1', estado: EstadoRevision.NORMAL },
      contexto,
    );
    expect(servicio.consultar).toHaveBeenLastCalledWith(
      'ia',
      '/consumos-atipicos?obraId=o1&estado=NORMAL',
      contexto,
    );
  });

  it('resumenAtipicos pide GET /consumos-atipicos/resumen con los ids separados por coma', async () => {
    const { servicio, ia } = crear();
    await ia.resumenAtipicos(['o1', 'a/b'], contexto);
    expect(servicio.consultar).toHaveBeenCalledWith(
      'ia',
      '/consumos-atipicos/resumen?obraIds=o1,a%2Fb',
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
