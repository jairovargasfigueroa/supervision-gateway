import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { VERIFICADOR_TOKEN } from '../src/comun/auth/verificador-token.js';
import { crearClavesPrueba } from './soporte/tokens-prueba.js';

const OBRA = {
  id: 'b0000000-0000-4000-8000-000000000001',
  nombre: 'Edificio Las Palmas',
  ubicacion: 'Av. Banzer 4to anillo, Santa Cruz',
  zona: 'NORTE',
  estado: 'EN_EJECUCION',
  fechaInicio: '2026-11-01',
  avancePct: 32.5,
  plazoPct: 41,
  enRiesgo: false,
  ultimaPlanilla: { periodo: '2027-02', estado: 'APROBADA' },
};

describe('Consulta obras (e2e)', () => {
  let app: INestApplication;
  let obrasSimulado: Server;
  let rutaPedida: string;
  let respuestaObras: unknown;
  let token: string;
  let verificador: Awaited<ReturnType<typeof crearClavesPrueba>>['verificador'];

  beforeAll(async () => {
    obrasSimulado = createServer((req, res) => {
      rutaPedida = req.url!;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(respuestaObras));
    });
    await new Promise<void>((listo) =>
      obrasSimulado.listen(0, '127.0.0.1', listo),
    );
    process.env.OBRAS_URL = `http://127.0.0.1:${(obrasSimulado.address() as AddressInfo).port}`;

    const claves = await crearClavesPrueba();
    verificador = claves.verificador;
    token = await claves.firmar({
      sub: 'a0000000-0000-4000-8000-000000000003',
      realm_access: { roles: ['residente'] },
    });
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
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

  const consultar = (query: string) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query });

  it('devuelve la lista vacía que entrega Obras (esqueleto que camina)', async () => {
    respuestaObras = [];
    const respuesta = await consultar('{ obras { id nombre estado } }');
    expect(respuesta.body).toEqual({ data: { obras: [] } });
    expect(rutaPedida).toBe('/obras');
  });

  it('pasa los filtros a Obras y devuelve los campos del contrato', async () => {
    respuestaObras = [OBRA];
    const respuesta = await consultar(
      '{ obras(estado: EN_EJECUCION, busqueda: "Palmas") { id nombre ubicacion zona estado fechaInicio avancePct plazoPct enRiesgo ultimaPlanilla { periodo estado } } }',
    );
    expect(rutaPedida).toBe('/obras?estado=EN_EJECUCION&busqueda=Palmas');
    expect(respuesta.body).toEqual({ data: { obras: [OBRA] } });
  });

  it('401: zona null (u omitida por Obras) llega como null', async () => {
    const { zona: _zona, ...sinZona } = OBRA;
    respuestaObras = [
      { ...OBRA, zona: null },
      { ...sinZona, id: 'otra' },
    ];
    const respuesta = await consultar('{ obras { id zona } }');
    expect(respuesta.body).toEqual({
      data: {
        obras: [
          { id: OBRA.id, zona: null },
          { id: 'otra', zona: null },
        ],
      },
    });
  });

  it('si Obras no responde, devuelve SERVICIO_NO_DISPONIBLE con servicio obras', async () => {
    // Otra instancia del gateway apuntando a un Obras apagado (puerto 1)
    const urlOriginal = process.env.OBRAS_URL;
    process.env.OBRAS_URL = 'http://127.0.0.1:1';
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(VERIFICADOR_TOKEN)
      .useValue(verificador)
      .compile();
    process.env.OBRAS_URL = urlOriginal;
    const appCaida = modulo.createNestApplication();
    await appCaida.init();

    const respuesta = await request(appCaida.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: '{ obras { id } }' });
    await appCaida.close();

    expect(respuesta.body.data).toBeNull();
    expect(respuesta.body.errors[0].extensions).toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE',
      servicio: 'obras',
    });
  });
});
