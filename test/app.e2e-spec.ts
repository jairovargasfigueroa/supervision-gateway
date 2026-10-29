import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Context, Query, Resolver } from '@nestjs/graphql';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import type { ContextoGraphql } from '../src/comun/auth/contexto.js';
import { VERIFICADOR_TOKEN } from '../src/comun/auth/verificador-token.js';
import { ClienteServicio } from '../src/comun/http/cliente-servicio.js';
import { crearClavesPrueba } from './soporte/tokens-prueba.js';

/** Consultas solo de prueba: todavía no hay consultas del negocio (la primera llega en la 1.10). */
@Resolver()
class ResolverPrueba {
  constructor(private readonly cliente: ClienteServicio) {}

  @Query(() => String)
  quienSoy(@Context() contexto: ContextoGraphql): string {
    return contexto.req.usuario!.nombre;
  }

  @Query(() => String)
  async eco(@Context() contexto: ContextoGraphql): Promise<string> {
    return JSON.stringify(await this.cliente.consultar('obras', '/eco', contexto));
  }
}

describe('Gateway (e2e)', () => {
  let app: INestApplication<App>;
  let firmar: Awaited<ReturnType<typeof crearClavesPrueba>>['firmar'];
  let obrasSimulado: Server;
  let recibidoEnObras: IncomingHttpHeaders;

  beforeAll(async () => {
    // Obras simulado: devuelve los encabezados que le llegaron
    obrasSimulado = createServer((req, res) => {
      recibidoEnObras = req.headers;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((listo) => obrasSimulado.listen(0, '127.0.0.1', listo));
    process.env.OBRAS_URL = `http://127.0.0.1:${(obrasSimulado.address() as AddressInfo).port}`;

    const claves = await crearClavesPrueba();
    firmar = claves.firmar;
    const modulo = await Test.createTestingModule({ imports: [AppModule], providers: [ResolverPrueba] })
      .overrideProvider(VERIFICADOR_TOKEN)
      .useValue(claves.verificador)
      .compile();
    app = modulo.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    obrasSimulado.close();
  });

  const graphql = (query: string, token?: string) => {
    const peticion = request(app.getHttpServer()).post('/graphql');
    if (token) void peticion.set('Authorization', `Bearer ${token}`);
    return peticion.send({ query });
  };

  it('responde la consulta salud sin token', () => {
    return graphql('{ salud }').expect(200).expect({ data: { salud: 'ok' } });
  });

  it('rechaza una consulta sin token con NO_AUTENTICADO', async () => {
    const respuesta = await graphql('{ quienSoy }');
    expect(respuesta.body.data).toBeNull();
    expect(respuesta.body.errors[0].extensions.codigo).toBe('NO_AUTENTICADO');
  });

  it('rechaza un token inválido', async () => {
    const respuesta = await graphql('{ quienSoy }', 'no-es-un-token');
    expect(respuesta.body.errors[0].extensions.codigo).toBe('NO_AUTENTICADO');
  });

  it('acepta un token válido y deja el usuario en el contexto', async () => {
    const token = await firmar({ sub: 'u1', name: 'Daniela Roca Justiniano', realm_access: { roles: ['residente'] } });
    const respuesta = await graphql('{ quienSoy }', token);
    expect(respuesta.body).toEqual({ data: { quienSoy: 'Daniela Roca Justiniano' } });
  });

  it('reenvía el token y el X-Request-Id recibido al servicio', async () => {
    const token = await firmar({ sub: 'u1', name: 'Daniela' });
    const respuesta = await graphql('{ eco }', token).set('X-Request-Id', 'desde-el-erp-1');
    expect(respuesta.body.data.eco).toBe('{"ok":true}');
    expect(respuesta.headers['x-request-id']).toBe('desde-el-erp-1');
    expect(recibidoEnObras.authorization).toBe(`Bearer ${token}`);
    expect(recibidoEnObras['x-request-id']).toBe('desde-el-erp-1');
  });

  it('crea un X-Request-Id si no viene y es el mismo que recibe el servicio', async () => {
    const respuesta = await graphql('{ eco }', await firmar({ sub: 'u1', name: 'Daniela' }));
    expect(respuesta.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(recibidoEnObras['x-request-id']).toBe(respuesta.headers['x-request-id']);
  });
});
