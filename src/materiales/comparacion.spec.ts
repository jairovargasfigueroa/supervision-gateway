import { GraphQLError } from 'graphql';
import { compararMaterial } from './comparacion.js';
import type { Material } from './modelos/material.modelo.js';

const material = (id: string, codigo: string) =>
  ({ id, codigo, nombre: `Material ${codigo}` }) as Material;
const CATALOGO = new Map([
  ['cem', material('cem', 'CEM-IP30')],
  ['ace', material('ace', 'ACE-12')],
  ['lad', material('lad', 'LAD-6H')],
]);
const PARTIDAS = [
  { id: 'p1', codigo: 'P-01' },
  { id: 'p2', codigo: 'P-02' },
];

const previsto = (
  items: { partidaId: string; materialId: string; cantidadPrevista: number }[],
  hayPlanilla = true,
) => ({ periodo: '2027-02', hayPlanilla, items });

describe('compararMaterial', () => {
  it('une previsto y usado por partida y material y calcula la diferencia (usado − previsto)', () => {
    const resultado = compararMaterial(
      PARTIDAS,
      previsto([
        { partidaId: 'p1', materialId: 'cem', cantidadPrevista: 55 },
        { partidaId: 'p1', materialId: 'ace', cantidadPrevista: 400 },
      ]),
      [{ partidaId: 'p1', materialId: 'cem', cantidad: 60.5 }],
      CATALOGO,
    );
    expect(resultado.periodo).toBe('2027-02');
    expect(resultado.hayPlanilla).toBe(true);
    expect(
      resultado.filas.map(({ material: m, ...fila }) => ({
        ...fila,
        codigo: m.codigo,
      })),
    ).toEqual([
      {
        partidaId: 'p1',
        partidaCodigo: 'P-01',
        codigo: 'ACE-12',
        previsto: 400,
        usado: 0,
        diferencia: -400,
        excedido: false,
      },
      {
        partidaId: 'p1',
        partidaCodigo: 'P-01',
        codigo: 'CEM-IP30',
        previsto: 55,
        usado: 60.5,
        diferencia: 5.5,
        excedido: false,
      },
    ]);
  });

  it('excedido solo cuando usado > 1,20 × previsto (el borde exacto no cuenta)', () => {
    const fila = (usado: number) =>
      compararMaterial(
        PARTIDAS,
        previsto([
          { partidaId: 'p1', materialId: 'cem', cantidadPrevista: 55 },
        ]),
        [{ partidaId: 'p1', materialId: 'cem', cantidad: usado }],
        CATALOGO,
      ).filas[0];
    expect(fila(66).excedido).toBe(false);
    expect(fila(66.001).excedido).toBe(true);
    expect(fila(66.001).diferencia).toBe(11.001);
  });

  it('el borde con decimales no sufre errores de redondeo (0,1 × 1,2 = 0,12)', () => {
    const [fila] = compararMaterial(
      PARTIDAS,
      previsto([{ partidaId: 'p1', materialId: 'cem', cantidadPrevista: 0.1 }]),
      [{ partidaId: 'p1', materialId: 'cem', cantidad: 0.12 }],
      CATALOGO,
    ).filas;
    expect(fila.excedido).toBe(false);
    expect(fila.diferencia).toBe(0.02);
  });

  it('sin planilla en el periodo el previsto es 0: todo lo usado queda excedido', () => {
    const resultado = compararMaterial(
      PARTIDAS,
      previsto([], false),
      [{ partidaId: 'p2', materialId: 'lad', cantidad: 120 }],
      CATALOGO,
    );
    expect(resultado.hayPlanilla).toBe(false);
    expect(resultado.filas).toMatchObject([
      {
        partidaId: 'p2',
        partidaCodigo: 'P-02',
        previsto: 0,
        usado: 120,
        diferencia: 120,
        excedido: true,
      },
    ]);
  });

  it('ordena por el orden de las partidas de la obra y luego por código de material', () => {
    const { filas } = compararMaterial(
      PARTIDAS,
      previsto([
        { partidaId: 'p2', materialId: 'cem', cantidadPrevista: 1 },
        { partidaId: 'p1', materialId: 'lad', cantidadPrevista: 1 },
        { partidaId: 'p1', materialId: 'cem', cantidadPrevista: 1 },
      ]),
      [],
      CATALOGO,
    );
    expect(filas.map((f) => `${f.partidaCodigo} ${f.material.codigo}`)).toEqual(
      ['P-01 CEM-IP30', 'P-01 LAD-6H', 'P-02 CEM-IP30'],
    );
  });

  it('sin previsto ni consumos no hay filas', () => {
    expect(
      compararMaterial(PARTIDAS, previsto([]), [], CATALOGO).filas,
    ).toEqual([]);
  });

  it('un material que no está en el catálogo es ERROR_INTERNO de materiales', () => {
    expect(() =>
      compararMaterial(
        PARTIDAS,
        previsto([{ partidaId: 'p1', materialId: 'x', cantidadPrevista: 1 }]),
        [],
        CATALOGO,
      ),
    ).toThrow(GraphQLError);
  });
});
