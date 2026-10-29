import type { ContextoGraphql } from '../comun/auth/contexto.js';
import type { ClienteServicio } from '../comun/http/cliente-servicio.js';
import { MaterialesCliente, type MaterialRest } from './materiales.cliente.js';
import { TipoMaterial } from './modelos/material.modelo.js';

const contexto = {
  req: { requestId: 'req-1', token: 't' },
} as unknown as ContextoGraphql;

const MATERIAL: MaterialRest = {
  codigo: 'CEM-IP30',
  nombre: 'Cemento IP-30',
  tipo: TipoMaterial.CEMENTO,
  unidad: 'bolsa',
  unidadPlural: 'bolsas',
  precioReferencial: 62,
  atributos: [{ nombre: 'peso', valor: '50 kg' }],
};

function crear() {
  const servicio = {
    consultar: vi
      .fn()
      .mockResolvedValue({ items: [], total: 0, pagina: 1, tamano: 20 }),
    enviar: vi.fn().mockResolvedValue({ id: 'm1' }),
  };
  return {
    servicio,
    materiales: new MaterialesCliente(servicio as unknown as ClienteServicio),
  };
}

describe('MaterialesCliente', () => {
  it('listar arma búsqueda, soloActivos y paginación en la consulta', async () => {
    const { servicio, materiales } = crear();
    await materiales.listar(
      { busqueda: 'cem ip', soloActivos: true, pagina: 2, tamano: 50 },
      contexto,
    );
    expect(servicio.consultar).toHaveBeenCalledWith(
      'materiales',
      '/materiales?busqueda=cem+ip&soloActivos=true&pagina=2&tamano=50',
      contexto,
    );
  });

  it('listar sin filtros pide /materiales y manda soloActivos=false cuando es false', async () => {
    const { servicio, materiales } = crear();
    await materiales.listar({}, contexto);
    expect(servicio.consultar).toHaveBeenLastCalledWith(
      'materiales',
      '/materiales',
      contexto,
    );
    await materiales.listar({ soloActivos: false }, contexto);
    expect(servicio.consultar).toHaveBeenLastCalledWith(
      'materiales',
      '/materiales?soloActivos=false',
      contexto,
    );
  });

  it('stockObra pide GET /obras/{obraId}/stock con el id escapado', async () => {
    const { servicio, materiales } = crear();
    await materiales.stockObra('a/b', contexto);
    expect(servicio.consultar).toHaveBeenCalledWith(
      'materiales',
      '/obras/a%2Fb/stock',
      contexto,
    );
  });

  it('crear envía POST /materiales con la entrada tal cual (sin reintento: enviar)', async () => {
    const { servicio, materiales } = crear();
    await materiales.crear(MATERIAL, contexto);
    expect(servicio.enviar).toHaveBeenCalledWith(
      'materiales',
      'POST',
      '/materiales',
      MATERIAL,
      contexto,
    );
    expect(servicio.consultar).not.toHaveBeenCalled();
  });

  it('actualizar envía PUT /materiales/{id} con el material completo', async () => {
    const { servicio, materiales } = crear();
    const entrada = { ...MATERIAL, activo: false };
    await materiales.actualizar('m 1', entrada, contexto);
    expect(servicio.enviar).toHaveBeenCalledWith(
      'materiales',
      'PUT',
      '/materiales/m%201',
      entrada,
      contexto,
    );
  });

  it('catalogo pide de a 100 y las páginas restantes, y junta los materiales', async () => {
    const { servicio, materiales } = crear();
    servicio.consultar.mockImplementation((_s: string, ruta: string) => {
      const pagina = Number(
        new URLSearchParams(ruta.split('?')[1]).get('pagina'),
      );
      return Promise.resolve({
        items: [{ id: `m${pagina}` }],
        total: 250,
        pagina,
        tamano: 100,
      });
    });
    const catalogo = await materiales.catalogo(contexto);
    expect(catalogo.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(servicio.consultar.mock.calls.map((llamada) => llamada[1])).toEqual([
      '/materiales?pagina=1&tamano=100',
      '/materiales?pagina=2&tamano=100',
      '/materiales?pagina=3&tamano=100',
    ]);
  });

  it('catalogoPorId pide el catálogo una sola vez por petición', async () => {
    const { servicio, materiales } = crear();
    servicio.consultar.mockResolvedValue({
      items: [{ id: 'm1', nombre: 'Cemento' }],
      total: 1,
      pagina: 1,
      tamano: 100,
    });
    const peticion = {
      req: { requestId: 'r2', token: 't' },
    } as unknown as ContextoGraphql;
    await materiales.catalogoPorId(peticion);
    const porId = await materiales.catalogoPorId(peticion);
    expect(porId.get('m1')).toMatchObject({ nombre: 'Cemento' });
    expect(servicio.consultar).toHaveBeenCalledTimes(1);
  });

  it('definirMinimo envía PUT /obras/{obraId}/stock/{materialId}/minimo con { minimo }', async () => {
    const { servicio, materiales } = crear();
    await materiales.definirMinimo('o1', 'm1', 100, contexto);
    expect(servicio.enviar).toHaveBeenCalledWith(
      'materiales',
      'PUT',
      '/obras/o1/stock/m1/minimo',
      { minimo: 100 },
      contexto,
    );
  });
});
