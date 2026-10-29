import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { VERIFICADOR_TOKEN } from '../src/comun/auth/verificador-token.js';
import { crearClavesPrueba } from './soporte/tokens-prueba.js';
import {
  ServicioSimulado,
  type Respuesta,
} from './soporte/servicio-simulado.js';

const ID_OBRA = 'b0000000-0000-4000-8000-000000000201';
const ID_PLANILLA = 'e0000000-0000-4000-8000-000000000203';

const OBRA_REST = {
  id: ID_OBRA,
  nombre: 'Edificio Las Palmas',
  ubicacion: 'Av. Banzer 4to anillo, Santa Cruz',
  estado: 'EN_EJECUCION',
  motivoRechazoContrato: null,
  fechaInicio: '2026-11-01',
  asignaciones: {
    residenteId: 'a0000000-0000-4000-8000-000000000203',
    maestroId: 'a0000000-0000-4000-8000-000000000204',
    almaceneroId: 'a0000000-0000-4000-8000-000000000205',
    clienteId: 'a0000000-0000-4000-8000-000000000206',
  },
  contrato: {
    contratoId: null,
    monto: 1250000,
    plazoDias: 300,
    anticipoPct: 10,
    retencionPct: 7,
  },
  avancePct: 32.5,
  plazoPct: 41,
  enRiesgo: false,
  partidas: [],
};

/** Contrato REST de Obras: `GET /obras/{obraId}/planillas`. */
const PLANILLAS_REST = [
  {
    id: 'e0000000-0000-4000-8000-000000000201',
    numero: 1,
    periodo: '2027-01',
    estado: 'APROBADA',
    neto: 30000,
    cobroId: 'd0000000-0000-4000-8000-000000000201',
    cobroNumero: 'COB-2027-0001',
  },
  {
    id: ID_PLANILLA,
    numero: 2,
    periodo: '2027-02',
    estado: 'BORRADOR',
    neto: 41881.8,
    cobroId: null,
    cobroNumero: null,
  },
];

/** Contrato REST de Obras: `GET /planillas/{id}`. */
const PLANILLA_REST = {
  id: ID_PLANILLA,
  obraId: ID_OBRA,
  numero: 2,
  periodo: '2027-02',
  estado: 'BORRADOR',
  version: 2,
  lineas: [
    {
      partidaId: 'p1',
      codigo: 'P-01',
      nombre: 'Losa de hormigón armado',
      unidad: 'm2',
      precioUnitario: 420.5,
      cantidadContratada: 850,
      acumuladoAnterior: 300,
      cantidadPeriodo: 120,
      acumuladoTotal: 420,
      saldo: 430,
      monto: 50460,
    },
  ],
  subtotal: 50460,
  descuentoAnticipo: 5046,
  retencion: 3532.2,
  neto: 41881.8,
  anticipoPct: 10,
  retencionPct: 7,
  observacion: null,
  cobroId: null,
  cobroNumero: null,
  fotoIds: ['f0000000-0000-4000-8000-000000000201'],
};

const {
  cobroId: _cobroId,
  cobroNumero: _cobroNumero,
  ...PLANILLA_GRAPHQL
} = PLANILLA_REST;

const CAMPOS_PLANILLA = `
  id obraId numero periodo estado version
  lineas {
    partidaId codigo nombre unidad precioUnitario cantidadContratada
    acumuladoAnterior cantidadPeriodo acumuladoTotal saldo monto
  }
  subtotal descuentoAnticipo retencion neto anticipoPct retencionPct observacion fotoIds
`;

/** Responde según la ruta (sin la consulta); lo que no está en el mapa responde 404. */
const porRuta =
  (mapa: Record<string, Respuesta>) =>
  ({ ruta }: { ruta: string }): Respuesta =>
    mapa[ruta.split('?')[0]] ?? { estado: 404 };

/** 007: planillas de la obra, detalle de la planilla y mutaciones contra un Obras simulado. */
describe('Planillas (e2e)', () => {
  let app: INestApplication;
  const obras = new ServicioSimulado();
  const keycloak = new ServicioSimulado();
  let firmar: Awaited<ReturnType<typeof crearClavesPrueba>>['firmar'];

  beforeAll(async () => {
    process.env.OBRAS_URL = await obras.escuchar();
    process.env.KEYCLOAK_URL = await keycloak.escuchar();

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
    obras.reiniciar();
    keycloak.reiniciar();
    obras.responder = porRuta({
      [`/obras/${ID_OBRA}`]: { cuerpo: OBRA_REST },
      [`/obras/${ID_OBRA}/planillas`]: { cuerpo: PLANILLAS_REST },
      [`/planillas/${ID_PLANILLA}`]: { cuerpo: PLANILLA_REST },
    });
  });

  afterAll(async () => {
    await app.close();
    obras.cerrar();
    keycloak.cerrar();
  });

  const consultar = async (
    query: string,
    variables: Record<string, unknown> = {},
    roles: string[] = ['residente'],
  ) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set(
        'Authorization',
        `Bearer ${await firmar({ sub: 'a0000000-0000-4000-8000-000000000203', realm_access: { roles } })}`,
      )
      .set('X-Request-Id', 'req-007')
      .send({ query, variables });

  describe('Obra.planillas', () => {
    it('devuelve la lista de GET /obras/{obraId}/planillas con el número del cobro', async () => {
      const respuesta = await consultar(
        `query ($id: ID!) {
          obra(id: $id) { nombre planillas { id numero periodo estado neto cobroNumero } }
        }`,
        { id: ID_OBRA },
      );
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.obra.planillas).toEqual(
        PLANILLAS_REST.map(({ cobroId: _id, ...resto }) => resto),
      );
      expect(obras.rutas).toEqual([
        `/obras/${ID_OBRA}`,
        `/obras/${ID_OBRA}/planillas`,
      ]);
      const pedido = obras.pedidos[1];
      expect(pedido.encabezados['x-request-id']).toBe('req-007');
      expect(pedido.encabezados.authorization).toMatch(/^Bearer /);
    });

    it('si Obras falla al dar las planillas, obra vuelve null con el error (la lista no admite null)', async () => {
      obras.responder = porRuta({
        [`/obras/${ID_OBRA}`]: { cuerpo: OBRA_REST },
        [`/obras/${ID_OBRA}/planillas`]: { estado: 503 },
      });
      const respuesta = await consultar(
        `query ($id: ID!) { obra(id: $id) { nombre planillas { id } } }`,
        { id: ID_OBRA },
      );
      expect(respuesta.body.data.obra).toBeNull();
      expect(respuesta.body.errors[0].path).toEqual(['obra', 'planillas']);
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'SERVICIO_NO_DISPONIBLE',
        servicio: 'obras',
      });
    });
  });

  describe('planilla(id)', () => {
    it('devuelve el detalle con líneas, totales, fotos y versión', async () => {
      const respuesta = await consultar(
        `query ($id: ID!) { planilla(id: $id) { ${CAMPOS_PLANILLA} } }`,
        { id: ID_PLANILLA },
        ['gerente'],
      );
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.planilla).toEqual(PLANILLA_GRAPHQL);
      expect(obras.rutas).toEqual([`/planillas/${ID_PLANILLA}`]);
    });

    it('la misma planilla pedida con dos alias se pide una sola vez a Obras', async () => {
      const respuesta = await consultar(
        `query ($id: ID!) { a: planilla(id: $id) { id } b: planilla(id: $id) { numero } }`,
        { id: ID_PLANILLA },
        ['admin'],
      );
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data).toEqual({
        a: { id: ID_PLANILLA },
        b: { numero: 2 },
      });
      expect(obras.rutas).toEqual([`/planillas/${ID_PLANILLA}`]);
    });

    it('un 404 de Obras (planilla de una obra que no ve) llega con su codigo y planilla null', async () => {
      obras.responder = () => ({
        estado: 404,
        cuerpo: { title: 'No encontrada', codigo: 'PLANILLA_NO_ENCONTRADA' },
      });
      const respuesta = await consultar(
        `query ($id: ID!) { planilla(id: $id) { id } }`,
        { id: ID_PLANILLA },
      );
      expect(respuesta.body.data.planilla).toBeNull();
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'PLANILLA_NO_ENCONTRADA',
        servicio: 'obras',
        estado: 404,
      });
    });

    it('un maestro recibe SIN_PERMISO sin llamar a Obras', async () => {
      const respuesta = await consultar(
        `query ($id: ID!) { planilla(id: $id) { id } }`,
        { id: ID_PLANILLA },
        ['maestro'],
      );
      expect(respuesta.body.data.planilla).toBeNull();
      expect(respuesta.body.errors[0].extensions.codigo).toBe('SIN_PERMISO');
      expect(obras.pedidos).toHaveLength(0);
    });

    it('si Obras no responde, planilla vuelve null con SERVICIO_NO_DISPONIBLE después de reintentar', async () => {
      obras.responder = () => ({ estado: 503 });
      const respuesta = await consultar(
        `query ($id: ID!) { planilla(id: $id) { id } }`,
        { id: ID_PLANILLA },
      );
      expect(respuesta.body.data.planilla).toBeNull();
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'SERVICIO_NO_DISPONIBLE',
        servicio: 'obras',
      });
      expect(obras.pedidos).toHaveLength(2);
    });
  });
});
