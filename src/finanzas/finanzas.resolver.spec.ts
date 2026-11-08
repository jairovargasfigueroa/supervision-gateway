import type { FinanzasCliente } from './finanzas.cliente.js';
import { CobroResolver } from './finanzas.resolver.js';
import {
  type Cobro,
  EstadoCobro,
  TipoEnvioCobro,
} from './modelos/cobro.modelo.js';

/** Cobro pagado tal como lo manda Finanzas (`envios` solo si viene). */
const cobro = (envios?: Cobro['envios']): Cobro => ({
  id: 'c1',
  numero: 'COB-2027-0003',
  planillaId: 'pl1',
  montoNeto: 41881.8,
  emitidoEn: '2027-04-02',
  venceEn: '2027-05-02',
  estado: EstadoCobro.PAGADO,
  pagadoEn: '2027-04-28',
  comprobante: 'TRF-883412',
  ...(envios && { envios }),
});

describe('CobroResolver (201)', () => {
  const resolver = new CobroResolver({} as FinanzasCliente);

  it('envios devuelve la lista de Finanzas tal cual', () => {
    const envios = [
      {
        tipo: TipoEnvioCobro.NOTA_COBRO,
        destinatario: 'cliente1@correo.test',
        enviadoEn: '2027-04-02T12:05:00Z',
      },
      {
        tipo: TipoEnvioCobro.CONSTANCIA_PAGO,
        destinatario: 'cliente1@correo.test',
        enviadoEn: '2027-04-28T14:00:41Z',
      },
    ];
    expect(resolver.envios(cobro(envios))).toEqual(envios);
  });

  it('envios devuelve una lista vacía si Finanzas no manda el campo', () => {
    expect(resolver.envios(cobro())).toEqual([]);
  });
});
