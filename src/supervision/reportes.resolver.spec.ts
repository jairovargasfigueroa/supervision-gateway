import type { ContextoGraphql } from '../comun/auth/contexto.js';
import type { IaCliente } from './ia.cliente.js';
import { ReportesResolver } from './reportes.resolver.js';

const contexto = {
  req: { requestId: 'req-1', token: 't' },
} as unknown as ContextoGraphql;

function crear() {
  const ia = {
    catalogoReportes: vi.fn().mockResolvedValue({ conjuntos: [], atajos: [] }),
    consultasReporte: vi.fn().mockResolvedValue([]),
  };
  return {
    ia,
    resolver: new ReportesResolver(ia as unknown as IaCliente),
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
});
