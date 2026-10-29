import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { Roles } from '../src/comun/auth/roles.decorator.js';
import { VERIFICADOR_TOKEN } from '../src/comun/auth/verificador-token.js';
import { crearClavesPrueba } from './soporte/tokens-prueba.js';

/** Consulta solo de prueba protegida por rol. */
@Resolver()
class ResolverSoloAdmin {
  @Roles('admin', 'gerente')
  @Query(() => String)
  soloAdmin(): string {
    return 'ok';
  }
}

/** 001, criterio 9: sin token NO_AUTENTICADO; sin el rol SIN_PERMISO; con el rol responde. */
describe('Roles en el gateway (e2e)', () => {
  let app: INestApplication;
  let obrasSimulado: Server;
  let llamadasAObras = 0;
  let firmar: Awaited<ReturnType<typeof crearClavesPrueba>>['firmar'];

  beforeAll(async () => {
    obrasSimulado = createServer((_req, res) => {
      llamadasAObras++;
      res.setHeader('content-type', 'application/json');
      res.end('[]');
    });
    await new Promise<void>((listo) => obrasSimulado.listen(0, '127.0.0.1', listo));
    process.env.OBRAS_URL = `http://127.0.0.1:${(obrasSimulado.address() as AddressInfo).port}`;

    const claves = await crearClavesPrueba();
    firmar = claves.firmar;
    const modulo = await Test.createTestingModule({ imports: [AppModule], providers: [ResolverSoloAdmin] })
      .overrideProvider(VERIFICADOR_TOKEN)
      .useValue(claves.verificador)
      .compile();
    app = modulo.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    obrasSimulado.closeAllConnections();
    obrasSimulado.close();
  });

  const consultar = async (query: string, datos?: Record<string, unknown>) => {
    const peticion = request(app.getHttpServer()).post('/graphql');
    if (datos) void peticion.set('Authorization', `Bearer ${await firmar(datos)}`);
    return peticion.send({ query });
  };
  const codigo = (respuesta: request.Response) => respuesta.body.errors?.[0]?.extensions?.codigo;

  it('sin token responde NO_AUTENTICADO', async () => {
    expect(codigo(await consultar('{ soloAdmin }'))).toBe('NO_AUTENTICADO');
  });

  it('con otro rol responde SIN_PERMISO', async () => {
    const respuesta = await consultar('{ soloAdmin }', { sub: 'u1', realm_access: { roles: ['residente'] } });
    expect(respuesta.body.data).toBeNull();
    expect(respuesta.body.errors[0].extensions).toMatchObject({ codigo: 'SIN_PERMISO', estado: 403 });
  });

  it('con el rol responde', async () => {
    const respuesta = await consultar('{ soloAdmin }', { sub: 'u1', realm_access: { roles: ['gerente'] } });
    expect(respuesta.body).toEqual({ data: { soloAdmin: 'ok' } });
  });

  it('obras: el residente entra y el maestro desde la app recibe SIN_PERMISO sin llamar a Obras', async () => {
    const residente = await consultar('{ obras { id } }', { sub: 'u1', realm_access: { roles: ['residente'] } });
    expect(residente.body).toEqual({ data: { obras: [] } });

    const antes = llamadasAObras;
    const maestro = await consultar('{ obras { id } }', {
      sub: 'u2',
      azp: 'app-obra',
      realm_access: { roles: ['maestro'] },
    });
    expect(codigo(maestro)).toBe('SIN_PERMISO');
    expect(llamadasAObras).toBe(antes);
  });

  it('demo1 desde el portal no cuenta como residente en el ERP', async () => {
    const demo1 = { sub: 'a0000000-0000-4000-8000-000000000009', realm_access: { roles: ['residente', 'cliente'] } };
    expect((await consultar('{ obras { id } }', { ...demo1, azp: 'erp' })).body).toEqual({ data: { obras: [] } });
    expect(codigo(await consultar('{ obras { id } }', { ...demo1, azp: 'portal' }))).toBe('SIN_PERMISO');
  });
});
