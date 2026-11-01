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

const ID_OBRA = 'b0000000-0000-4000-8000-000000000502';
const GERENTE = 'a0000000-0000-4000-8000-000000000002';
const DECISOR = 'a0000000-0000-4000-8000-000000000003';

/** Contrato REST de Obras: `GET /obras/{id}` (lo mínimo para el detalle). */
const OBRA_REST = {
  id: ID_OBRA,
  nombre: 'Edificio Las Palmas',
  ubicacion: 'Santa Cruz',
  zona: 'NORTE',
  estado: 'EN_EJECUCION',
  fechaInicio: '2026-11-01',
  motivoRechazoContrato: null,
  asignaciones: {},
  contrato: {
    contratoId: 'c1',
    monto: 100000,
    plazoDias: 300,
    anticipoPct: 10,
    retencionPct: 7,
  },
  avancePct: 20,
  plazoPct: 41,
  enRiesgo: true,
  partidas: [],
};

/** Contrato REST de IA (502). */
const EJECUCION_CORTA = {
  id: 'e1',
  agente: 'CONTROL_MATERIALES',
  origen: 'MANUAL',
  estado: 'TERMINADA',
  iniciadaEn: '2027-04-20T10:00:00Z',
  terminadaEn: '2027-04-20T10:01:12Z',
  cantidadHallazgos: 1,
};
const AGENTES = [
  {
    agente: 'CONTROL_MATERIALES',
    nombre: 'Control de materiales',
    mision: 'Detectar stock bajo o justo…',
    herramientas: ['stock_obra', 'consumos_partida', 'avance_obra'],
    ultimaEjecucion: EJECUCION_CORTA,
    sugerenciasPendientes: 2,
  },
  {
    agente: 'SEGUIMIENTO_OBRAS',
    nombre: 'Seguimiento de obras',
    mision: 'Detectar obras atrasadas…',
    herramientas: ['avance_obra', 'buscar_diario'],
    ultimaEjecucion: null,
    sugerenciasPendientes: 0,
  },
];
const HALLAZGO = {
  obraId: ID_OBRA,
  obraNombre: 'Edificio Las Palmas',
  tipo: 'STOCK_BAJO',
  severidad: 'ALTA',
  situacion: 'Cemento IP-30: 80 bolsas, mínimo 100',
  causaProbable: 'Consumo de la losa mayor al previsto',
  evidencia: [
    { herramienta: 'stock_obra', dato: 'cantidad 80, mínimo 100, estado BAJO' },
  ],
};
const HALLAZGO_VIGENTE = {
  ...HALLAZGO,
  ejecucionId: 'e1',
  agente: 'CONTROL_MATERIALES',
  detectadoEn: '2027-04-20T10:01:12Z',
};
const EJECUCION = {
  ...EJECUCION_CORTA,
  solicitadaPor: GERENTE,
  proveedorLlm: 'ollama',
  modelo: 'qwen3:8b',
  resumen: '1 obra con cemento bajo',
  error: null,
  pasos: [
    {
      numero: 1,
      servidor: 'materiales',
      herramienta: 'stock_obra',
      argumentos: '{"estados":["BAJO","JUSTO"]}',
      resultadoResumen: '4 filas: …',
      en: '2027-04-20T10:00:02Z',
      duracionMs: 180,
      error: null,
    },
    {
      numero: 2,
      servidor: 'ia',
      herramienta: 'consumos_atipicos',
      argumentos: '{}',
      resultadoResumen: '',
      en: '2027-04-20T10:00:03Z',
      duracionMs: 40,
      error: 'SERVICIO_NO_DISPONIBLE',
    },
  ],
  hallazgos: [HALLAZGO],
};
const sugerencia = (estado: string, decididaPor: string | null) => ({
  id: 's1',
  ejecucionId: 'e1',
  agente: 'CONTROL_MATERIALES',
  obraId: ID_OBRA,
  obraNombre: 'Edificio Las Palmas',
  accion: 'VERIFICAR_INVENTARIO',
  accionTexto: 'Hacer un conteo físico del material en el depósito de la obra',
  descripcion: 'Contar el cemento IP-30: el stock está bajo el mínimo.',
  estado,
  creadaEn: '2027-04-20T10:01:12Z',
  decididaPor,
  decididaEn: decididaPor ? '2027-04-21T09:00:00Z' : null,
  comentario: decididaPor ? 'Conteo el lunes' : null,
});
const PENDIENTE = sugerencia('PENDIENTE', null);
const APROBADA = sugerencia('APROBADA', DECISOR);

const CAMPOS_SUGERENCIA = `id ejecucionId agente obraId obraNombre accion accionTexto descripcion estado creadaEn
  decididaPor { id nombre } decididaEn comentario`;
const CAMPOS_HALLAZGO = `ejecucionId agente obraId obraNombre tipo severidad situacion causaProbable
  evidencia { herramienta dato } detectadoEn`;

/** Responde según la ruta (sin la consulta); lo que no está en el mapa responde 404. */
const porRuta =
  (mapa: Record<string, Respuesta>) =>
  ({ ruta }: { ruta: string }): Respuesta =>
    mapa[ruta.split('?')[0]] ?? { estado: 404 };

/** 502: agentes contra Obras, Keycloak e IA simulados. */
describe('Agentes (e2e)', () => {
  let app: INestApplication;
  const obras = new ServicioSimulado();
  const keycloak = new ServicioSimulado();
  const ia = new ServicioSimulado();
  let firmar: Awaited<ReturnType<typeof crearClavesPrueba>>['firmar'];

  beforeAll(async () => {
    process.env.OBRAS_URL = await obras.escuchar();
    process.env.KEYCLOAK_URL = await keycloak.escuchar();
    process.env.IA_URL = await ia.escuchar();

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
    for (const servicio of [obras, keycloak, ia]) servicio.reiniciar();
    obras.responder = porRuta({ [`/obras/${ID_OBRA}`]: { cuerpo: OBRA_REST } });
    keycloak.responder = ({ ruta }) =>
      ruta.endsWith('/protocol/openid-connect/token')
        ? { cuerpo: { access_token: 'token-gateway', expires_in: 300 } }
        : {
            cuerpo: {
              id: ruta.split('/').pop(),
              firstName: 'Ana',
              lastName: 'Rojas',
            },
          };
    ia.responder = porRuta({
      '/agentes': { cuerpo: AGENTES },
      '/ejecuciones': { cuerpo: [EJECUCION_CORTA] },
      '/ejecuciones/e1': { cuerpo: EJECUCION },
      '/hallazgos': { cuerpo: [HALLAZGO_VIGENTE] },
      '/sugerencias': { cuerpo: [PENDIENTE, APROBADA] },
    });
  });

  afterAll(async () => {
    await app.close();
    for (const servicio of [obras, keycloak, ia]) servicio.cerrar();
  });

  const consultar = async (
    query: string,
    variables: Record<string, unknown> = {},
    roles: string[] = ['gerente'],
  ) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set(
        'Authorization',
        `Bearer ${await firmar({ sub: GERENTE, realm_access: { roles } })}`,
      )
      .set('X-Request-Id', 'req-502')
      .send({ query, variables });

  describe('consultas', () => {
    it('agentes pide GET /agentes con el token y el X-Request-Id (también para residente)', async () => {
      const respuesta = await consultar(
        `{ agentes { agente nombre mision herramientas sugerenciasPendientes
          ultimaEjecucion { id agente origen estado iniciadaEn terminadaEn cantidadHallazgos } } }`,
        {},
        ['residente'],
      );
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.agentes).toEqual(AGENTES);
      expect(ia.rutas).toEqual(['/agentes']);
      expect(ia.pedidos[0].encabezados.authorization).toMatch(/^Bearer /);
      expect(ia.pedidos[0].encabezados['x-request-id']).toBe('req-502');
    });

    it('ejecucionesAgente envía solo los filtros que vienen', async () => {
      const respuesta = await consultar(
        `query ($agente: Agente, $limite: Int) {
          ejecucionesAgente(agente: $agente, limite: $limite) { id estado cantidadHallazgos }
        }`,
        { agente: 'CONTROL_MATERIALES', limite: 5 },
      );
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.ejecucionesAgente).toEqual([
        { id: 'e1', estado: 'TERMINADA', cantidadHallazgos: 1 },
      ]);
      expect(ia.rutas).toEqual([
        '/ejecuciones?agente=CONTROL_MATERIALES&limite=5',
      ]);
    });

    it('ejecucionAgente: pasos con servidor, proveedor y modelo, hallazgos completos y quién la pidió (Keycloak)', async () => {
      const respuesta = await consultar(
        `query ($id: ID!) {
          ejecucionAgente(id: $id) {
            id agente origen estado solicitadaPor { id nombre } iniciadaEn terminadaEn proveedorLlm modelo
            resumen error { codigo mensaje }
            pasos { numero servidor herramienta argumentos resultadoResumen en duracionMs error }
            hallazgos { ${CAMPOS_HALLAZGO} }
          }
        }`,
        { id: 'e1' },
      );
      expect(respuesta.body.errors).toBeUndefined();
      const {
        solicitadaPor: _solicitadaPor,
        cantidadHallazgos: _cantidad,
        ...esperado
      } = EJECUCION;
      expect(respuesta.body.data.ejecucionAgente).toEqual({
        ...esperado,
        solicitadaPor: { id: GERENTE, nombre: 'Ana Rojas' },
        hallazgos: [HALLAZGO_VIGENTE],
      });
      expect(ia.rutas).toEqual(['/ejecuciones/e1']);
      expect(keycloak.rutas.filter((ruta) => ruta.includes('/users/'))).toEqual(
        [`/admin/realms/supervision/users/${GERENTE}`],
      );
    });

    it('ejecucionAgente programada: solicitadaPor null sin llamar a Keycloak; error de la ejecución FALLIDA', async () => {
      ia.responder = porRuta({
        '/ejecuciones/e2': {
          cuerpo: {
            ...EJECUCION,
            id: 'e2',
            origen: 'PROGRAMADA',
            estado: 'FALLIDA',
            solicitadaPor: null,
            resumen: null,
            error: {
              codigo: 'SIN_HERRAMIENTAS',
              mensaje: 'Sin herramientas disponibles',
            },
            hallazgos: [],
          },
        },
      });
      const respuesta = await consultar(
        `{ ejecucionAgente(id: "e2") { estado solicitadaPor { id } error { codigo mensaje } hallazgos { obraId } } }`,
      );
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.ejecucionAgente).toEqual({
        estado: 'FALLIDA',
        solicitadaPor: null,
        error: {
          codigo: 'SIN_HERRAMIENTAS',
          mensaje: 'Sin herramientas disponibles',
        },
        hallazgos: [],
      });
      expect(keycloak.pedidos).toHaveLength(0);
    });

    it('ejecucionAgente inexistente: null con EJECUCION_NO_ENCONTRADA (servicio ia)', async () => {
      ia.responder = () => ({
        estado: 404,
        cuerpo: {
          title: 'Ejecución no encontrada',
          codigo: 'EJECUCION_NO_ENCONTRADA',
        },
      });
      const respuesta = await consultar('{ ejecucionAgente(id: "x") { id } }');
      expect(respuesta.body.data).toEqual({ ejecucionAgente: null });
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'EJECUCION_NO_ENCONTRADA',
        servicio: 'ia',
        estado: 404,
      });
    });

    it('hallazgos y sugerencias con filtros; decididaPor desde Keycloak y null si está pendiente', async () => {
      const respuesta = await consultar(
        `query ($agente: Agente, $obraId: ID, $estado: EstadoSugerencia) {
          hallazgos(agente: $agente, obraId: $obraId) { ${CAMPOS_HALLAZGO} }
          sugerencias(estado: $estado, agente: $agente, obraId: $obraId, limite: 10) { ${CAMPOS_SUGERENCIA} }
        }`,
        { agente: 'CONTROL_MATERIALES', obraId: ID_OBRA, estado: 'PENDIENTE' },
        ['residente'],
      );
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.hallazgos).toEqual([HALLAZGO_VIGENTE]);
      expect(respuesta.body.data.sugerencias).toEqual([
        PENDIENTE,
        { ...APROBADA, decididaPor: { id: DECISOR, nombre: 'Ana Rojas' } },
      ]);
      expect(ia.rutas.sort()).toEqual([
        `/hallazgos?agente=CONTROL_MATERIALES&obraId=${ID_OBRA}`,
        `/sugerencias?estado=PENDIENTE&agente=CONTROL_MATERIALES&obraId=${ID_OBRA}&limite=10`,
      ]);
    });

    it('Keycloak caído: solo decididaPor vuelve null; las sugerencias llegan', async () => {
      keycloak.responder = () => ({ estado: 503 });
      // Otro decisor: el de las demás pruebas ya quedó en la caché de usuarios de 5 minutos
      ia.responder = porRuta({
        '/sugerencias': {
          cuerpo: [
            PENDIENTE,
            sugerencia('APROBADA', 'a0000000-0000-4000-8000-000000000099'),
          ],
        },
      });
      const respuesta = await consultar(
        `{ sugerencias { id decididaPor { id } } }`,
      );
      expect(respuesta.body.data.sugerencias).toEqual([
        { id: 's1', decididaPor: null },
        { id: 's1', decididaPor: null },
      ]);
      expect(respuesta.body.errors).toHaveLength(1);
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        servicio: 'keycloak',
      });
    });

    it('IA caída: SERVICIO_NO_DISPONIBLE con servicio ia (la consulta se reintenta una vez)', async () => {
      ia.responder = () => ({ estado: 503 });
      const respuesta = await consultar('{ agentes { agente } }');
      expect(respuesta.body.data).toBeNull();
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'SERVICIO_NO_DISPONIBLE',
        servicio: 'ia',
      });
      expect(ia.pedidos).toHaveLength(2);
    });

    it.each([
      ['residente', '{ ejecucionesAgente { id } }'],
      ['residente', '{ ejecucionAgente(id: "e1") { id } }'],
      ['maestro', '{ agentes { agente } }'],
      ['cliente', '{ hallazgos { obraId } }'],
      ['almacenero', '{ sugerencias { id } }'],
    ])('%s recibe SIN_PERMISO sin llamar a IA: %s', async (rol, consulta) => {
      const respuesta = await consultar(consulta, {}, [rol]);
      expect(respuesta.body.errors[0].extensions.codigo).toBe('SIN_PERMISO');
      expect(ia.pedidos).toHaveLength(0);
    });
  });

  describe('Obra.hallazgos y Obra.sugerencias', () => {
    it('una llamada por obra y filtro (DataLoader de la petición)', async () => {
      const respuesta = await consultar(
        `query ($id: ID!) {
          obra(id: $id) {
            id
            hallazgos { obraId tipo }
            otros: hallazgos { obraId }
            cobros: hallazgos(agente: CONTROL_COBROS) { obraId }
            sugerencias(estado: PENDIENTE) { id accion }
          }
        }`,
        { id: ID_OBRA },
      );
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.obra).toMatchObject({
        id: ID_OBRA,
        hallazgos: [{ obraId: ID_OBRA, tipo: 'STOCK_BAJO' }],
        otros: [{ obraId: ID_OBRA }],
        sugerencias: [
          { id: 's1', accion: 'VERIFICAR_INVENTARIO' },
          { id: 's1', accion: 'VERIFICAR_INVENTARIO' },
        ],
      });
      expect(ia.rutas.sort()).toEqual([
        `/hallazgos?obraId=${ID_OBRA}`,
        `/hallazgos?obraId=${ID_OBRA}&agente=CONTROL_COBROS`,
        `/sugerencias?obraId=${ID_OBRA}&estado=PENDIENTE`,
      ]);
    });

    it('IA caída: solo esos campos vuelven null con SERVICIO_NO_DISPONIBLE; el resto de la obra llega', async () => {
      ia.responder = () => ({ estado: 503 });
      const respuesta = await consultar(
        `query ($id: ID!) { obra(id: $id) { id nombre hallazgos { obraId } sugerencias { id } } }`,
        { id: ID_OBRA },
      );
      expect(respuesta.body.data.obra).toEqual({
        id: ID_OBRA,
        nombre: 'Edificio Las Palmas',
        hallazgos: null,
        sugerencias: null,
      });
      expect(respuesta.body.errors).toHaveLength(2);
      for (const error of respuesta.body.errors) {
        expect(error.extensions).toMatchObject({
          codigo: 'SERVICIO_NO_DISPONIBLE',
          servicio: 'ia',
        });
      }
      expect(
        respuesta.body.errors.map((error: { path: string[] }) => error.path),
      ).toEqual(
        expect.arrayContaining([
          ['obra', 'hallazgos'],
          ['obra', 'sugerencias'],
        ]),
      );
    });
  });

  describe('mutaciones', () => {
    const POST = (ruta: string, respuesta: Respuesta) =>
      (ia.responder = (pedido) =>
        pedido.metodo === 'POST' && pedido.ruta === ruta
          ? respuesta
          : { estado: 404 });

    it('ejecutarAgente envía POST /agentes/{agente}/ejecuciones sin cuerpo y devuelve la ejecución EN_CURSO', async () => {
      const enCurso = {
        ...EJECUCION_CORTA,
        id: 'e9',
        estado: 'EN_CURSO',
        terminadaEn: null,
        cantidadHallazgos: 0,
      };
      POST('/agentes/CONTROL_COBROS/ejecuciones', {
        estado: 202,
        cuerpo: enCurso,
      });
      const respuesta = await consultar(
        `mutation { ejecutarAgente(agente: CONTROL_COBROS) {
          id agente origen estado iniciadaEn terminadaEn cantidadHallazgos } }`,
      );
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.ejecutarAgente).toEqual(enCurso);
      expect(ia.pedidos).toHaveLength(1);
      expect(ia.pedidos[0].cuerpo).toBe('');
    });

    it('ejecutarAgente: 409 EJECUCION_EN_CURSO llega con su codigo; un 5xx no se reintenta', async () => {
      POST('/agentes/SEGUIMIENTO_OBRAS/ejecuciones', {
        estado: 409,
        cuerpo: {
          title: 'El agente ya se está ejecutando',
          codigo: 'EJECUCION_EN_CURSO',
        },
      });
      const MUTACION =
        'mutation { ejecutarAgente(agente: SEGUIMIENTO_OBRAS) { id } }';
      let respuesta = await consultar(MUTACION);
      expect(respuesta.body.data).toBeNull();
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'EJECUCION_EN_CURSO',
        servicio: 'ia',
        estado: 409,
      });

      ia.reiniciar();
      ia.responder = () => ({ estado: 503 });
      respuesta = await consultar(MUTACION);
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'SERVICIO_NO_DISPONIBLE',
        servicio: 'ia',
      });
      expect(ia.pedidos).toHaveLength(1);
    });

    it('aprobarSugerencia envía el comentario solo si viene', async () => {
      POST('/sugerencias/s1/aprobar', { cuerpo: APROBADA });
      const respuesta = await consultar(
        `mutation ($comentario: String) {
          aprobarSugerencia(id: "s1", comentario: $comentario) { ${CAMPOS_SUGERENCIA} }
        }`,
        { comentario: 'Conteo el lunes' },
        ['residente'],
      );
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.aprobarSugerencia).toEqual({
        ...APROBADA,
        decididaPor: { id: DECISOR, nombre: 'Ana Rojas' },
      });
      expect(JSON.parse(ia.pedidos[0].cuerpo)).toEqual({
        comentario: 'Conteo el lunes',
      });

      ia.pedidos = [];
      await consultar('mutation { aprobarSugerencia(id: "s1") { id } }');
      expect(JSON.parse(ia.pedidos[0].cuerpo)).toEqual({});
    });

    it.each([
      [409, 'SUGERENCIA_YA_DECIDIDA', undefined],
      [404, 'SUGERENCIA_NO_ENCONTRADA', undefined],
      [
        422,
        'COMENTARIO_INVALIDO',
        [{ campo: 'comentario', mensaje: 'Hasta 300 caracteres' }],
      ],
    ])(
      'aprobarSugerencia: %i %s llega en extensions.codigo con servicio ia',
      async (estado, codigo, errores) => {
        POST('/sugerencias/s1/aprobar', {
          estado,
          cuerpo: { title: 'Error', status: estado, codigo, errores },
        });
        const respuesta = await consultar(
          'mutation { aprobarSugerencia(id: "s1", comentario: "x") { id } }',
        );
        expect(respuesta.body.data).toBeNull();
        expect(respuesta.body.errors[0].extensions).toMatchObject({
          codigo,
          servicio: 'ia',
          estado,
          ...(errores ? { errores } : {}),
        });
        expect(ia.pedidos).toHaveLength(1);
      },
    );

    it('rechazarSugerencia envía el motivo; 422 MOTIVO_INVALIDO llega con su codigo', async () => {
      const RECHAZADA = {
        ...sugerencia('RECHAZADA', DECISOR),
        comentario: 'El stock ya se repuso ayer',
      };
      POST('/sugerencias/s1/rechazar', { cuerpo: RECHAZADA });
      const MUTACION = `mutation ($motivo: String!) {
        rechazarSugerencia(id: "s1", motivo: $motivo) { id estado comentario }
      }`;
      let respuesta = await consultar(MUTACION, {
        motivo: 'El stock ya se repuso ayer',
      });
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.rechazarSugerencia).toEqual({
        id: 's1',
        estado: 'RECHAZADA',
        comentario: 'El stock ya se repuso ayer',
      });
      expect(JSON.parse(ia.pedidos[0].cuerpo)).toEqual({
        motivo: 'El stock ya se repuso ayer',
      });

      POST('/sugerencias/s1/rechazar', {
        estado: 422,
        cuerpo: { title: 'Motivo inválido', codigo: 'MOTIVO_INVALIDO' },
      });
      respuesta = await consultar(MUTACION, { motivo: 'corto' });
      expect(respuesta.body.data).toBeNull();
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'MOTIVO_INVALIDO',
        servicio: 'ia',
      });
    });

    it.each([
      [
        'residente',
        'mutation { ejecutarAgente(agente: SEGUIMIENTO_OBRAS) { id } }',
      ],
      ['maestro', 'mutation { aprobarSugerencia(id: "s1") { id } }'],
      [
        'cliente',
        'mutation { rechazarSugerencia(id: "s1", motivo: "No corresponde") { id } }',
      ],
    ])('%s recibe SIN_PERMISO sin llamar a IA', async (rol, mutacion) => {
      const respuesta = await consultar(mutacion, {}, [rol]);
      expect(respuesta.body.errors[0].extensions.codigo).toBe('SIN_PERMISO');
      expect(ia.pedidos).toHaveLength(0);
    });
  });
});
