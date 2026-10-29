import type { ContextoGraphql } from '../comun/auth/contexto.js';
import type { ClienteServicio } from '../comun/http/cliente-servicio.js';
import { ObrasCliente, type RegistrarObraRest } from './obras.cliente.js';

const contexto = {
  req: { requestId: 'req-1', token: 't' },
} as unknown as ContextoGraphql;

function crear() {
  const servicio = {
    consultar: vi.fn().mockResolvedValue({ id: 'o1' }),
    enviar: vi.fn().mockResolvedValue({ id: 'o1' }),
  };
  return {
    servicio,
    obras: new ObrasCliente(servicio as unknown as ClienteServicio),
  };
}

describe('ObrasCliente', () => {
  it('obtener pide GET /obras/{id} con el id escapado', async () => {
    const { servicio, obras } = crear();
    await obras.obtener('a/b', contexto);
    expect(servicio.consultar).toHaveBeenCalledWith(
      'obras',
      '/obras/a%2Fb',
      contexto,
    );
  });

  it('registrar envía POST /obras con la entrada tal cual (sin reintento: enviar)', async () => {
    const { servicio, obras } = crear();
    const entrada = { nombre: 'Edificio' } as RegistrarObraRest;
    await obras.registrar(entrada, contexto);
    expect(servicio.enviar).toHaveBeenCalledWith(
      'obras',
      'POST',
      '/obras',
      entrada,
      contexto,
    );
    expect(servicio.consultar).not.toHaveBeenCalled();
  });

  it('listar arma los filtros en la consulta', async () => {
    const { servicio, obras } = crear();
    await obras.listar({ estado: undefined, busqueda: 'Palmas' }, contexto);
    expect(servicio.consultar).toHaveBeenCalledWith(
      'obras',
      '/obras?busqueda=Palmas',
      contexto,
    );
  });
});
