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

const ID_1 = 'b0000000-0000-4000-8000-000000000401';
const ID_2 = 'b0000000-0000-4000-8000-000000000402';
const ID_3 = 'b0000000-0000-4000-8000-000000000403';

const resumen = (id: string, nombre: string) => ({
  id,
  nombre,
  ubicacion: 'Santa Cruz',
  zona: 'NORTE',
  estado: 'EN_EJECUCION',
  fechaInicio: '2026-11-01',
  avancePct: 20,
  plazoPct: 41,
  enRiesgo: true,
  ultimaPlanilla: null,
});

const OBRAS_REST = [
  resumen(ID_1, 'Casa Urubó'),
  resumen(ID_2, 'Edificio Las Palmas'),
  resumen(ID_3, 'Galpón Norte'),
];

const FACTOR = {
  variable: 'relacion_ritmo',
  descripcion:
    'El ritmo de avance de los últimos meses es menor al necesario para terminar a tiempo',
  peso: 0.81,
};

/** Contrato REST de IA: `GET /predicciones?obraIds=` (402). Solo vienen las obras con predicción. */
const prediccion = (
  obraId: string,
  probabilidad: number | null,
  nivel: string,
) => ({
  obraId,
  probabilidad,
  nivel,
  factores: probabilidad === null ? [] : [FACTOR],
  versionModelo: 'rr-1.0.0',
  calculadaEn: '2026-11-15T05:00:00Z',
});

const PREDICCIONES = [
  prediccion(ID_1, 0.72, 'ALTO'),
  prediccion(ID_2, 0.41, 'MEDIO'),
];

const RIESGO_1 = {
  probabilidad: 0.72,
  nivel: 'ALTO',
  factores: [FACTOR],
  versionModelo: 'rr-1.0.0',
  calculadaEn: '2026-11-15T05:00:00Z',
};
const RIESGO_2 = { ...RIESGO_1, probabilidad: 0.41, nivel: 'MEDIO' };
const SIN_DATOS = {
  probabilidad: null,
  nivel: 'SIN_DATOS',
  factores: [],
  versionModelo: null,
  calculadaEn: null,
};

const RIESGO = `riesgoRetraso { probabilidad nivel factores { variable descripcion peso } versionModelo calculadaEn }`;
const CONSULTA_TABLERO = `{
  tablero {
    indicadores { obrasEnEjecucion obrasRiesgoAlto }
    obras { obraId enRiesgo ${RIESGO} }
  }
}`;

/** Responde según la ruta (sin la consulta); lo que no está en el mapa responde 404. */
const porRuta =
  (mapa: Record<string, Respuesta>) =>
  ({ ruta }: { ruta: string }): Respuesta =>
    mapa[ruta.split('?')[0]] ?? { estado: 404 };

/** Ids pedidos en una llamada a `GET /predicciones?obraIds=`. */
const idsPedidos = (ruta: string) =>
  new URL(ruta, 'http://x').searchParams.get('obraIds')!.split(',');

/** 402: riesgo de retraso del modelo contra Obras e IA simulados. */
describe('Riesgo de retraso (e2e)', () => {
  let app: INestApplication;
  const obras = new ServicioSimulado();
  const ia = new ServicioSimulado();
  let firmar: Awaited<ReturnType<typeof crearClavesPrueba>>['firmar'];

  beforeAll(async () => {
    process.env.OBRAS_URL = await obras.escuchar();
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
    obras.reiniciar();
    ia.reiniciar();
    obras.responder = porRuta({ '/obras': { cuerpo: OBRAS_REST } });
    ia.responder = porRuta({ '/predicciones': { cuerpo: PREDICCIONES } });
  });

  afterAll(async () => {
    await app.close();
    obras.cerrar();
    ia.cerrar();
  });

  const consultar = async (query: string, roles: string[] = ['gerente']) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set(
        'Authorization',
        `Bearer ${await firmar({ sub: 'a0000000-0000-4000-8000-000000000002', realm_access: { roles } })}`,
      )
      .set('X-Request-Id', 'req-402')
      .send({ query });

  describe('tablero', () => {
    it('filas e indicador en una sola llamada a GET /predicciones; obra sin predicción → SIN_DATOS', async () => {
      const respuesta = await consultar(CONSULTA_TABLERO);
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.tablero).toEqual({
        indicadores: { obrasEnEjecucion: 3, obrasRiesgoAlto: 1 },
        obras: [
          { obraId: ID_1, enRiesgo: true, riesgoRetraso: RIESGO_1 },
          { obraId: ID_2, enRiesgo: true, riesgoRetraso: RIESGO_2 },
          { obraId: ID_3, enRiesgo: true, riesgoRetraso: SIN_DATOS },
        ],
      });
      expect(ia.rutas).toEqual([
        `/predicciones?obraIds=${ID_1},${ID_2},${ID_3}`,
      ]);
      expect(ia.pedidos[0].encabezados.authorization).toMatch(/^Bearer /);
      expect(ia.pedidos[0].encabezados['x-request-id']).toBe('req-402');
    });

    it('IA devuelve SIN_DATOS: probabilidad null y sin factores', async () => {
      ia.responder = porRuta({
        '/predicciones': { cuerpo: [prediccion(ID_1, null, 'SIN_DATOS')] },
      });
      const respuesta = await consultar(
        `{ tablero { obras { obraId ${RIESGO} } } }`,
        ['residente'],
      );
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.tablero.obras[0].riesgoRetraso).toEqual({
        ...SIN_DATOS,
        versionModelo: 'rr-1.0.0',
        calculadaEn: '2026-11-15T05:00:00Z',
      });
    });

    it.each([
      [100, [100]],
      [101, [100, 1]],
      [230, [100, 100, 30]],
    ])(
      '%i obras en lotes de hasta 100 obraId (%j)',
      async (cantidad, lotes) => {
        const muchas = Array.from({ length: cantidad }, (_, i) =>
          resumen(`obra-${i}`, `Obra ${i}`),
        );
        obras.responder = porRuta({ '/obras': { cuerpo: muchas } });
        // Todas en ALTO, salvo las que no vienen (SIN_DATOS): IA devuelve solo las pares
        ia.responder = ({ ruta }) => ({
          cuerpo: idsPedidos(ruta)
            .filter((id) => Number(id.split('-')[1]) % 2 === 0)
            .map((id) => prediccion(id, 0.9, 'ALTO')),
        });
        const respuesta = await consultar(CONSULTA_TABLERO);
        expect(respuesta.body.errors).toBeUndefined();
        expect(ia.pedidos.map((p) => idsPedidos(p.ruta).length)).toEqual(lotes);
        expect(respuesta.body.data.tablero.indicadores.obrasRiesgoAlto).toBe(
          Math.ceil(cantidad / 2),
        );
        expect(
          respuesta.body.data.tablero.obras.filter(
            (fila: { riesgoRetraso: { nivel: string } }) =>
              fila.riesgoRetraso.nivel === 'SIN_DATOS',
          ),
        ).toHaveLength(Math.floor(cantidad / 2));
      },
    );

    it('sin obras en ejecución no llama a IA y el indicador es 0', async () => {
      obras.responder = () => ({ cuerpo: [] });
      const respuesta = await consultar(CONSULTA_TABLERO);
      expect(respuesta.body.data.tablero).toEqual({
        indicadores: { obrasEnEjecucion: 0, obrasRiesgoAlto: 0 },
        obras: [],
      });
      expect(ia.pedidos).toHaveLength(0);
    });

    it('IA caído: riesgo e indicador null con SERVICIO_NO_DISPONIBLE (servicio ia); el resto del tablero llega', async () => {
      ia.responder = () => ({ estado: 503 });
      const respuesta = await consultar(CONSULTA_TABLERO);
      expect(respuesta.body.data.tablero).toEqual({
        indicadores: { obrasEnEjecucion: 3, obrasRiesgoAlto: null },
        obras: [ID_1, ID_2, ID_3].map((obraId) => ({
          obraId,
          enRiesgo: true,
          riesgoRetraso: null,
        })),
      });
      const errores = respuesta.body.errors as {
        path: (string | number)[];
        extensions: Record<string, unknown>;
      }[];
      expect(errores.map((error) => error.path)).toEqual(
        expect.arrayContaining([
          ['tablero', 'indicadores', 'obrasRiesgoAlto'],
          ['tablero', 'obras', 0, 'riesgoRetraso'],
          ['tablero', 'obras', 2, 'riesgoRetraso'],
        ]),
      );
      for (const error of errores) {
        expect(error.extensions).toMatchObject({
          codigo: 'SERVICIO_NO_DISPONIBLE',
          servicio: 'ia',
        });
      }
      // Un solo lote y su reintento (las consultas se reintentan una vez)
      expect(ia.pedidos).toHaveLength(2);
    });
  });
});
