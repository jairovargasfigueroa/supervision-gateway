import { buildSchema, parse, validate } from 'graphql';
import { limitarConsultas } from './limites.js';

const esquema = buildSchema(`
  type Nodo { id: ID! hijo: Nodo }
  type Query { nodo: Nodo }
`);

const anidada = (niveles: number) =>
  `{ nodo ${'{ hijo '.repeat(niveles - 1)}{ id }${' }'.repeat(niveles - 1)} }`;
const errores = (consulta: string, profundidad = 8, complejidad = 1000) =>
  validate(esquema, parse(consulta), [
    limitarConsultas(profundidad, complejidad),
  ]);

describe('limitarConsultas', () => {
  it('acepta una consulta dentro de la profundidad máxima', () => {
    expect(errores(anidada(7))).toEqual([]);
  });

  it('rechaza una consulta más profunda que el máximo con DATOS_INVALIDOS', () => {
    const [error] = errores(anidada(9));
    expect(error.message).toContain('profundidad máxima');
    expect(error.extensions).toMatchObject({ codigo: 'DATOS_INVALIDOS' });
  });

  it('cuenta la profundidad dentro de los fragmentos', () => {
    const consulta = `{ nodo { ...F } } fragment F on Nodo { hijo { hijo { hijo { id } } } }`;
    expect(errores(consulta, 4)).toHaveLength(1);
    expect(errores(consulta, 5)).toEqual([]);
  });

  it('rechaza una consulta con más campos que la complejidad máxima', () => {
    const consulta = `{ ${Array.from({ length: 6 }, (_, i) => `a${i}: nodo { id }`).join(' ')} }`;
    expect(errores(consulta, 8, 12)).toEqual([]);
    expect(errores(consulta, 8, 11)[0].message).toContain('complejidad máxima');
  });
});
