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

const ID_1 = 'b0000000-0000-4000-8000-000000000201';
const ID_2 = 'b0000000-0000-4000-8000-000000000202';
const ID_3 = 'b0000000-0000-4000-8000-000000000203';

const resumen = (
  id: string,
  nombre: string,
  avancePct: number,
  plazoPct: number,
  enRiesgo: boolean,
  ultimaPlanilla: { periodo: string; estado: string } | null,
) => ({
  id,
  nombre,
  ubicacion: 'Santa Cruz',
  estado: 'EN_EJECUCION',
  fechaInicio: '2026-11-01',
  avancePct,
  plazoPct,
  enRiesgo,
  ultimaPlanilla,
});

/** Contrato REST de Obras: `GET /obras?estado=EN_EJECUCION` (ordenadas por nombre). */
const OBRAS_REST = [
  resumen(ID_1, 'Casa Urubó', 60, 55, false, {
    periodo: '2027-02',
    estado: 'APROBADA',
  }),
  resumen(ID_2, 'Edificio Las Palmas', 20, 41.1, true, {
    periodo: '2027-03',
    estado: 'PRESENTADA',
  }),
  resumen(ID_3, 'Galpón Norte', 0, 5, false, null),
];

/** Contrato REST de Materiales: `GET /stock/resumen?obraIds=` (una obra sin filas de stock no aparece). */
const STOCK_RESUMEN = [
  { obraId: ID_1, materialesBajos: 0 },
  { obraId: ID_2, materialesBajos: 3 },
];

/** Contrato REST de Finanzas: `GET /cobros/resumen`. */
const COBROS_RESUMEN = {
  vencidos: { cantidad: 1, monto: 41881.8 },
  porVencer30Dias: { cantidad: 2, monto: 90000 },
};

const CONSULTA = `{
  tablero {
    indicadores { obrasEnEjecucion obrasEnRiesgo materialesBajos cobrosVencidos { cantidad monto } }
    obras { obraId nombre avancePct plazoPct diferencia enRiesgo materialesBajos ultimaPlanilla { periodo estado } }
  }
}`;

const FILAS = [
  {
    obraId: ID_1,
    nombre: 'Casa Urubó',
    avancePct: 60,
    plazoPct: 55,
    diferencia: -5,
    enRiesgo: false,
    materialesBajos: 0,
    ultimaPlanilla: { periodo: '2027-02', estado: 'APROBADA' },
  },
  {
    obraId: ID_2,
    nombre: 'Edificio Las Palmas',
    avancePct: 20,
    plazoPct: 41.1,
    diferencia: 21.1,
    enRiesgo: true,
    materialesBajos: 3,
    ultimaPlanilla: { periodo: '2027-03', estado: 'PRESENTADA' },
  },
  {
    obraId: ID_3,
    nombre: 'Galpón Norte',
    avancePct: 0,
    plazoPct: 5,
    diferencia: 5,
    enRiesgo: false,
    materialesBajos: 0,
    ultimaPlanilla: null,
  },
];

/** Responde según la ruta (sin la consulta); lo que no está en el mapa responde 404. */
const porRuta =
  (mapa: Record<string, Respuesta>) =>
  ({ ruta }: { ruta: string }): Respuesta =>
    mapa[ruta.split('?')[0]] ?? { estado: 404 };

/** 009: tablero contra Obras, Materiales y Finanzas simulados (lote a Materiales y respuesta parcial). */
describe('Tablero (e2e)', () => {
  let app: INestApplication;
  const obras = new ServicioSimulado();
  const materiales = new ServicioSimulado();
  const finanzas = new ServicioSimulado();
  const keycloak = new ServicioSimulado();
  let firmar: Awaited<ReturnType<typeof crearClavesPrueba>>['firmar'];

  beforeAll(async () => {
    process.env.OBRAS_URL = await obras.escuchar();
    process.env.MATERIALES_URL = await materiales.escuchar();
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
    for (const servicio of [obras, materiales, finanzas, keycloak])
      servicio.reiniciar();
    obras.responder = porRuta({ '/obras': { cuerpo: OBRAS_REST } });
    materiales.responder = porRuta({
      '/stock/resumen': { cuerpo: STOCK_RESUMEN },
    });
    finanzas.responder = porRuta({
      '/cobros/resumen': { cuerpo: COBROS_RESUMEN },
    });
  });

  afterAll(async () => {
    await app.close();
    for (const servicio of [obras, materiales, finanzas, keycloak])
      servicio.cerrar();
  });

  const consultar = async (roles: string[] = ['gerente'], query = CONSULTA) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set(
        'Authorization',
        `Bearer ${await firmar({ sub: 'a0000000-0000-4000-8000-000000000002', realm_access: { roles } })}`,
      )
      .set('X-Request-Id', 'req-009')
      .send({ query });

  it('arma indicadores y filas con una llamada a cada servicio (Materiales en un solo lote)', async () => {
    const respuesta = await consultar();
    expect(respuesta.body.errors).toBeUndefined();
    expect(respuesta.body.data.tablero).toEqual({
      indicadores: {
        obrasEnEjecucion: 3,
        obrasEnRiesgo: 1,
        materialesBajos: 3,
        cobrosVencidos: { cantidad: 1, monto: 41881.8 },
      },
      obras: FILAS,
    });
    expect(obras.rutas).toEqual(['/obras?estado=EN_EJECUCION']);
    expect(materiales.rutas).toEqual([
      `/stock/resumen?obraIds=${ID_1},${ID_2},${ID_3}`,
    ]);
    expect(finanzas.rutas).toEqual(['/cobros/resumen']);
    for (const servicio of [obras, materiales, finanzas]) {
      expect(servicio.pedidos[0].encabezados['x-request-id']).toBe('req-009');
      expect(servicio.pedidos[0].encabezados.authorization).toMatch(/^Bearer /);
    }
  });

  it('solo las filas (sin indicadores) también piden Materiales en una sola llamada', async () => {
    const respuesta = await consultar(
      ['admin'],
      '{ tablero { obras { obraId materialesBajos } } }',
    );
    expect(respuesta.body.errors).toBeUndefined();
    expect(respuesta.body.data.tablero.obras).toEqual(
      FILAS.map(({ obraId, materialesBajos }) => ({ obraId, materialesBajos })),
    );
    expect(materiales.pedidos).toHaveLength(1);
    expect(finanzas.pedidos).toHaveLength(0);
  });

  it('residente: cobrosVencidos es null sin error y sin llamar a Finanzas', async () => {
    const respuesta = await consultar(['residente']);
    expect(respuesta.body.errors).toBeUndefined();
    expect(respuesta.body.data.tablero.indicadores).toEqual({
      obrasEnEjecucion: 3,
      obrasEnRiesgo: 1,
      materialesBajos: 3,
      cobrosVencidos: null,
    });
    expect(respuesta.body.data.tablero.obras).toEqual(FILAS);
    expect(finanzas.pedidos).toHaveLength(0);
  });

  it('sin obras en ejecución: indicadores en 0, filas vacías y sin llamar a Materiales', async () => {
    obras.responder = () => ({ cuerpo: [] });
    const respuesta = await consultar(['residente']);
    expect(respuesta.body.errors).toBeUndefined();
    expect(respuesta.body.data.tablero).toEqual({
      indicadores: {
        obrasEnEjecucion: 0,
        obrasEnRiesgo: 0,
        materialesBajos: 0,
        cobrosVencidos: null,
      },
      obras: [],
    });
    expect(materiales.pedidos).toHaveLength(0);
  });

  it('Materiales caído: solo sus columnas e indicador vuelven null con SERVICIO_NO_DISPONIBLE', async () => {
    materiales.responder = () => ({ estado: 503 });
    const respuesta = await consultar();
    const { indicadores, obras: filas } = respuesta.body.data.tablero;
    expect(indicadores).toEqual({
      obrasEnEjecucion: 3,
      obrasEnRiesgo: 1,
      materialesBajos: null,
      cobrosVencidos: { cantidad: 1, monto: 41881.8 },
    });
    expect(filas).toEqual(
      FILAS.map((fila) => ({ ...fila, materialesBajos: null })),
    );
    const errores = respuesta.body.errors as {
      path: (string | number)[];
      extensions: Record<string, unknown>;
    }[];
    expect(errores.map((error) => error.path)).toEqual(
      expect.arrayContaining([
        ['tablero', 'indicadores', 'materialesBajos'],
        ['tablero', 'obras', 0, 'materialesBajos'],
        ['tablero', 'obras', 2, 'materialesBajos'],
      ]),
    );
    for (const error of errores) {
      expect(error.extensions).toMatchObject({
        codigo: 'SERVICIO_NO_DISPONIBLE',
        servicio: 'materiales',
      });
    }
    // Una sola llamada en lote y su reintento (las consultas se reintentan una vez)
    expect(materiales.pedidos).toHaveLength(2);
  });

  it('Finanzas caído: solo cobrosVencidos vuelve null con SERVICIO_NO_DISPONIBLE', async () => {
    finanzas.responder = () => ({ estado: 503 });
    const respuesta = await consultar(['admin']);
    expect(respuesta.body.data.tablero.indicadores).toEqual({
      obrasEnEjecucion: 3,
      obrasEnRiesgo: 1,
      materialesBajos: 3,
      cobrosVencidos: null,
    });
    expect(respuesta.body.data.tablero.obras).toEqual(FILAS);
    expect(respuesta.body.errors).toHaveLength(1);
    expect(respuesta.body.errors[0].path).toEqual([
      'tablero',
      'indicadores',
      'cobrosVencidos',
    ]);
    expect(respuesta.body.errors[0].extensions).toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE',
      servicio: 'finanzas',
    });
  });

  it('Obras caído: filas e indicadores de Obras vuelven null; cobros vencidos llega igual', async () => {
    obras.responder = () => ({ estado: 503 });
    const respuesta = await consultar();
    expect(respuesta.body.data.tablero).toEqual({
      indicadores: {
        obrasEnEjecucion: null,
        obrasEnRiesgo: null,
        materialesBajos: null,
        cobrosVencidos: { cantidad: 1, monto: 41881.8 },
      },
      obras: null,
    });
    for (const error of respuesta.body.errors) {
      expect(error.extensions).toMatchObject({
        codigo: 'SERVICIO_NO_DISPONIBLE',
        servicio: 'obras',
      });
    }
    // Una sola consulta compartida por filas e indicadores, con su reintento
    expect(obras.pedidos).toHaveLength(2);
    expect(materiales.pedidos).toHaveLength(0);
  });

  it('Finanzas tarda más de 3 s: solo cobrosVencidos vuelve null; el resto llega', async () => {
    finanzas.responder = () => ({ cuerpo: COBROS_RESUMEN, esperaMs: 3500 });
    const respuesta = await consultar();
    expect(respuesta.body.data.tablero.indicadores.cobrosVencidos).toBeNull();
    expect(respuesta.body.data.tablero.obras).toEqual(FILAS);
    expect(respuesta.body.errors[0].extensions).toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE',
      servicio: 'finanzas',
    });
  }, 15000);

  it('un maestro recibe SIN_PERMISO sin llamar a los servicios', async () => {
    const respuesta = await consultar(['maestro']);
    expect(respuesta.body.data).toBeNull();
    expect(respuesta.body.errors[0].extensions.codigo).toBe('SIN_PERMISO');
    expect(obras.pedidos).toHaveLength(0);
  });
});
