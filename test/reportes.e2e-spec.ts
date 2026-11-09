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

const CLIENTE = 'a0000000-0000-4000-8000-000000000004';
const RUTA_CLIENTES =
  '/admin/realms/supervision/roles/cliente/users?first=0&max=1000';

/** Contrato REST de IA: `GET /catalogo-reportes` (503). */
const CATALOGO = {
  conjuntos: [
    {
      conjunto: 'CONSUMO_MATERIAL',
      titulo: 'Material usado',
      descripcion: 'Cantidad, monto referencial y número de salidas',
      columnas: [{ clave: 'material', titulo: 'Material', tipo: 'TEXTO' }],
      filtros: ['obra', 'zona', 'cliente', 'material', 'periodo'],
      agrupaciones: ['obra', 'zona', 'cliente', 'material', 'periodo'],
      ejemplos: ['¿Cuánto cemento se usó en Las Palmas este trimestre?'],
    },
  ],
  atajos: [
    {
      atajo: 'COBROS_POR_VENCER',
      titulo: 'Cobros que vencen en los próximos 30 días',
      descripcion: 'Cobros pendientes que vencen pronto',
    },
  ],
};

/** Contrato REST de IA: `GET /consultas-reporte` (503). */
const HISTORIAL = [
  {
    id: 'c2',
    texto: null,
    atajo: 'COBROS_POR_VENCER',
    conjunto: 'COBROS',
    resultado: 'OK',
    resumen: 'Hay 2 cobros que vencen en los próximos 30 días.',
    totalFilas: 2,
    creadaEn: '2027-03-20T14:05:00Z',
  },
  {
    id: 'c1',
    texto: '¿Qué tiempo hace?',
    atajo: null,
    conjunto: null,
    resultado: 'NO_RECONOCIDA',
    resumen: null,
    totalFilas: null,
    creadaEn: '2027-03-20T14:00:00Z',
  },
];

/** Contrato REST de IA: el reporte (`consulta`) de la respuesta `200` de `POST /consultas-reporte` (503). */
const CONSULTA = {
  id: 'r1',
  texto: '¿Cuánto cemento se usó en Las Palmas este trimestre?',
  atajo: null,
  conjunto: 'CONSUMO_MATERIAL',
  tituloConjunto: 'Material usado',
  receta: { conjunto: 'CONSUMO_MATERIAL', agruparPor: ['obra', 'material'] },
  aplicado: [
    { nombre: 'Obra', valor: 'contiene «Las Palmas»' },
    { nombre: 'Agrupado por', valor: 'Obra, Material' },
  ],
  resumen: 'En Edificio Las Palmas se usaron 1240 bolsas de cemento IP-30.',
  resumenPlantilla: false,
  avisos: [],
  columnas: [
    { clave: 'obra', titulo: 'Obra', tipo: 'TEXTO' },
    { clave: 'material', titulo: 'Material', tipo: 'TEXTO' },
    { clave: 'unidad', titulo: 'Unidad', tipo: 'TEXTO' },
    { clave: 'suma_cantidad', titulo: 'Total Cantidad', tipo: 'NUMERO' },
    { clave: 'suma_monto', titulo: 'Total Monto referencial', tipo: 'MONTO' },
  ],
  filas: [
    ['Edificio Las Palmas', 'Cemento IP-30', 'bolsa', '1240.000', '76880.00'],
    ['Edificio Las Palmas', 'Arena fina', null, '12.500', '1500.00'],
  ],
  totalFilas: 2,
  truncado: false,
  creadaEn: '2027-03-20T14:00:00Z',
};

const CONVERSACION = 'b0000000-0000-4000-8000-000000000505';

/** Contrato REST de IA: respuesta `200` de `POST /consultas-reporte` con un reporte (505). */
const conReporte = (consulta: Record<string, unknown> = CONSULTA) => ({
  conversacionId: CONVERSACION,
  tipo: 'REPORTE',
  consulta,
  aclaracion: null,
});

/** Contrato REST de IA: respuesta `200` de `POST /consultas-reporte` con una pregunta de aclaración (505). */
const ACLARACION = {
  conversacionId: CONVERSACION,
  tipo: 'ACLARACION',
  consulta: null,
  aclaracion: {
    pregunta: '«cemento» coincide con dos materiales. ¿Cuál?',
    opciones: ['Cemento IP-30', 'Cemento cola', 'Todos'],
    preguntasRestantes: 4,
  },
};

const CAMPOS = `id texto atajo conjunto tituloConjunto aplicado { nombre valor } resumen resumenPlantilla
  avisos columnas { clave titulo tipo } filas totalFilas truncado creadaEn`;
const MUTACION = `mutation ($texto: String, $atajo: AtajoReporte, $conversacionId: ID) {
  consultarReporte(texto: $texto, atajo: $atajo, conversacionId: $conversacionId) {
    conversacionId tipo consulta { ${CAMPOS} } aclaracion { pregunta opciones preguntasRestantes }
  }
}`;

/** Un tipo de la introspección de GraphQL. */
interface TipoIntrospeccion {
  name: string | null;
  kind: string;
  ofType: TipoIntrospeccion | null;
}

/** El tipo como en el SDL del contrato (`[String!]!`) a partir de la introspección. */
const comoSdl = (tipo: TipoIntrospeccion): string =>
  tipo.kind === 'NON_NULL'
    ? `${comoSdl(tipo.ofType!)}!`
    : tipo.kind === 'LIST'
      ? `[${comoSdl(tipo.ofType!)}]`
      : tipo.name!;

/** Responde según la ruta (sin la consulta); lo que no está en el mapa responde 404. */
const porRuta =
  (mapa: Record<string, Respuesta>) =>
  ({ ruta }: { ruta: string }): Respuesta =>
    mapa[ruta.split('?')[0]] ?? { estado: 404 };

const keycloakCon =
  (usuarios: Respuesta) =>
  ({ ruta }: { ruta: string }): Respuesta =>
    ruta.endsWith('/protocol/openid-connect/token')
      ? { cuerpo: { access_token: 'token-gateway', expires_in: 300 } }
      : ruta === RUTA_CLIENTES
        ? usuarios
        : { estado: 404 };

/** 503: constructor de reportes contra Keycloak e IA simulados. */
describe('Reportes (e2e)', () => {
  let app: INestApplication;
  const keycloak = new ServicioSimulado();
  const ia = new ServicioSimulado();
  let firmar: Awaited<ReturnType<typeof crearClavesPrueba>>['firmar'];

  beforeAll(async () => {
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
    for (const servicio of [keycloak, ia]) servicio.reiniciar();
    keycloak.responder = keycloakCon({
      cuerpo: [
        {
          id: CLIENTE,
          firstName: 'Constructora',
          lastName: 'Andina SRL',
          email: 'andina@cliente.bo',
        },
      ],
    });
    ia.responder = porRuta({
      '/catalogo-reportes': { cuerpo: CATALOGO },
      '/consultas-reporte': { cuerpo: HISTORIAL },
    });
  });

  afterAll(async () => {
    await app.close();
    for (const servicio of [keycloak, ia]) servicio.cerrar();
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
        `Bearer ${await firmar({ sub: 'a0000000-0000-4000-8000-000000000002', realm_access: { roles } })}`,
      )
      .set('X-Request-Id', 'req-503')
      .send({ query, variables });

  const iaResponde = (respuesta: Respuesta) =>
    (ia.responder = ({ metodo, ruta }) =>
      metodo === 'POST' && ruta === '/consultas-reporte'
        ? respuesta
        : { estado: 404 });

  describe('catalogoReportes y consultasReporte', () => {
    it('catalogoReportes pide GET /catalogo-reportes con el token y el X-Request-Id', async () => {
      const respuesta = await consultar(`{
        catalogoReportes {
          conjuntos { conjunto titulo descripcion columnas { clave titulo tipo } filtros agrupaciones ejemplos }
          atajos { atajo titulo descripcion }
        }
      }`);
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.catalogoReportes).toEqual(CATALOGO);
      expect(ia.rutas).toEqual(['/catalogo-reportes']);
      expect(ia.pedidos[0].encabezados.authorization).toMatch(/^Bearer /);
      expect(ia.pedidos[0].encabezados['x-request-id']).toBe('req-503');
    });

    it('consultasReporte pasa el límite y devuelve el historial (también las no reconocidas)', async () => {
      const respuesta = await consultar(
        `query ($limite: Int) {
          consultasReporte(limite: $limite) { id texto atajo conjunto resultado resumen totalFilas creadaEn }
        }`,
        { limite: 5 },
      );
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.consultasReporte).toEqual(HISTORIAL);
      expect(ia.rutas).toEqual(['/consultas-reporte?limite=5']);
    });

    it('sin límite no lo envía (IA da 10)', async () => {
      await consultar('{ consultasReporte { id } }');
      expect(ia.rutas).toEqual(['/consultas-reporte']);
    });

    it('las consultas se reintentan una vez si IA falla con 5xx', async () => {
      let intentos = 0;
      ia.responder = () =>
        ++intentos === 1 ? { estado: 502 } : { cuerpo: CATALOGO };
      const respuesta = await consultar(
        '{ catalogoReportes { atajos { atajo } } }',
      );
      expect(respuesta.body.errors).toBeUndefined();
      expect(ia.pedidos).toHaveLength(2);
    });

    it('IA caído: SERVICIO_NO_DISPONIBLE con servicio ia', async () => {
      ia.responder = () => ({ estado: 503 });
      const respuesta = await consultar(
        '{ catalogoReportes { atajos { atajo } } }',
      );
      expect(respuesta.body.data).toBeNull();
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'SERVICIO_NO_DISPONIBLE',
        servicio: 'ia',
      });
    });

    it.each(['residente', 'maestro', 'cliente'])(
      '%s recibe SIN_PERMISO sin llamar a IA',
      async (rol) => {
        const respuesta = await consultar(
          '{ catalogoReportes { atajos { atajo } } consultasReporte { id } }',
          {},
          [rol],
        );
        expect(respuesta.body.errors[0].extensions.codigo).toBe('SIN_PERMISO');
        expect(ia.pedidos).toHaveLength(0);
      },
    );
  });

  describe('consultarReporte', () => {
    // Va primero: la lista de clientes queda en la caché de 5 minutos del gateway después del primer pedido que funciona
    it('Keycloak caído: envía el pedido sin directorio (IA avisa) y el reporte llega', async () => {
      keycloak.responder = keycloakCon({ estado: 503 });
      iaResponde({
        cuerpo: conReporte({
          ...CONSULTA,
          avisos: ['Nombres de clientes no disponibles'],
        }),
      });
      const respuesta = await consultar(MUTACION, { texto: CONSULTA.texto });
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.consultarReporte.consulta.avisos).toEqual([
        'Nombres de clientes no disponibles',
      ]);
      expect(JSON.parse(ia.pedidos[0].cuerpo)).toEqual({
        texto: CONSULTA.texto,
      });
    });

    it('envía el texto con el directorio de clientes de Keycloak y devuelve el reporte sin la receta', async () => {
      iaResponde({ cuerpo: conReporte() });
      const respuesta = await consultar(MUTACION, { texto: CONSULTA.texto });
      expect(respuesta.body.errors).toBeUndefined();
      const { receta: _receta, ...esperado } = CONSULTA;
      expect(respuesta.body.data.consultarReporte).toEqual({
        conversacionId: CONVERSACION,
        tipo: 'REPORTE',
        consulta: esperado,
        aclaracion: null,
      });
      expect(ia.pedidos).toHaveLength(1);
      expect(ia.pedidos[0].metodo).toBe('POST');
      expect(ia.pedidos[0].encabezados.authorization).toMatch(/^Bearer /);
      expect(JSON.parse(ia.pedidos[0].cuerpo)).toEqual({
        texto: CONSULTA.texto,
        directorio: {
          clientes: [{ id: CLIENTE, nombre: 'Constructora Andina SRL' }],
        },
      });
    });

    it('con un atajo envía solo el atajo y el directorio (de la caché: no vuelve a pedir a Keycloak)', async () => {
      iaResponde({
        cuerpo: conReporte({
          ...CONSULTA,
          texto: null,
          atajo: 'COBROS_POR_VENCER',
          conjunto: 'COBROS',
          tituloConjunto: 'Cobros',
        }),
      });
      const respuesta = await consultar(MUTACION, {
        atajo: 'COBROS_POR_VENCER',
      });
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.consultarReporte.consulta).toMatchObject({
        texto: null,
        atajo: 'COBROS_POR_VENCER',
        conjunto: 'COBROS',
      });
      expect(JSON.parse(ia.pedidos[0].cuerpo)).toEqual({
        atajo: 'COBROS_POR_VENCER',
        directorio: {
          clientes: [{ id: CLIENTE, nombre: 'Constructora Andina SRL' }],
        },
      });
      expect(keycloak.rutas).not.toContain(RUTA_CLIENTES);
    });

    it('505: una pregunta de aclaración llega con sus opciones y consulta null', async () => {
      iaResponde({ cuerpo: ACLARACION });
      const respuesta = await consultar(MUTACION, {
        texto: '¿Cuánto cemento se usó?',
      });
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.consultarReporte).toEqual(ACLARACION);
      expect(JSON.parse(ia.pedidos[0].cuerpo)).not.toHaveProperty(
        'conversacionId',
      );
    });

    it('505: reenvía el conversacionId para continuar la conversación', async () => {
      iaResponde({ cuerpo: conReporte() });
      const respuesta = await consultar(MUTACION, {
        texto: 'IP-30',
        conversacionId: CONVERSACION,
      });
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.consultarReporte).toMatchObject({
        conversacionId: CONVERSACION,
        tipo: 'REPORTE',
        aclaracion: null,
      });
      expect(respuesta.body.data.consultarReporte.consulta).not.toHaveProperty(
        'receta',
      );
      expect(ia.pedidos).toHaveLength(1);
      expect(JSON.parse(ia.pedidos[0].cuerpo)).toEqual({
        texto: 'IP-30',
        conversacionId: CONVERSACION,
        directorio: {
          clientes: [{ id: CLIENTE, nombre: 'Constructora Andina SRL' }],
        },
      });
    });

    it('505: CONVERSACION_NO_ENCONTRADA (404) llega en extensions.codigo con data null y no se reintenta', async () => {
      iaResponde({
        estado: 404,
        cuerpo: {
          title: 'La conversación no existe o expiró',
          status: 404,
          codigo: 'CONVERSACION_NO_ENCONTRADA',
        },
      });
      const respuesta = await consultar(MUTACION, {
        texto: 'sí',
        conversacionId: CONVERSACION,
      });
      expect(respuesta.body.data).toBeNull();
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'CONVERSACION_NO_ENCONTRADA',
        servicio: 'ia',
        estado: 404,
      });
      expect(ia.pedidos).toHaveLength(1);
    });

    it.each([
      ['texto y atajo a la vez', { texto: 'Cobros', atajo: 'COBROS_VENCIDOS' }],
      ['sin texto ni atajo', {}],
      ['solo conversacionId', { conversacionId: CONVERSACION }],
    ])(
      '%s: DATOS_INVALIDOS del gateway sin llamar a IA',
      async (_caso, variables) => {
        const respuesta = await consultar(MUTACION, variables);
        expect(respuesta.body.data).toBeNull();
        expect(respuesta.body.errors[0].extensions).toMatchObject({
          codigo: 'DATOS_INVALIDOS',
          servicio: 'gateway',
        });
        expect(ia.pedidos).toHaveLength(0);
      },
    );

    it('INTENCION_NO_RECONOCIDA llega en extensions.codigo con data null', async () => {
      iaResponde({
        estado: 422,
        cuerpo: {
          title: 'No encontré un reporte para tu pedido',
          status: 422,
          codigo: 'INTENCION_NO_RECONOCIDA',
        },
      });
      const respuesta = await consultar(MUTACION, {
        texto: '¿Qué tiempo hace?',
      });
      expect(respuesta.body.data).toBeNull();
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'INTENCION_NO_RECONOCIDA',
        servicio: 'ia',
        estado: 422,
      });
    });

    it('RECETA_INVALIDA llega con extensions.errores', async () => {
      const errores = [
        {
          campo: 'filtros[1].valor',
          mensaje: 'El periodo no puede ser futuro',
        },
      ];
      iaResponde({
        estado: 422,
        cuerpo: {
          title: 'No encontré un reporte para tu pedido',
          status: 422,
          codigo: 'RECETA_INVALIDA',
          errores,
        },
      });
      const respuesta = await consultar(MUTACION, {
        texto: 'Cobros del año que viene',
      });
      expect(respuesta.body.data).toBeNull();
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'RECETA_INVALIDA',
        servicio: 'ia',
        errores,
      });
    });

    it.each([
      [429, 'DEMASIADAS_CONSULTAS'],
      [503, 'LLM_NO_DISPONIBLE'],
      [504, 'TIEMPO_AGOTADO'],
    ])(
      '%i %s llega con su codigo y no se reintenta',
      async (estado, codigo) => {
        iaResponde({
          estado,
          cuerpo: { title: 'Error', status: estado, codigo },
        });
        const respuesta = await consultar(MUTACION, {
          texto: 'Cobros vencidos',
        });
        expect(respuesta.body.errors[0].extensions).toMatchObject({
          codigo,
          servicio: 'ia',
        });
        expect(ia.pedidos).toHaveLength(1);
      },
    );

    it('IA lenta (más de 3 s): espera hasta 60 s y el reporte llega, con un solo pedido', async () => {
      iaResponde({ cuerpo: conReporte(), esperaMs: 3500 });
      const respuesta = await consultar(MUTACION, { texto: CONSULTA.texto });
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.consultarReporte.consulta.id).toBe('r1');
      expect(ia.pedidos).toHaveLength(1);
    }, 15_000);

    it('un 5xx sin codigo de IA es ERROR_INTERNO (servicio ia) y no se reintenta', async () => {
      ia.responder = () => ({ estado: 502 });
      const respuesta = await consultar(MUTACION, { texto: 'Cobros vencidos' });
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'ERROR_INTERNO',
        servicio: 'ia',
      });
      expect(ia.pedidos).toHaveLength(1);
    });

    it.each(['residente', 'almacenero'])(
      '%s recibe SIN_PERMISO sin llamar a IA ni a Keycloak',
      async (rol) => {
        const respuesta = await consultar(MUTACION, { atajo: 'AVANCE_OBRAS' }, [
          rol,
        ]);
        expect(respuesta.body.errors[0].extensions.codigo).toBe('SIN_PERMISO');
        expect(ia.pedidos).toHaveLength(0);
      },
    );

    it('el esquema expone filas como [[String]!]! (contrato)', async () => {
      const respuesta = await consultar(`{
        __type(name: "ConsultaReporte") {
          fields { name type { kind ofType { kind ofType { kind ofType { kind name } } } } }
        }
      }`);
      const filas = respuesta.body.data.__type.fields.find(
        (campo: { name: string }) => campo.name === 'filas',
      );
      expect(filas.type).toEqual({
        kind: 'NON_NULL',
        ofType: {
          kind: 'LIST',
          ofType: {
            kind: 'NON_NULL',
            ofType: { kind: 'LIST', name: null },
          },
        },
      });
      const receta = respuesta.body.data.__type.fields.find(
        (campo: { name: string }) => campo.name === 'receta',
      );
      expect(receta).toBeUndefined();
    });

    it('505: el esquema expone RespuestaReporte, AclaracionReporte y la mutación con conversacionId (contrato)', async () => {
      const tipo =
        'name kind ofType { name kind ofType { name kind ofType { name kind } } }';
      const respuesta = await consultar(`{
        respuesta: __type(name: "RespuestaReporte") { fields { name type { ${tipo} } } }
        aclaracion: __type(name: "AclaracionReporte") { fields { name type { ${tipo} } } }
        tipoRespuesta: __type(name: "TipoRespuestaReporte") { enumValues { name } }
        mutaciones: __type(name: "Mutation") {
          fields { name args { name type { ${tipo} } } type { ${tipo} } }
        }
      }`);
      expect(respuesta.body.errors).toBeUndefined();
      const datos = respuesta.body.data;
      const campos = (lista: { name: string; type: TipoIntrospeccion }[]) =>
        Object.fromEntries(lista.map((c) => [c.name, comoSdl(c.type)]));

      expect(campos(datos.respuesta.fields)).toEqual({
        conversacionId: 'ID!',
        tipo: 'TipoRespuestaReporte!',
        consulta: 'ConsultaReporte',
        aclaracion: 'AclaracionReporte',
      });
      expect(campos(datos.aclaracion.fields)).toEqual({
        pregunta: 'String!',
        opciones: '[String!]!',
        preguntasRestantes: 'Int!',
      });
      expect(
        datos.tipoRespuesta.enumValues.map((v: { name: string }) => v.name),
      ).toEqual(['REPORTE', 'ACLARACION']);
      const mutacion = datos.mutaciones.fields.find(
        (campo: { name: string }) => campo.name === 'consultarReporte',
      );
      expect(comoSdl(mutacion.type)).toBe('RespuestaReporte!');
      expect(campos(mutacion.args)).toEqual({
        texto: 'String',
        atajo: 'AtajoReporte',
        conversacionId: 'ID',
      });
    });
  });
});
