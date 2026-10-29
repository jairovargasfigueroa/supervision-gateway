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
  const finanzas = new ServicioSimulado();
  const keycloak = new ServicioSimulado();
  let firmar: Awaited<ReturnType<typeof crearClavesPrueba>>['firmar'];

  beforeAll(async () => {
    process.env.OBRAS_URL = await obras.escuchar();
    process.env.FINANZAS_URL = await finanzas.escuchar();
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
    finanzas.reiniciar();
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
    finanzas.cerrar();
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

  describe('Planilla.cobro y observacion (008)', () => {
    const ID_COBRO = 'd0000000-0000-4000-8000-000000000202';
    /** Planilla aprobada: Obras guardó el cobro al recibir CobroEmitido. */
    const APROBADA_REST = {
      ...PLANILLA_REST,
      estado: 'APROBADA',
      cobroId: ID_COBRO,
      cobroNumero: 'COB-2027-0002',
    };
    /** Contrato REST de Finanzas: `GET /cobros/{id}`. */
    const COBRO_REST = {
      id: ID_COBRO,
      numero: 'COB-2027-0002',
      obraId: ID_OBRA,
      planillaId: ID_PLANILLA,
      montoNeto: 41881.8,
      emitidoEn: '2027-03-02',
      venceEn: '2027-04-01',
      estado: 'PENDIENTE',
    };
    const CONSULTA_COBRO = `query ($id: ID!) {
      planilla(id: $id) { estado observacion cobro { id numero montoNeto emitidoEn venceEn estado } }
    }`;

    beforeEach(() => {
      obras.responder = porRuta({
        [`/planillas/${ID_PLANILLA}`]: { cuerpo: APROBADA_REST },
      });
      finanzas.responder = porRuta({
        [`/cobros/${ID_COBRO}`]: { cuerpo: COBRO_REST },
      });
    });

    it.each([['admin'], ['gerente']])(
      '%s ve el número de Obras y el detalle de GET /cobros/{id} (un solo pedido a Finanzas)',
      async (rol) => {
        const respuesta = await consultar(CONSULTA_COBRO, { id: ID_PLANILLA }, [
          rol,
        ]);
        expect(respuesta.body.errors).toBeUndefined();
        expect(respuesta.body.data.planilla).toEqual({
          estado: 'APROBADA',
          observacion: null,
          cobro: {
            id: ID_COBRO,
            numero: 'COB-2027-0002',
            montoNeto: 41881.8,
            emitidoEn: '2027-03-02',
            venceEn: '2027-04-01',
            estado: 'PENDIENTE',
          },
        });
        expect(finanzas.rutas).toEqual([`/cobros/${ID_COBRO}`]);
        const pedido = finanzas.pedidos[0];
        expect(pedido.encabezados['x-request-id']).toBe('req-007');
        expect(pedido.encabezados.authorization).toMatch(/^Bearer /);
      },
    );

    it('el residente ve id y numero; el detalle de Finanzas vuelve null sin error y sin llamar a Finanzas', async () => {
      const respuesta = await consultar(CONSULTA_COBRO, { id: ID_PLANILLA }, [
        'residente',
      ]);
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.planilla.cobro).toEqual({
        id: ID_COBRO,
        numero: 'COB-2027-0002',
        montoNeto: null,
        emitidoEn: null,
        venceEn: null,
        estado: null,
      });
      expect(finanzas.pedidos).toHaveLength(0);
    });

    it('si Finanzas no responde, solo el detalle vuelve null con SERVICIO_NO_DISPONIBLE (id y numero llegan)', async () => {
      finanzas.responder = () => ({ estado: 503 });
      const respuesta = await consultar(CONSULTA_COBRO, { id: ID_PLANILLA }, [
        'gerente',
      ]);
      expect(respuesta.body.data.planilla).toEqual({
        estado: 'APROBADA',
        observacion: null,
        cobro: {
          id: ID_COBRO,
          numero: 'COB-2027-0002',
          montoNeto: null,
          emitidoEn: null,
          venceEn: null,
          estado: null,
        },
      });
      const errores = (
        respuesta.body.errors as {
          path: string[];
          extensions: Record<string, unknown>;
        }[]
      )
        .map((e) => [
          e.path.join('.'),
          e.extensions.codigo,
          e.extensions.servicio,
        ])
        .sort((a, b) => a.join().localeCompare(b.join()));
      expect(errores).toEqual([
        ['planilla.cobro.emitidoEn', 'SERVICIO_NO_DISPONIBLE', 'finanzas'],
        ['planilla.cobro.estado', 'SERVICIO_NO_DISPONIBLE', 'finanzas'],
        ['planilla.cobro.montoNeto', 'SERVICIO_NO_DISPONIBLE', 'finanzas'],
        ['planilla.cobro.venceEn', 'SERVICIO_NO_DISPONIBLE', 'finanzas'],
      ]);
      // Una consulta se reintenta una vez; el DataLoader evita un pedido por campo.
      expect(finanzas.pedidos).toHaveLength(2);
    });

    it('sin cobro (todavía no aprobada) cobro es null y no se llama a Finanzas', async () => {
      obras.responder = porRuta({
        [`/planillas/${ID_PLANILLA}`]: {
          cuerpo: { ...PLANILLA_REST, estado: 'APROBANDO' },
        },
      });
      const respuesta = await consultar(CONSULTA_COBRO, { id: ID_PLANILLA }, [
        'admin',
      ]);
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.planilla).toEqual({
        estado: 'APROBANDO',
        observacion: null,
        cobro: null,
      });
      expect(finanzas.pedidos).toHaveLength(0);
    });

    it('la planilla observada trae la observación (del cliente o de la saga) tal cual la da Obras', async () => {
      obras.responder = porRuta({
        [`/planillas/${ID_PLANILLA}`]: {
          cuerpo: {
            ...PLANILLA_REST,
            estado: 'OBSERVADA',
            observacion: 'Saldo del contrato insuficiente',
          },
        },
      });
      const respuesta = await consultar(CONSULTA_COBRO, { id: ID_PLANILLA });
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.planilla).toEqual({
        estado: 'OBSERVADA',
        observacion: 'Saldo del contrato insuficiente',
        cobro: null,
      });
    });
  });

  describe('crearPlanilla', () => {
    const CREAR = `mutation ($obraId: ID!, $periodo: String!) {
      crearPlanilla(obraId: $obraId, periodo: $periodo) { id numero periodo estado version lineas { partidaId cantidadPeriodo } }
    }`;

    it('el residente crea: POST /obras/{obraId}/planillas con { periodo } y devuelve el detalle', async () => {
      const nueva = {
        ...PLANILLA_REST,
        numero: 3,
        periodo: '2027-03',
        version: 0,
        lineas: PLANILLA_REST.lineas.map((linea) => ({
          ...linea,
          cantidadPeriodo: 0,
        })),
      };
      obras.responder = () => ({ estado: 201, cuerpo: nueva });
      const respuesta = await consultar(CREAR, {
        obraId: ID_OBRA,
        periodo: '2027-03',
      });
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.crearPlanilla).toMatchObject({
        numero: 3,
        periodo: '2027-03',
        estado: 'BORRADOR',
        version: 0,
        lineas: [{ partidaId: 'p1', cantidadPeriodo: 0 }],
      });
      expect(obras.pedidos).toHaveLength(1);
      expect(obras.pedidos[0]).toMatchObject({
        metodo: 'POST',
        ruta: `/obras/${ID_OBRA}/planillas`,
      });
      expect(JSON.parse(obras.pedidos[0].cuerpo)).toEqual({
        periodo: '2027-03',
      });
    });

    it.each([
      [409, 'PLANILLA_ABIERTA_EXISTE'],
      [422, 'PERIODO_NO_POSTERIOR'],
      [422, 'PERIODO_FUTURO'],
      [422, 'OBRA_NO_EN_EJECUCION'],
    ])(
      '%i %s de Obras llega en extensions.codigo, con data null',
      async (estado, codigo) => {
        obras.responder = () => ({
          estado,
          cuerpo: { title: 'No se puede crear', codigo },
        });
        const respuesta = await consultar(CREAR, {
          obraId: ID_OBRA,
          periodo: '2027-03',
        });
        expect(respuesta.body.data).toBeNull();
        expect(respuesta.body.errors[0].extensions).toMatchObject({
          codigo,
          servicio: 'obras',
          estado,
        });
      },
    );

    it('un 500 de Obras no se reintenta (es una mutación)', async () => {
      obras.responder = () => ({ estado: 500 });
      const respuesta = await consultar(CREAR, {
        obraId: ID_OBRA,
        periodo: '2027-03',
      });
      expect(respuesta.body.data).toBeNull();
      expect(respuesta.body.errors[0].extensions.codigo).toBe('ERROR_INTERNO');
      expect(obras.pedidos).toHaveLength(1);
    });

    it('un gerente recibe SIN_PERMISO sin llamar a Obras', async () => {
      const respuesta = await consultar(
        CREAR,
        { obraId: ID_OBRA, periodo: '2027-03' },
        ['gerente'],
      );
      expect(respuesta.body.data).toBeNull();
      expect(respuesta.body.errors[0].extensions.codigo).toBe('SIN_PERMISO');
      expect(obras.pedidos).toHaveLength(0);
    });
  });

  describe('guardarPlanilla', () => {
    const GUARDAR = `mutation ($id: ID!, $entrada: GuardarPlanillaEntrada!) {
      guardarPlanilla(id: $id, entrada: $entrada) { ${CAMPOS_PLANILLA} }
    }`;
    const ENTRADA = {
      version: 2,
      lineas: [{ partidaId: 'p1', cantidadPeriodo: 120 }],
      fotoIds: ['f0000000-0000-4000-8000-000000000201'],
    };

    it('reenvía versión, líneas y fotos a PUT /planillas/{id} y devuelve el detalle recalculado', async () => {
      obras.responder = () => ({ cuerpo: { ...PLANILLA_REST, version: 3 } });
      const respuesta = await consultar(GUARDAR, {
        id: ID_PLANILLA,
        entrada: ENTRADA,
      });
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.guardarPlanilla).toEqual({
        ...PLANILLA_GRAPHQL,
        version: 3,
      });
      expect(obras.pedidos[0]).toMatchObject({
        metodo: 'PUT',
        ruta: `/planillas/${ID_PLANILLA}`,
      });
      expect(JSON.parse(obras.pedidos[0].cuerpo)).toEqual(ENTRADA);
    });

    it('409 VERSION_DESACTUALIZADA llega en extensions.codigo, sin reintento', async () => {
      obras.responder = () => ({
        estado: 409,
        cuerpo: {
          title: 'La planilla cambió',
          codigo: 'VERSION_DESACTUALIZADA',
        },
      });
      const respuesta = await consultar(GUARDAR, {
        id: ID_PLANILLA,
        entrada: ENTRADA,
      });
      expect(respuesta.body.data).toBeNull();
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'VERSION_DESACTUALIZADA',
        servicio: 'obras',
        estado: 409,
      });
      expect(obras.pedidos).toHaveLength(1);
    });

    it('422 SUPERA_CANTIDAD_CONTRATADA llega con errores[] por partida', async () => {
      const errores = [
        { campo: 'p1', mensaje: 'Supera lo contratado (saldo: 430)' },
      ];
      obras.responder = () => ({
        estado: 422,
        cuerpo: {
          title: 'Supera lo contratado',
          codigo: 'SUPERA_CANTIDAD_CONTRATADA',
          errores,
        },
      });
      const respuesta = await consultar(GUARDAR, {
        id: ID_PLANILLA,
        entrada: {
          ...ENTRADA,
          lineas: [{ partidaId: 'p1', cantidadPeriodo: 600 }],
        },
      });
      expect(respuesta.body.data).toBeNull();
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'SUPERA_CANTIDAD_CONTRATADA',
        estado: 422,
        errores,
      });
    });

    it.each([
      [409, 'PLANILLA_NO_EDITABLE'],
      [422, 'FOTO_FUERA_DEL_PERIODO'],
    ])('%i %s llega en extensions.codigo', async (estado, codigo) => {
      obras.responder = () => ({ estado, cuerpo: { title: 'Error', codigo } });
      const respuesta = await consultar(GUARDAR, {
        id: ID_PLANILLA,
        entrada: ENTRADA,
      });
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo,
        estado,
      });
    });

    it('una entrada sin version la rechaza GraphQL sin llamar a Obras', async () => {
      const { version: _version, ...sinVersion } = ENTRADA;
      const respuesta = await consultar(GUARDAR, {
        id: ID_PLANILLA,
        entrada: sinVersion,
      });
      expect(respuesta.body.errors).toBeDefined();
      expect(obras.pedidos).toHaveLength(0);
    });
  });

  describe('presentarPlanilla', () => {
    const PRESENTAR = `mutation ($id: ID!, $version: Int!) {
      presentarPlanilla(id: $id, version: $version) { id estado version }
    }`;

    it('envía { version } a POST /planillas/{id}/presentar y devuelve la planilla PRESENTADA', async () => {
      obras.responder = () => ({
        cuerpo: { ...PLANILLA_REST, estado: 'PRESENTADA', version: 4 },
      });
      const respuesta = await consultar(PRESENTAR, {
        id: ID_PLANILLA,
        version: 3,
      });
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.presentarPlanilla).toEqual({
        id: ID_PLANILLA,
        estado: 'PRESENTADA',
        version: 4,
      });
      expect(obras.pedidos[0]).toMatchObject({
        metodo: 'POST',
        ruta: `/planillas/${ID_PLANILLA}/presentar`,
      });
      expect(JSON.parse(obras.pedidos[0].cuerpo)).toEqual({ version: 3 });
    });

    it.each([
      [409, 'VERSION_DESACTUALIZADA'],
      [409, 'PLANILLA_NO_EDITABLE'],
      [422, 'SUBTOTAL_CERO'],
    ])(
      '%i %s llega en extensions.codigo, sin reintento',
      async (estado, codigo) => {
        obras.responder = () => ({
          estado,
          cuerpo: { title: 'Error', codigo },
        });
        const respuesta = await consultar(PRESENTAR, {
          id: ID_PLANILLA,
          version: 3,
        });
        expect(respuesta.body.data).toBeNull();
        expect(respuesta.body.errors[0].extensions).toMatchObject({
          codigo,
          servicio: 'obras',
          estado,
        });
        expect(obras.pedidos).toHaveLength(1);
      },
    );

    it('si Obras no responde, llega SERVICIO_NO_DISPONIBLE sin reintentar', async () => {
      obras.responder = () => ({ estado: 503 });
      const respuesta = await consultar(PRESENTAR, {
        id: ID_PLANILLA,
        version: 3,
      });
      expect(respuesta.body.data).toBeNull();
      expect(respuesta.body.errors[0].extensions.codigo).toBe(
        'SERVICIO_NO_DISPONIBLE',
      );
      expect(obras.pedidos).toHaveLength(1);
    });

    it('admin recibe SIN_PERMISO (solo lectura) sin llamar a Obras', async () => {
      const respuesta = await consultar(
        PRESENTAR,
        { id: ID_PLANILLA, version: 3 },
        ['admin'],
      );
      expect(respuesta.body.errors[0].extensions.codigo).toBe('SIN_PERMISO');
      expect(obras.pedidos).toHaveLength(0);
    });
  });
});
