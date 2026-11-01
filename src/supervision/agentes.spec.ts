import { ejecucionDesdeRest } from './agentes.js';
import type { EjecucionAgenteRest } from './ia.cliente.js';

const hallazgo = {
  obraId: 'o1',
  obraNombre: 'Edificio Las Palmas',
  tipo: 'STOCK_BAJO',
  severidad: 'ALTA',
  situacion: 'Cemento IP-30: 80 bolsas, mínimo 100',
  causaProbable: 'Consumo de la losa mayor al previsto',
  evidencia: [{ herramienta: 'stock_obra', dato: 'cantidad 80, mínimo 100' }],
};
const ejecucion: EjecucionAgenteRest = {
  id: 'e1',
  agente: 'CONTROL_MATERIALES',
  origen: 'MANUAL',
  estado: 'TERMINADA',
  solicitadaPor: 'u1',
  iniciadaEn: '2027-04-20T10:00:00Z',
  terminadaEn: '2027-04-20T10:01:12Z',
  proveedorLlm: 'ollama',
  modelo: 'qwen3:8b',
  resumen: '2 obras con cemento bajo',
  error: null,
  pasos: [],
  hallazgos: [hallazgo],
};

describe('ejecucionDesdeRest', () => {
  it('completa ejecucionId, agente y detectadoEn (= terminadaEn) de cada hallazgo', () => {
    expect(ejecucionDesdeRest(ejecucion).hallazgos).toEqual([
      {
        ...hallazgo,
        ejecucionId: 'e1',
        agente: 'CONTROL_MATERIALES',
        detectadoEn: '2027-04-20T10:01:12Z',
      },
    ]);
  });

  it('respeta lo que ya manda IA y deja el resto de la ejecución igual', () => {
    const resultado = ejecucionDesdeRest({
      ...ejecucion,
      hallazgos: [{ ...hallazgo, detectadoEn: '2027-04-20T10:01:00Z' }],
    });
    expect(resultado.hallazgos[0].detectadoEn).toBe('2027-04-20T10:01:00Z');
    expect(resultado).toMatchObject({
      id: 'e1',
      proveedorLlm: 'ollama',
      solicitadaPor: 'u1',
    });
  });
});
