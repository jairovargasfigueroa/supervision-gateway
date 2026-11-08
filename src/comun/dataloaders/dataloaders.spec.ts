import type { ContextoGraphql } from '../auth/contexto.js';
import { cadaUno, cargador, unaVezPorPeticion } from './dataloaders.js';

const nuevoContexto = () =>
  ({ req: { requestId: 'r', token: 't' } }) as unknown as ContextoGraphql;

describe('DataLoaders por petición', () => {
  it('la misma petición reutiliza el DataLoader y pide una vez cada clave', async () => {
    const contexto = nuevoContexto();
    const pedir = vi.fn((id: string) => Promise.resolve(`obra ${id}`));
    const cargar = cadaUno(pedir);

    const [a, b] = await Promise.all([
      cargador(contexto, 'obras', cargar).load('1'),
      cargador(contexto, 'obras', cargar).load('1'),
    ]);
    await cargador(contexto, 'obras', cargar).load('1');

    expect([a, b]).toEqual(['obra 1', 'obra 1']);
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it('otra petición tiene sus propios DataLoaders (no comparte caché entre usuarios)', async () => {
    const pedir = vi.fn((id: string) => Promise.resolve(id));
    await cargador(nuevoContexto(), 'obras', cadaUno(pedir)).load('1');
    await cargador(nuevoContexto(), 'obras', cadaUno(pedir)).load('1');
    expect(pedir).toHaveBeenCalledTimes(2);
  });

  it('cadaUno: si una clave falla, solo esa recibe el error', async () => {
    const contexto = nuevoContexto();
    const fallo = new Error('no responde');
    const carga = cargador(
      contexto,
      'usuarios',
      cadaUno((id: string) =>
        id === 'malo' ? Promise.reject(fallo) : Promise.resolve(id),
      ),
    );
    const [bueno, malo] = await Promise.allSettled([
      carga.load('bueno'),
      carga.load('malo'),
    ]);
    expect(bueno).toEqual({ status: 'fulfilled', value: 'bueno' });
    expect(malo).toEqual({ status: 'rejected', reason: fallo });
  });

  it('unaVezPorPeticion pide el valor una sola vez aunque se use en varios momentos', async () => {
    const contexto = nuevoContexto();
    const pedir = vi.fn(() => Promise.resolve(['catálogo']));
    await unaVezPorPeticion(contexto, 'catalogo', pedir);
    await unaVezPorPeticion(contexto, 'catalogo', pedir);
    expect(pedir).toHaveBeenCalledTimes(1);
  });
});
