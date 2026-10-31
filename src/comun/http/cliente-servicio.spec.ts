import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { GraphQLError } from 'graphql';
import type { ContextoGraphql } from '../auth/contexto.js';
import { ClienteServicio } from './cliente-servicio.js';

/** Servicio simulado: cada prueba decide cómo responde según el método y la ruta. */
let servidor: Server;
let base: string;
let llamadas: {
  metodo: string;
  ruta: string;
  encabezados: IncomingHttpHeaders;
}[];
let responder: (
  metodo: string,
  ruta: string,
  intento: number,
) => { estado: number; cuerpo?: unknown; demoraMs?: number };

beforeAll(async () => {
  servidor = createServer((req, res) => {
    llamadas.push({
      metodo: req.method!,
      ruta: req.url!,
      encabezados: req.headers,
    });
    const {
      estado,
      cuerpo,
      demoraMs = 0,
    } = responder(req.method!, req.url!, llamadas.length);
    setTimeout(() => {
      res.statusCode = estado;
      if (cuerpo !== undefined) {
        res.setHeader(
          'content-type',
          estado >= 400 ? 'application/problem+json' : 'application/json',
        );
        res.end(JSON.stringify(cuerpo));
      } else {
        res.end();
      }
    }, demoraMs);
  });
  await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterAll(() => {
  servidor.closeAllConnections();
  servidor.close();
});

beforeEach(() => {
  llamadas = [];
});

const contexto = {
  req: { requestId: 'req-1', token: 'token-usuario' },
} as unknown as ContextoGraphql;
const cliente = (tiempoMaximoMs = 200, url = () => base) =>
  new ClienteServicio({
    urls: { obras: url(), materiales: url(), finanzas: url(), ia: url() },
    tiempoMaximoMs,
  });

async function errorDe(promesa: Promise<unknown>): Promise<GraphQLError> {
  try {
    await promesa;
  } catch (error) {
    return error as GraphQLError;
  }
  throw new Error('se esperaba un error');
}

describe('ClienteServicio', () => {
  it('reenvía el token del usuario y el X-Request-Id y devuelve el JSON', async () => {
    responder = () => ({ estado: 200, cuerpo: [{ id: 'o1' }] });
    await expect(
      cliente().consultar('obras', '/obras', contexto),
    ).resolves.toEqual([{ id: 'o1' }]);
    expect(llamadas[0].encabezados.authorization).toBe('Bearer token-usuario');
    expect(llamadas[0].encabezados['x-request-id']).toBe('req-1');
  });

  it('envía el cuerpo de una mutación como JSON', async () => {
    responder = () => ({ estado: 201, cuerpo: { id: 'o1' } });
    await cliente().enviar(
      'obras',
      'POST',
      '/obras',
      { nombre: 'Obra' },
      contexto,
    );
    expect(llamadas[0].metodo).toBe('POST');
    expect(llamadas[0].encabezados['content-type']).toBe('application/json');
  });

  it('reintenta una vez una consulta que falla con 5xx', async () => {
    responder = (_m, _r, intento) =>
      intento === 1 ? { estado: 502 } : { estado: 200, cuerpo: [] };
    await expect(
      cliente().consultar('obras', '/obras', contexto),
    ).resolves.toEqual([]);
    expect(llamadas).toHaveLength(2);
  });

  it('no reintenta una mutación', async () => {
    responder = () => ({
      estado: 500,
      cuerpo: { title: 'Error', codigo: 'ERROR_INTERNO' },
    });
    const error = await errorDe(
      cliente().enviar('obras', 'POST', '/obras', {}, contexto),
    );
    expect(llamadas).toHaveLength(1);
    expect(error.extensions).toMatchObject({
      codigo: 'ERROR_INTERNO',
      servicio: 'obras',
      estado: 500,
    });
  });

  it('corta al pasar el tiempo máximo, reintenta la consulta una vez y responde SERVICIO_NO_DISPONIBLE', async () => {
    responder = () => ({ estado: 200, cuerpo: [], demoraMs: 500 });
    const error = await errorDe(
      cliente(100).consultar('obras', '/obras', contexto),
    );
    expect(llamadas).toHaveLength(2);
    expect(error.extensions).toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE',
      servicio: 'obras',
    });
  });

  it('responde SERVICIO_NO_DISPONIBLE si el servicio está apagado', async () => {
    const error = await errorDe(
      cliente(200, () => 'http://127.0.0.1:1').consultar(
        'finanzas',
        '/cobros',
        contexto,
      ),
    );
    expect(error.extensions).toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE',
      servicio: 'finanzas',
    });
  });

  it('pasa el codigo y los errores de un Problem Details sin reintentar los 4xx', async () => {
    responder = () => ({
      estado: 422,
      cuerpo: {
        title: 'El presupuesto no coincide',
        status: 422,
        codigo: 'PRESUPUESTO_NO_COINCIDE',
        errores: [{ campo: 'partidas', mensaje: 'No suma el monto' }],
      },
    });
    const error = await errorDe(
      cliente().consultar('obras', '/obras', contexto),
    );
    expect(llamadas).toHaveLength(1);
    expect(error.message).toBe('El presupuesto no coincide');
    expect(error.extensions).toMatchObject({
      codigo: 'PRESUPUESTO_NO_COINCIDE',
      servicio: 'obras',
      estado: 422,
      errores: [{ campo: 'partidas', mensaje: 'No suma el monto' }],
    });
  });

  it('402: IA lento corta a los 3 s (tiempo máximo), reintenta la consulta y responde SERVICIO_NO_DISPONIBLE con servicio ia', async () => {
    responder = () => ({ estado: 200, cuerpo: [], demoraMs: 500 });
    const error = await errorDe(
      cliente(100).consultar('ia', '/predicciones?obraIds=o1', contexto),
    );
    expect(llamadas).toHaveLength(2);
    expect(error.extensions).toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE',
      servicio: 'ia',
    });
  });

  it('402: los errores de IA llegan con su codigo y servicio ia', async () => {
    responder = () => ({
      estado: 400,
      cuerpo: { title: 'Demasiadas obras', codigo: 'DEMASIADAS_OBRAS' },
    });
    const error = await errorDe(
      cliente().consultar('ia', '/predicciones?obraIds=o1', contexto),
    );
    expect(llamadas).toHaveLength(1);
    expect(error.extensions).toMatchObject({
      codigo: 'DEMASIADAS_OBRAS',
      servicio: 'ia',
      estado: 400,
    });
  });

  it('usa el código genérico del estado si el servicio no manda uno', async () => {
    responder = () => ({ estado: 403 });
    const error = await errorDe(
      cliente().consultar('obras', '/obras', contexto),
    );
    expect(error.extensions).toMatchObject({
      codigo: 'SIN_PERMISO',
      estado: 403,
    });
  });
});
