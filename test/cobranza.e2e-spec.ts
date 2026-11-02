import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { VERIFICADOR_TOKEN } from '../src/comun/auth/verificador-token.js';
import { crearClavesPrueba } from './soporte/tokens-prueba.js';
import { ServicioSimulado } from './soporte/servicio-simulado.js';

const ID_COBRO = 'd0000000-0000-4000-8000-000000000201';

/** Respuesta de Finanzas a `POST /cobros/{id}/pago` (mismo objeto que `GET /cobros/{id}`, contrato de la 201). */
const PAGADO_REST = {
  id: ID_COBRO,
  numero: 'COB-2027-0003',
  obraId: 'b0000000-0000-4000-8000-000000000201',
  planillaId: 'e0000000-0000-4000-8000-000000000201',
  montoNeto: 41881.8,
  emitidoEn: '2027-04-02',
  venceEn: '2027-05-02',
  estado: 'PAGADO',
  pagadoEn: '2027-04-28',
  comprobante: 'TRF-883412',
  envios: [
    {
      tipo: 'NOTA_COBRO',
      destinatario: 'cliente1@correo.test',
      enviadoEn: '2027-04-02T12:05:00Z',
    },
  ],
};

const MUTACION = `mutation ($cobroId: ID!, $pagadoEn: String!, $comprobante: String) {
  registrarPagoCobro(cobroId: $cobroId, pagadoEn: $pagadoEn, comprobante: $comprobante) {
    id numero estado pagadoEn comprobante envios { tipo destinatario enviadoEn }
  }
}`;
const VARIABLES = {
  cobroId: ID_COBRO,
  pagadoEn: '2027-04-28',
  comprobante: 'TRF-883412',
};

/** 201: registrarPagoCobro contra un Finanzas simulado según el contrato de `POST /cobros/{id}/pago`. */
describe('Cobranza automática: registrarPagoCobro (e2e)', () => {
  let app: INestApplication;
  const finanzas = new ServicioSimulado();
  let firmar: Awaited<ReturnType<typeof crearClavesPrueba>>['firmar'];

  beforeAll(async () => {
    process.env.FINANZAS_URL = await finanzas.escuchar();
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
    finanzas.reiniciar();
    finanzas.responder = ({ metodo, ruta }) =>
      metodo === 'POST' && ruta === `/cobros/${ID_COBRO}/pago`
        ? { cuerpo: PAGADO_REST }
        : { estado: 404 };
  });

  afterAll(async () => {
    await app.close();
    finanzas.cerrar();
  });

  const consultar = async (
    variables: Record<string, unknown>,
    roles: string[] = ['admin'],
  ) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set(
        'Authorization',
        `Bearer ${await firmar({ sub: 'a0000000-0000-4000-8000-000000000001', realm_access: { roles } })}`,
      )
      .set('X-Request-Id', 'req-201')
      .send({ query: MUTACION, variables });

  it('admin registra el pago: POST /cobros/{id}/pago con fecha y comprobante y el token del usuario; devuelve el cobro PAGADO', async () => {
    const respuesta = await consultar(VARIABLES);
    expect(respuesta.body.errors).toBeUndefined();
    expect(respuesta.body.data.registrarPagoCobro).toEqual({
      id: ID_COBRO,
      numero: 'COB-2027-0003',
      estado: 'PAGADO',
      pagadoEn: '2027-04-28',
      comprobante: 'TRF-883412',
      envios: PAGADO_REST.envios,
    });
    expect(finanzas.pedidos).toHaveLength(1);
    const [pedido] = finanzas.pedidos;
    expect(pedido).toMatchObject({
      metodo: 'POST',
      ruta: `/cobros/${ID_COBRO}/pago`,
    });
    expect(JSON.parse(pedido.cuerpo)).toEqual({
      pagadoEn: '2027-04-28',
      comprobante: 'TRF-883412',
    });
    expect(pedido.encabezados.authorization).toMatch(/^Bearer /);
    expect(pedido.encabezados['x-request-id']).toBe('req-201');
  });

  it('sin comprobante solo manda la fecha', async () => {
    finanzas.responder = () => ({
      cuerpo: { ...PAGADO_REST, comprobante: null },
    });
    const respuesta = await consultar({
      cobroId: ID_COBRO,
      pagadoEn: '2027-04-28',
    });
    expect(respuesta.body.data.registrarPagoCobro.comprobante).toBeNull();
    expect(JSON.parse(finanzas.pedidos[0].cuerpo)).toEqual({
      pagadoEn: '2027-04-28',
    });
  });

  it.each([
    [404, 'COBRO_NO_ENCONTRADO'],
    [409, 'COBRO_YA_PAGADO'],
    [422, 'FECHA_PAGO_INVALIDA'],
    [400, 'DATOS_INVALIDOS'],
  ])(
    '%i %s de Finanzas llega en extensions.codigo con data null',
    async (estado, codigo) => {
      finanzas.responder = () => ({
        estado,
        cuerpo: { title: 'Error', status: estado, codigo },
      });
      const respuesta = await consultar(VARIABLES);
      expect(respuesta.body.data).toBeNull();
      expect(respuesta.body.errors).toHaveLength(1);
      expect(respuesta.body.errors[0].path).toEqual(['registrarPagoCobro']);
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo,
        servicio: 'finanzas',
        estado,
      });
      expect(finanzas.pedidos).toHaveLength(1);
    },
  );

  it('un 500 de Finanzas no se reintenta (es una mutación)', async () => {
    finanzas.responder = () => ({
      estado: 500,
      cuerpo: { title: 'Error', codigo: 'ERROR_INTERNO' },
    });
    const respuesta = await consultar(VARIABLES);
    expect(respuesta.body.errors[0].extensions.codigo).toBe('ERROR_INTERNO');
    expect(finanzas.pedidos).toHaveLength(1);
  });

  it('Finanzas tarda más de 3 s: SERVICIO_NO_DISPONIBLE sin reintento', async () => {
    finanzas.responder = () => ({ cuerpo: PAGADO_REST, esperaMs: 3500 });
    const respuesta = await consultar(VARIABLES);
    expect(respuesta.body.data).toBeNull();
    expect(respuesta.body.errors[0].extensions).toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE',
      servicio: 'finanzas',
    });
    expect(finanzas.pedidos).toHaveLength(1);
  }, 15000);

  it.each([['gerente'], ['residente'], ['cliente']])(
    '%s recibe SIN_PERMISO sin llamar a Finanzas',
    async (rol) => {
      const respuesta = await consultar(VARIABLES, [rol]);
      expect(respuesta.body.data).toBeNull();
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'SIN_PERMISO',
        estado: 403,
      });
      expect(finanzas.pedidos).toHaveLength(0);
    },
  );

  it('sin token: NO_AUTENTICADO sin llamar a Finanzas', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: MUTACION, variables: VARIABLES });
    expect(respuesta.body.errors[0].extensions.codigo).toBe('NO_AUTENTICADO');
    expect(finanzas.pedidos).toHaveLength(0);
  });
});
