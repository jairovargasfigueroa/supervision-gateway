import { Limitador } from './limitador.js';

describe('Limitador', () => {
  it('deja pasar hasta el máximo por minuto y luego pide esperar lo que falta de la ventana', () => {
    let ahora = 0;
    const limitador = new Limitador(3, () => ahora);
    expect([1, 2, 3].map(() => limitador.registrar('u1'))).toEqual([0, 0, 0]);
    ahora = 20_000;
    expect(limitador.registrar('u1')).toBe(40);
  });

  it('cuenta a cada usuario por separado', () => {
    const limitador = new Limitador(1, () => 0);
    expect(limitador.registrar('u1')).toBe(0);
    expect(limitador.registrar('u2')).toBe(0);
    expect(limitador.registrar('u1')).toBeGreaterThan(0);
  });

  it('vuelve a dejar pasar cuando termina el minuto', () => {
    let ahora = 0;
    const limitador = new Limitador(1, () => ahora);
    limitador.registrar('u1');
    expect(limitador.registrar('u1')).toBeGreaterThan(0);
    ahora = 60_000;
    expect(limitador.registrar('u1')).toBe(0);
  });
});
