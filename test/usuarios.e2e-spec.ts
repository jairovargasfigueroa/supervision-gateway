import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { VERIFICADOR_TOKEN } from '../src/comun/auth/verificador-token.js';
import { crearClavesPrueba } from './soporte/tokens-prueba.js';

/** 002: usuarios(rol) contra un Keycloak simulado (token del cliente gateway + API de administración). */
describe('Consulta usuarios(rol) (e2e)', () => {
  let app: INestApplication;
  let keycloakSimulado: Server;
  let rutas: string[];
  let firmar: Awaited<ReturnType<typeof crearClavesPrueba>>['firmar'];

  beforeAll(async () => {
    keycloakSimulado = createServer((req, res) => {
      rutas.push(req.url!);
      res.setHeader('content-type', 'application/json');
      if (req.url!.endsWith('/protocol/openid-connect/token')) {
        res.end(
          JSON.stringify({ access_token: 'token-gateway', expires_in: 300 }),
        );
      } else if (req.headers.authorization !== 'Bearer token-gateway') {
        res.statusCode = 401;
        res.end('{}');
      } else {
        res.end(
          JSON.stringify([
            {
              id: 'a0000000-0000-4000-8000-000000000003',
              firstName: 'Rosa',
              lastName: 'Vaca',
              email: 'residente1@ejemplo.bo',
            },
          ]),
        );
      }
    });
    await new Promise<void>((listo) =>
      keycloakSimulado.listen(0, '127.0.0.1', listo),
    );
    process.env.KEYCLOAK_URL = `http://127.0.0.1:${(keycloakSimulado.address() as AddressInfo).port}`;

    const claves = await crearClavesPrueba();
    firmar = claves.firmar;
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(VERIFICADOR_TOKEN)
      .useValue(claves.verificador)
      .compile();
    app = modulo.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    rutas = [];
  });

  afterAll(async () => {
    await app.close();
    keycloakSimulado.closeAllConnections();
    keycloakSimulado.close();
  });

  const consultar = async (query: string, roles: string[]) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set(
        'Authorization',
        `Bearer ${await firmar({ sub: 'u-admin', realm_access: { roles } })}`,
      )
      .send({ query });

  it('admin recibe los usuarios del rol con nombre y correo', async () => {
    const respuesta = await consultar(
      '{ usuarios(rol: residente) { id nombre correo } }',
      ['admin'],
    );
    expect(respuesta.body).toEqual({
      data: {
        usuarios: [
          {
            id: 'a0000000-0000-4000-8000-000000000003',
            nombre: 'Rosa Vaca',
            correo: 'residente1@ejemplo.bo',
          },
        ],
      },
    });
    expect(rutas).toContain(
      '/admin/realms/supervision/roles/residente/users?first=0&max=1000',
    );
  });

  it('otro rol recibe SIN_PERMISO sin llamar a Keycloak', async () => {
    const respuesta = await consultar('{ usuarios(rol: residente) { id } }', [
      'gerente',
    ]);
    expect(respuesta.body.data).toBeNull();
    expect(respuesta.body.errors[0].extensions).toMatchObject({
      codigo: 'SIN_PERMISO',
      estado: 403,
    });
    expect(rutas).toEqual([]);
  });

  it('un rol que no está en el enum lo rechaza GraphQL sin llamar a Keycloak', async () => {
    const respuesta = await consultar('{ usuarios(rol: jefe) { id } }', [
      'admin',
    ]);
    expect(respuesta.status).toBe(400);
    expect(rutas).toEqual([]);
  });
});
