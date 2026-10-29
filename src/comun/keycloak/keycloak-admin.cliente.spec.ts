import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { GraphQLError } from 'graphql';
import { KeycloakAdminCliente } from './keycloak-admin.cliente.js';

/** Keycloak simulado: endpoint de token y API de administración del realm. */
let servidor: Server;
let base: string;
let pedidosToken: string[];
let llamadas: { ruta: string; encabezados: IncomingHttpHeaders }[];
let responderAdmin: (
  ruta: string,
  intento: number,
) => { estado: number; cuerpo?: unknown; demoraMs?: number };
let tokenEmitido: number;

beforeAll(async () => {
  servidor = createServer((req, res) => {
    let cuerpo = '';
    req.on('data', (parte: Buffer) => (cuerpo += parte.toString()));
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      if (req.url === '/realms/supervision/protocol/openid-connect/token') {
        pedidosToken.push(cuerpo);
        tokenEmitido++;
        res.end(
          JSON.stringify({
            access_token: `token-${tokenEmitido}`,
            expires_in: 300,
          }),
        );
        return;
      }
      llamadas.push({ ruta: req.url!, encabezados: req.headers });
      const {
        estado,
        cuerpo: respuesta,
        demoraMs = 0,
      } = responderAdmin(req.url!, llamadas.length);
      setTimeout(() => {
        res.statusCode = estado;
        res.end(
          respuesta === undefined ? undefined : JSON.stringify(respuesta),
        );
      }, demoraMs);
    });
  });
  await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterAll(() => {
  servidor.closeAllConnections();
  servidor.close();
});

beforeEach(() => {
  pedidosToken = [];
  llamadas = [];
  tokenEmitido = 0;
});

let reloj = 0;
const cliente = (url = base, tiempoMaximoMs = 200) =>
  new KeycloakAdminCliente(
    {
      url,
      realm: 'supervision',
      clientId: 'gateway',
      clientSecret: 'secreto',
      tiempoMaximoMs,
    },
    () => reloj,
  );

async function errorDe(promesa: Promise<unknown>): Promise<GraphQLError> {
  try {
    await promesa;
  } catch (error) {
    return error as GraphQLError;
  }
  throw new Error('se esperaba un error');
}

describe('KeycloakAdminCliente', () => {
  it('pide los usuarios del rol con el token del cliente gateway y arma nombre y correo', async () => {
    responderAdmin = () => ({
      estado: 200,
      cuerpo: [
        {
          id: 'u2',
          username: 'residente2',
          firstName: 'Rosa',
          lastName: 'Vaca',
          email: 'rosa@ejemplo.bo',
        },
        {
          id: 'u1',
          username: 'residente1',
          firstName: 'Ana',
          lastName: 'Pérez',
        },
        { id: 'u3', username: 'sin-nombre' },
      ],
    });
    const usuarios = await cliente().usuariosConRol('residente', 'req-1');

    expect(llamadas[0].ruta).toBe(
      '/admin/realms/supervision/roles/residente/users?first=0&max=1000',
    );
    expect(llamadas[0].encabezados.authorization).toBe('Bearer token-1');
    expect(llamadas[0].encabezados['x-request-id']).toBe('req-1');
    expect(new URLSearchParams(pedidosToken[0]).get('grant_type')).toBe(
      'client_credentials',
    );
    expect(new URLSearchParams(pedidosToken[0]).get('client_id')).toBe(
      'gateway',
    );
    expect(new URLSearchParams(pedidosToken[0]).get('client_secret')).toBe(
      'secreto',
    );
    expect(usuarios).toEqual([
      { id: 'u1', nombre: 'Ana Pérez', correo: null },
      { id: 'u2', nombre: 'Rosa Vaca', correo: 'rosa@ejemplo.bo' },
      { id: 'u3', nombre: 'sin-nombre', correo: null },
    ]);
  });

  it('reutiliza el token hasta poco antes de que venza y luego pide otro', async () => {
    responderAdmin = () => ({ estado: 200, cuerpo: [] });
    const keycloak = cliente();
    reloj = 0;
    await keycloak.usuariosConRol('admin', 'r');
    reloj = 260_000; // vence a los 300 s; margen de 30 s
    await keycloak.usuariosConRol('admin', 'r');
    expect(pedidosToken).toHaveLength(1);
    reloj = 271_000;
    await keycloak.usuariosConRol('admin', 'r');
    expect(pedidosToken).toHaveLength(2);
    expect(llamadas[2].encabezados.authorization).toBe('Bearer token-2');
  });

  it('pide un solo token aunque lleguen varias consultas a la vez', async () => {
    responderAdmin = () => ({ estado: 200, cuerpo: [] });
    const keycloak = cliente();
    await Promise.all(
      ['residente', 'maestro', 'almacenero', 'cliente'].map((rol) =>
        keycloak.usuariosConRol(rol, 'r'),
      ),
    );
    expect(pedidosToken).toHaveLength(1);
  });

  it('si Keycloak rechaza el token guardado, pide otro y reintenta', async () => {
    responderAdmin = (_ruta, intento) =>
      intento === 1 ? { estado: 401 } : { estado: 200, cuerpo: [] };
    await expect(cliente().usuariosConRol('admin', 'r')).resolves.toEqual([]);
    expect(pedidosToken).toHaveLength(2);
  });

  it('usuarioPorId devuelve null si Keycloak no conoce el id', async () => {
    responderAdmin = () => ({
      estado: 404,
      cuerpo: { error: 'User not found' },
    });
    await expect(cliente().usuarioPorId('no-existe', 'r')).resolves.toBeNull();
    expect(llamadas[0].ruta).toBe('/admin/realms/supervision/users/no-existe');
  });

  it('usuarioPorId guarda el usuario 5 minutos y después lo vuelve a pedir', async () => {
    reloj = 1_000_000;
    responderAdmin = () => ({
      estado: 200,
      cuerpo: { id: 'u1', firstName: 'Ana', lastName: 'Rojas' },
    });
    const keycloak = cliente();
    await expect(keycloak.usuarioPorId('u1', 'r')).resolves.toMatchObject({
      nombre: 'Ana Rojas',
    });
    reloj += 5 * 60_000 - 1;
    await keycloak.usuarioPorId('u1', 'r');
    expect(llamadas).toHaveLength(1);
    reloj += 1;
    await keycloak.usuarioPorId('u1', 'r');
    expect(llamadas).toHaveLength(2);
  });

  it('usuarioPorId no guarda los desconocidos ni los errores', async () => {
    responderAdmin = () => ({ estado: 404 });
    const keycloak = cliente();
    await keycloak.usuarioPorId('u2', 'r');
    await keycloak.usuarioPorId('u2', 'r');
    expect(llamadas).toHaveLength(2);
    responderAdmin = () => ({ estado: 403 });
    await errorDe(keycloak.usuarioPorId('u3', 'r'));
    responderAdmin = () => ({ estado: 200, cuerpo: { id: 'u3' } });
    await expect(keycloak.usuarioPorId('u3', 'r')).resolves.toMatchObject({
      id: 'u3',
    });
  });

  it('si Keycloak tarda más del tiempo máximo responde SERVICIO_NO_DISPONIBLE (keycloak)', async () => {
    responderAdmin = () => ({ estado: 200, cuerpo: [], demoraMs: 500 });
    const error = await errorDe(
      cliente(base, 100).usuariosConRol('admin', 'r'),
    );
    expect(llamadas).toHaveLength(2);
    expect(error.extensions).toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE',
      servicio: 'keycloak',
    });
  });

  it('si Keycloak está apagado responde SERVICIO_NO_DISPONIBLE (keycloak)', async () => {
    const error = await errorDe(
      cliente('http://127.0.0.1:1').usuariosConRol('admin', 'r'),
    );
    expect(error.extensions).toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE',
      servicio: 'keycloak',
    });
  });

  it('un 403 de Keycloak (cliente sin permisos) es ERROR_INTERNO del servicio keycloak', async () => {
    responderAdmin = () => ({ estado: 403 });
    const error = await errorDe(cliente().usuariosConRol('admin', 'r'));
    expect(error.extensions).toMatchObject({
      codigo: 'ERROR_INTERNO',
      servicio: 'keycloak',
      estado: 403,
    });
  });
});
