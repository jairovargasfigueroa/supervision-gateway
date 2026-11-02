import type { ContextoGraphql } from '../comun/auth/contexto.js';
import type { ClienteServicio } from '../comun/http/cliente-servicio.js';
import { FinanzasCliente } from './finanzas.cliente.js';

const contexto = {
  req: { requestId: 'req-1', token: 't' },
} as unknown as ContextoGraphql;

function crear() {
  const servicio = {
    consultar: vi.fn().mockResolvedValue({ id: 'c1' }),
    enviar: vi.fn().mockResolvedValue({ id: 'c1', estado: 'PAGADO' }),
  };
  return {
    servicio,
    finanzas: new FinanzasCliente(servicio as unknown as ClienteServicio),
  };
}

describe('FinanzasCliente', () => {
  describe('registrarPago (201)', () => {
    it('envía POST /cobros/{id}/pago con fecha y comprobante (sin reintento: enviar) y devuelve el cobro', async () => {
      const { servicio, finanzas } = crear();
      const cobro = await finanzas.registrarPago(
        'c/1',
        { pagadoEn: '2027-04-28', comprobante: 'TRF-883412' },
        contexto,
      );
      expect(servicio.enviar).toHaveBeenCalledWith(
        'finanzas',
        'POST',
        '/cobros/c%2F1/pago',
        { pagadoEn: '2027-04-28', comprobante: 'TRF-883412' },
        contexto,
      );
      expect(servicio.consultar).not.toHaveBeenCalled();
      expect(cobro).toEqual({ id: 'c1', estado: 'PAGADO' });
    });

    it.each([[undefined], [null]])(
      'sin comprobante (%s) envía solo la fecha',
      async (comprobante) => {
        const { servicio, finanzas } = crear();
        await finanzas.registrarPago(
          'c1',
          { pagadoEn: '2027-04-28', comprobante },
          contexto,
        );
        expect(servicio.enviar).toHaveBeenCalledWith(
          'finanzas',
          'POST',
          '/cobros/c1/pago',
          { pagadoEn: '2027-04-28' },
          contexto,
        );
      },
    );
  });
});
