import { buildSchema } from 'graphql';
import { listasInternasNoNulas } from './listas-anidadas.js';

describe('listasInternasNoNulas', () => {
  it('cambia [[String]]! por [[String]!]! y deja los demás campos como estaban', () => {
    const esquema = listasInternasNoNulas([['Reporte', 'filas']])(
      buildSchema(
        'type Reporte { filas: [[String]]! otras: [[String]] } type Query { r: Reporte }',
      ),
    );
    const campos = esquema.getTypeMap().Reporte.toConfig() as {
      fields: Record<string, { type: { toString(): string } }>;
    };
    expect(campos.fields.filas.type.toString()).toBe('[[String]!]!');
    expect(campos.fields.otras.type.toString()).toBe('[[String]]');
  });

  it('falla al armar el esquema si el campo no existe o no es una lista de listas', () => {
    const esquema = () =>
      buildSchema(
        'type Reporte { filas: [String]! } type Query { r: Reporte }',
      );
    expect(() =>
      listasInternasNoNulas([['Reporte', 'nada']])(esquema()),
    ).toThrow('No existe Reporte.nada');
    expect(() =>
      listasInternasNoNulas([['Reporte', 'filas']])(esquema()),
    ).toThrow('no es una lista de listas');
  });
});
