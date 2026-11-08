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

const ID_OBRA = 'b0000000-0000-4000-8000-000000000501';
const REVISOR = 'a0000000-0000-4000-8000-000000000503';

/** Contrato REST de Obras: `GET /obras/{id}` (lo mínimo para el detalle). */
const OBRA_REST = {
  id: ID_OBRA,
  nombre: 'Edificio Las Palmas',
  ubicacion: 'Santa Cruz',
  zona: null,
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

const material = (id: string, codigo: string, nombre: string) => ({
  id,
  codigo,
  nombre,
  tipo: 'OTRO',
  unidad: 'bolsa',
  unidadPlural: 'bolsas',
  precioReferencial: 62,
  activo: true,
  atributos: [],
});
const CATALOGO = [
  material('m1', 'CEM-IP30', 'Cemento IP-30'),
  material('m2', 'ACE-12', 'Acero de 12 mm'),
];

/** Contrato REST de IA: `GET /consumos-atipicos` (403). */
const consumo = (
  id: string,
  materialId: string,
  revision: {
    estadoRevision: string;
    revisadoPor: string | null;
    revisadoEn: string | null;
    comentario: string | null;
  },
) => ({
  id,
  movimientoId: id,
  obraId: ID_OBRA,
  materialId,
  partidaId: 'p1',
  cantidad: 120,
  periodo: '2026-11',
  registradoEn: '2026-11-15T02:40:00Z',
  puntaje: 0.71,
  motivos: [
    'La cantidad es 4,2 veces la habitual de este material en la obra',
    'Se registró fuera del horario habitual (22:40)',
  ],
  ...revision,
  versionModelo: 'ca-1.0.0',
  detectadoEn: '2026-11-15T02:40:03Z',
});
const PENDIENTE = {
  estadoRevision: 'PENDIENTE',
  revisadoPor: null,
  revisadoEn: null,
  comentario: null,
};
const CONFIRMADO = {
  estadoRevision: 'CONFIRMADO',
  revisadoPor: REVISOR,
  revisadoEn: '2026-11-16T13:00:00Z',
  comentario: 'Se usó en la losa de otra obra sin registrarlo',
};
const CONSUMOS = [
  consumo('mov-1', 'm1', PENDIENTE),
  consumo('mov-2', 'm2', CONFIRMADO),
  consumo('mov-3', 'm9', PENDIENTE),
];

const CAMPOS = `id movimientoId obraId materialId material { nombre } partidaId cantidad periodo registradoEn
  puntaje motivos estadoRevision revisadoPor { id nombre } revisadoEn comentario versionModelo`;

/** Responde según la ruta (sin la consulta); lo que no está en el mapa responde 404. */
const porRuta =
  (mapa: Record<string, Respuesta>) =>
  ({ ruta }: { ruta: string }): Respuesta =>
    mapa[ruta.split('?')[0]] ?? { estado: 404 };

/** 403: consumos atípicos contra Obras, Materiales, Keycloak e IA simulados. */
describe('Consumos atípicos (e2e)', () => {
  let app: INestApplication;
  const obras = new ServicioSimulado();
  const materiales = new ServicioSimulado();
  const keycloak = new ServicioSimulado();
  const ia = new ServicioSimulado();
  let firmar: Awaited<ReturnType<typeof crearClavesPrueba>>['firmar'];

  beforeAll(async () => {
    process.env.OBRAS_URL = await obras.escuchar();
    process.env.MATERIALES_URL = await materiales.escuchar();
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
    for (const servicio of [obras, materiales, keycloak, ia])
      servicio.reiniciar();
    obras.responder = porRuta({ [`/obras/${ID_OBRA}`]: { cuerpo: OBRA_REST } });
    materiales.responder = porRuta({
      '/materiales': {
        cuerpo: { items: CATALOGO, total: 2, pagina: 1, tamano: 100 },
      },
    });
    keycloak.responder = ({ ruta }) =>
      ruta.endsWith('/protocol/openid-connect/token')
        ? { cuerpo: { access_token: 'token-gateway', expires_in: 300 } }
        : {
            cuerpo: {
              id: ruta.split('/').pop(),
              firstName: 'Residente',
              lastName: 'Pérez',
            },
          };
    ia.responder = porRuta({ '/consumos-atipicos': { cuerpo: CONSUMOS } });
  });

  afterAll(async () => {
    await app.close();
    for (const servicio of [obras, materiales, keycloak, ia]) servicio.cerrar();
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
        `Bearer ${await firmar({ sub: 'a0000000-0000-4000-8000-000000000003', realm_access: { roles } })}`,
      )
      .set('X-Request-Id', 'req-403')
      .send({ query, variables });

  describe('Obra.consumosAtipicos', () => {
    const CONSULTA = `query ($id: ID!, $estado: EstadoRevision) {
      obra(id: $id) { id consumosAtipicos(estado: $estado) { ${CAMPOS} } }
    }`;

    it('pide GET /consumos-atipicos con la obra y el estado; nombres de material y de revisor resueltos', async () => {
      const respuesta = await consultar(CONSULTA, {
        id: ID_OBRA,
        estado: 'PENDIENTE',
      });
      expect(respuesta.body.errors).toBeUndefined();
      const [primero, segundo, tercero] =
        respuesta.body.data.obra.consumosAtipicos;
      const { detectadoEn: _detectado, ...esperado } = CONSUMOS[0];
      expect(primero).toEqual({
        ...esperado,
        material: { nombre: 'Cemento IP-30' },
        revisadoPor: null,
      });
      expect(segundo).toMatchObject({
        estadoRevision: 'CONFIRMADO',
        material: { nombre: 'Acero de 12 mm' },
        revisadoPor: { id: REVISOR, nombre: 'Residente Pérez' },
        revisadoEn: '2026-11-16T13:00:00Z',
        comentario: 'Se usó en la losa de otra obra sin registrarlo',
      });
      // Material que no está en el catálogo: null sin error
      expect(tercero.material).toBeNull();
      expect(ia.rutas).toEqual([
        `/consumos-atipicos?obraId=${ID_OBRA}&estado=PENDIENTE`,
      ]);
      expect(ia.pedidos[0].encabezados.authorization).toMatch(/^Bearer /);
      expect(ia.pedidos[0].encabezados['x-request-id']).toBe('req-403');
      // Catálogo una sola vez por petición, aunque haya varios consumos
      expect(materiales.rutas).toEqual(['/materiales?pagina=1&tamano=100']);
      expect(keycloak.rutas.filter((ruta) => ruta.includes('/users/'))).toEqual(
        [`/admin/realms/supervision/users/${REVISOR}`],
      );
    });

    it('sin estado no filtra (todas las revisiones)', async () => {
      await consultar(
        'query ($id: ID!) { obra(id: $id) { consumosAtipicos { id } } }',
        { id: ID_OBRA },
      );
      expect(ia.rutas).toEqual([`/consumos-atipicos?obraId=${ID_OBRA}`]);
    });

    it('sin pedir material ni revisor no llama a Materiales ni a Keycloak', async () => {
      await consultar(
        'query ($id: ID!) { obra(id: $id) { consumosAtipicos { id puntaje } } }',
        { id: ID_OBRA },
      );
      expect(materiales.pedidos).toHaveLength(0);
      expect(keycloak.pedidos).toHaveLength(0);
    });

    it('IA caído: solo consumosAtipicos vuelve null con SERVICIO_NO_DISPONIBLE (servicio ia)', async () => {
      ia.responder = () => ({ estado: 503 });
      const respuesta = await consultar(
        'query ($id: ID!) { obra(id: $id) { id nombre consumosAtipicos { id } } }',
        { id: ID_OBRA },
      );
      expect(respuesta.body.data.obra).toEqual({
        id: ID_OBRA,
        nombre: 'Edificio Las Palmas',
        consumosAtipicos: null,
      });
      expect(respuesta.body.errors).toHaveLength(1);
      expect(respuesta.body.errors[0].path).toEqual([
        'obra',
        'consumosAtipicos',
      ]);
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'SERVICIO_NO_DISPONIBLE',
        servicio: 'ia',
      });
    });

    it('Materiales caído: solo material vuelve null; los consumos llegan', async () => {
      materiales.responder = () => ({ estado: 503 });
      const respuesta = await consultar(
        'query ($id: ID!) { obra(id: $id) { consumosAtipicos { id material { nombre } } } }',
        { id: ID_OBRA },
      );
      expect(respuesta.body.data.obra.consumosAtipicos).toEqual(
        CONSUMOS.map(({ id }) => ({ id, material: null })),
      );
      for (const error of respuesta.body.errors) {
        expect(error.extensions).toMatchObject({
          codigo: 'SERVICIO_NO_DISPONIBLE',
          servicio: 'materiales',
        });
      }
    });

    it('404 OBRA_NO_ENCONTRADA de IA llega con su codigo', async () => {
      ia.responder = () => ({
        estado: 404,
        cuerpo: { title: 'Obra no encontrada', codigo: 'OBRA_NO_ENCONTRADA' },
      });
      const respuesta = await consultar(
        'query ($id: ID!) { obra(id: $id) { id consumosAtipicos { id } } }',
        { id: ID_OBRA },
      );
      expect(respuesta.body.data.obra).toEqual({
        id: ID_OBRA,
        consumosAtipicos: null,
      });
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'OBRA_NO_ENCONTRADA',
        servicio: 'ia',
        estado: 404,
      });
    });
  });

  describe('tablero', () => {
    const fila = (id: string) => ({
      ...OBRA_REST,
      id,
      nombre: `Obra ${id}`,
      ultimaPlanilla: null,
    });
    const CONSULTA_TABLERO = `{
      tablero {
        indicadores { obrasEnEjecucion consumosAtipicosPendientes }
        obras { obraId enRiesgo consumosAtipicosPendientes }
      }
    }`;
    /** Ids pedidos en una llamada a `GET /consumos-atipicos/resumen?obraIds=`. */
    const idsPedidos = (ruta: string) =>
      new URL(ruta, 'http://x').searchParams.get('obraIds')!.split(',');

    beforeEach(() => {
      obras.responder = porRuta({
        '/obras': { cuerpo: ['o1', 'o2', 'o3'].map(fila) },
      });
      ia.responder = porRuta({
        '/consumos-atipicos/resumen': {
          cuerpo: [
            { obraId: 'o1', pendientes: 2 },
            { obraId: 'o2', pendientes: 0 },
          ],
        },
      });
    });

    it('filas e indicador en una sola llamada al resumen; una obra que IA no devuelve cuenta 0', async () => {
      const respuesta = await consultar(CONSULTA_TABLERO, {}, ['gerente']);
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.tablero).toEqual({
        indicadores: { obrasEnEjecucion: 3, consumosAtipicosPendientes: 2 },
        obras: [
          { obraId: 'o1', enRiesgo: true, consumosAtipicosPendientes: 2 },
          { obraId: 'o2', enRiesgo: true, consumosAtipicosPendientes: 0 },
          { obraId: 'o3', enRiesgo: true, consumosAtipicosPendientes: 0 },
        ],
      });
      expect(ia.rutas).toEqual(['/consumos-atipicos/resumen?obraIds=o1,o2,o3']);
    });

    it.each([
      [100, [100]],
      [101, [100, 1]],
      [230, [100, 100, 30]],
    ])(
      '%i obras en lotes de hasta 100 obraId (%j)',
      async (cantidad, lotes) => {
        obras.responder = porRuta({
          '/obras': {
            cuerpo: Array.from({ length: cantidad }, (_, i) =>
              fila(`obra-${i}`),
            ),
          },
        });
        ia.responder = ({ ruta }) => ({
          cuerpo: idsPedidos(ruta).map((obraId) => ({
            obraId,
            pendientes: 1,
          })),
        });
        const respuesta = await consultar(CONSULTA_TABLERO);
        expect(respuesta.body.errors).toBeUndefined();
        expect(ia.pedidos.map((p) => idsPedidos(p.ruta).length)).toEqual(lotes);
        expect(
          respuesta.body.data.tablero.indicadores.consumosAtipicosPendientes,
        ).toBe(cantidad);
      },
    );

    it('sin obras en ejecución: 0 sin llamar a IA', async () => {
      obras.responder = () => ({ cuerpo: [] });
      const respuesta = await consultar(CONSULTA_TABLERO);
      expect(respuesta.body.data.tablero).toEqual({
        indicadores: { obrasEnEjecucion: 0, consumosAtipicosPendientes: 0 },
        obras: [],
      });
      expect(ia.pedidos).toHaveLength(0);
    });

    it('IA tarda más de 3 s: columna e indicador null con SERVICIO_NO_DISPONIBLE; el resto del tablero llega', async () => {
      ia.responder = () => ({ cuerpo: [], esperaMs: 3500 });
      const respuesta = await consultar(CONSULTA_TABLERO);
      expect(respuesta.body.data.tablero).toEqual({
        indicadores: { obrasEnEjecucion: 3, consumosAtipicosPendientes: null },
        obras: ['o1', 'o2', 'o3'].map((obraId) => ({
          obraId,
          enRiesgo: true,
          consumosAtipicosPendientes: null,
        })),
      });
      const errores = respuesta.body.errors as {
        path: (string | number)[];
        extensions: Record<string, unknown>;
      }[];
      expect(errores.map((error) => error.path)).toEqual(
        expect.arrayContaining([
          ['tablero', 'indicadores', 'consumosAtipicosPendientes'],
          ['tablero', 'obras', 1, 'consumosAtipicosPendientes'],
        ]),
      );
      for (const error of errores) {
        expect(error.extensions).toMatchObject({
          codigo: 'SERVICIO_NO_DISPONIBLE',
          servicio: 'ia',
        });
      }
      // Un solo lote y su reintento
      expect(ia.pedidos).toHaveLength(2);
    }, 15000);
  });

  describe('revisarConsumoAtipico', () => {
    const MUTACION = `mutation ($id: ID!, $estado: EstadoRevision!, $comentario: String) {
      revisarConsumoAtipico(id: $id, estado: $estado, comentario: $comentario) {
        id estadoRevision revisadoPor { id nombre } revisadoEn comentario material { nombre }
      }
    }`;
    const REVISADO = consumo('mov-1', 'm1', CONFIRMADO);
    const VARIABLES = {
      id: 'mov-1',
      estado: 'CONFIRMADO',
      comentario: CONFIRMADO.comentario,
    };

    beforeEach(() => {
      ia.responder = porRuta({
        '/consumos-atipicos/mov-1/revision': { cuerpo: REVISADO },
      });
    });

    it.each([['residente'], ['admin']])(
      '%s revisa: PUT /consumos-atipicos/{id}/revision con estado y comentario; revisor y material resueltos',
      async (rol) => {
        const respuesta = await consultar(MUTACION, VARIABLES, [rol]);
        expect(respuesta.body.errors).toBeUndefined();
        expect(respuesta.body.data.revisarConsumoAtipico).toEqual({
          id: 'mov-1',
          estadoRevision: 'CONFIRMADO',
          revisadoPor: { id: REVISOR, nombre: 'Residente Pérez' },
          revisadoEn: CONFIRMADO.revisadoEn,
          comentario: CONFIRMADO.comentario,
          material: { nombre: 'Cemento IP-30' },
        });
        expect(ia.pedidos).toHaveLength(1);
        expect(ia.pedidos[0]).toMatchObject({
          metodo: 'PUT',
          ruta: '/consumos-atipicos/mov-1/revision',
        });
        expect(JSON.parse(ia.pedidos[0].cuerpo)).toEqual({
          estado: 'CONFIRMADO',
          comentario: CONFIRMADO.comentario,
        });
        expect(ia.pedidos[0].encabezados.authorization).toMatch(/^Bearer /);
        expect(ia.pedidos[0].encabezados['x-request-id']).toBe('req-403');
      },
    );

    it('«Es normal» sin comentario no lo manda', async () => {
      await consultar(MUTACION, { id: 'mov-1', estado: 'NORMAL' });
      expect(JSON.parse(ia.pedidos[0].cuerpo)).toEqual({ estado: 'NORMAL' });
    });

    it.each([
      [404, 'CONSUMO_ATIPICO_NO_ENCONTRADO'],
      [409, 'REVISION_YA_REGISTRADA'],
      [400, 'DATOS_INVALIDOS'],
    ])(
      '%i %s de IA llega en extensions.codigo con data null',
      async (estado, codigo) => {
        ia.responder = () => ({
          estado,
          cuerpo: { title: 'Error', status: estado, codigo },
        });
        const respuesta = await consultar(MUTACION, VARIABLES);
        expect(respuesta.body.data).toBeNull();
        expect(respuesta.body.errors).toHaveLength(1);
        expect(respuesta.body.errors[0].path).toEqual([
          'revisarConsumoAtipico',
        ]);
        expect(respuesta.body.errors[0].extensions).toMatchObject({
          codigo,
          servicio: 'ia',
          estado,
        });
      },
    );

    it('422 COMENTARIO_INVALIDO llega con los errores por campo', async () => {
      const errores = [
        { campo: 'comentario', mensaje: 'Debe tener entre 5 y 300 caracteres' },
      ];
      ia.responder = () => ({
        estado: 422,
        cuerpo: {
          title: 'Comentario inválido',
          status: 422,
          codigo: 'COMENTARIO_INVALIDO',
          errores,
        },
      });
      const respuesta = await consultar(MUTACION, {
        ...VARIABLES,
        comentario: 'no',
      });
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'COMENTARIO_INVALIDO',
        servicio: 'ia',
        estado: 422,
        errores,
      });
    });

    it('un 500 de IA no se reintenta (es una mutación)', async () => {
      ia.responder = () => ({
        estado: 500,
        cuerpo: { title: 'Error', codigo: 'ERROR_INTERNO' },
      });
      const respuesta = await consultar(MUTACION, VARIABLES);
      expect(respuesta.body.errors[0].extensions.codigo).toBe('ERROR_INTERNO');
      expect(ia.pedidos).toHaveLength(1);
    });

    it('IA tarda más de 3 s: SERVICIO_NO_DISPONIBLE sin reintento', async () => {
      ia.responder = () => ({ cuerpo: REVISADO, esperaMs: 3500 });
      const respuesta = await consultar(MUTACION, VARIABLES);
      expect(respuesta.body.data).toBeNull();
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'SERVICIO_NO_DISPONIBLE',
        servicio: 'ia',
      });
      expect(ia.pedidos).toHaveLength(1);
    }, 15000);

    it.each([['gerente'], ['maestro']])(
      '%s recibe SIN_PERMISO sin llamar a IA',
      async (rol) => {
        const respuesta = await consultar(MUTACION, VARIABLES, [rol]);
        expect(respuesta.body.data).toBeNull();
        expect(respuesta.body.errors[0].extensions).toMatchObject({
          codigo: 'SIN_PERMISO',
          estado: 403,
        });
        expect(ia.pedidos).toHaveLength(0);
      },
    );
  });
});
