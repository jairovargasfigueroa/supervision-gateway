import { errorDesdeRespuesta, servicioNoDisponible } from './errores.js';

const problema = (estado: number, cuerpo: unknown, tipo = 'application/problem+json') =>
  new Response(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': tipo },
  });

describe('errorDesdeRespuesta (Problem Details → extensions.codigo)', () => {
  it('copia el codigo, el estado, el servicio y los errores por campo', async () => {
    const error = await errorDesdeRespuesta(
      problema(422, {
        title: 'Partidas repetidas',
        status: 422,
        detail: 'P-01 aparece dos veces',
        codigo: 'CODIGO_PARTIDA_REPETIDO',
        errores: [{ campo: 'partidas[1].codigo', mensaje: 'Repetido' }],
      }),
      'obras',
    );
    expect(error.message).toBe('Partidas repetidas');
    expect(error.extensions).toEqual({
      codigo: 'CODIGO_PARTIDA_REPETIDO',
      servicio: 'obras',
      estado: 422,
      errores: [{ campo: 'partidas[1].codigo', mensaje: 'Repetido' }],
    });
  });

  it('el detail del servicio no viaja al ERP (queda para soporte)', async () => {
    const error = await errorDesdeRespuesta(
      problema(404, {
        title: 'No encontrada',
        detail: 'id x',
        codigo: 'OBRA_NO_ENCONTRADA',
      }),
      'obras',
    );
    expect(JSON.stringify(error.extensions)).not.toContain('id x');
    expect(error.extensions.codigo).toBe('OBRA_NO_ENCONTRADA');
  });

  it('sin cuerpo JSON usa el código genérico del estado', async () => {
    expect((await errorDesdeRespuesta(problema(400, 'mal', 'text/plain'), 'obras')).extensions.codigo).toBe(
      'DATOS_INVALIDOS',
    );
    expect((await errorDesdeRespuesta(problema(403, '{roto', 'application/json'), 'obras')).extensions.codigo).toBe(
      'SIN_PERMISO',
    );
    expect((await errorDesdeRespuesta(problema(502, ''), 'finanzas')).extensions).toMatchObject({
      codigo: 'ERROR_INTERNO',
      servicio: 'finanzas',
      estado: 502,
    });
  });

  it('servicioNoDisponible marca el servicio que no respondió', () => {
    expect(servicioNoDisponible('keycloak').extensions).toEqual({
      codigo: 'SERVICIO_NO_DISPONIBLE',
      servicio: 'keycloak',
      estado: 503,
    });
  });
});
