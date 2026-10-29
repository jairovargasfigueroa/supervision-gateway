import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { VERIFICADOR_TOKEN } from '../src/comun/auth/verificador-token.js';
import { crearClavesPrueba } from './soporte/tokens-prueba.js';

const ID_OBRA = 'b0000000-0000-4000-8000-000000000101';
const ASIGNACIONES = {
  residenteId: 'a0000000-0000-4000-8000-000000000003',
  maestroId: 'a0000000-0000-4000-8000-000000000004',
  almaceneroId: 'a0000000-0000-4000-8000-000000000005',
  clienteId: 'a0000000-0000-4000-8000-000000000006',
};

const ENTRADA = {
  nombre: 'Edificio Las Palmas',
  ubicacion: 'Av. Banzer 4to anillo, Santa Cruz',
  fechaInicio: '2026-11-01',
  asignaciones: ASIGNACIONES,
  contrato: {
    monto: 357425,
    plazoDias: 300,
    anticipoPct: 10,
    retencionPct: 7,
    firmadoEn: '2026-10-20',
  },
  partidas: [
    {
      codigo: 'P-01',
      nombre: 'Losa de hormigón armado',
      unidad: 'm2',
      cantidadContratada: 850,
      precioUnitario: 420.5,
      meses: 'nov-dic',
      insumos: [{ materialId: 'm1', cantidadPorUnidad: 1.1 }],
    },
  ],
};

/** Respuesta de Obras: detalle de la obra recién registrada (contrato REST, GET /obras/{id}). */
const OBRA_REST = {
  id: ID_OBRA,
  nombre: ENTRADA.nombre,
  ubicacion: ENTRADA.ubicacion,
  estado: 'SIN_CONTRATO',
  motivoRechazoContrato: null,
  fechaInicio: ENTRADA.fechaInicio,
  asignaciones: ASIGNACIONES,
  contrato: {
    contratoId: null,
    monto: 357425,
    plazoDias: 300,
    anticipoPct: 10,
    retencionPct: 7,
  },
  avancePct: 0,
  plazoPct: 0,
  enRiesgo: false,
  partidas: [
    {
      id: 'p1',
      codigo: 'P-01',
      nombre: 'Losa de hormigón armado',
      unidad: 'm2',
      cantidadContratada: 850,
      precioUnitario: 420.5,
      meses: 'nov-dic',
      ejecutadaAcumulada: 0,
      avancePct: 0,
      insumos: [{ materialId: 'm1', cantidadPorUnidad: 1.1 }],
    },
  ],
};

const MUTACION = `mutation ($entrada: RegistrarObraEntrada!) {
  registrarObra(entrada: $entrada) {
    id estado motivoRechazoContrato
    contrato { contratoId monto plazoDias anticipoPct retencionPct }
    partidas { codigo cantidadContratada precioUnitario meses insumos { materialId cantidadPorUnidad } }
  }
}`;

interface Pedido {
  metodo: string;
  ruta: string;
  encabezados: IncomingHttpHeaders;
  cuerpo: string;
}

/** 002: registrarObra y obra(id) contra Obras y Keycloak simulados. */
describe('Registrar obra (e2e)', () => {
  let app: INestApplication;
  let obras: Server;
  let keycloak: Server;
  let pedidosObras: Pedido[];
  let pedidosKeycloak: string[];
  let responderObras: () => { estado: number; cuerpo: unknown };
  let keycloakFalla: boolean;
  let firmar: Awaited<ReturnType<typeof crearClavesPrueba>>['firmar'];

  const escuchar = async (servidor: Server) => {
    await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo));
    return `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  };

  beforeAll(async () => {
    obras = createServer((req, res) => {
      let cuerpo = '';
      req.on('data', (parte: Buffer) => (cuerpo += parte.toString()));
      req.on('end', () => {
        pedidosObras.push({
          metodo: req.method!,
          ruta: req.url!,
          encabezados: req.headers,
          cuerpo,
        });
        const { estado, cuerpo: respuesta } = responderObras();
        res.statusCode = estado;
        res.setHeader(
          'content-type',
          estado >= 400 ? 'application/problem+json' : 'application/json',
        );
        res.end(JSON.stringify(respuesta));
      });
    });
    keycloak = createServer((req, res) => {
      pedidosKeycloak.push(req.url!);
      res.setHeader('content-type', 'application/json');
      if (keycloakFalla) {
        res.statusCode = 500;
        res.end('{}');
      } else if (req.url!.endsWith('/protocol/openid-connect/token')) {
        res.end(
          JSON.stringify({ access_token: 'token-gateway', expires_in: 300 }),
        );
      } else {
        const id = req.url!.split('/').pop();
        res.end(
          JSON.stringify({
            id,
            firstName: 'Usuario',
            lastName: id!.slice(-1),
            email: `${id}@ejemplo.bo`,
          }),
        );
      }
    });
    process.env.OBRAS_URL = await escuchar(obras);
    process.env.KEYCLOAK_URL = await escuchar(keycloak);

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
    pedidosObras = [];
    pedidosKeycloak = [];
    keycloakFalla = false;
    responderObras = () => ({ estado: 201, cuerpo: OBRA_REST });
  });

  afterAll(async () => {
    await app.close();
    for (const servidor of [obras, keycloak]) {
      servidor.closeAllConnections();
      servidor.close();
    }
  });

  const enviar = async (
    query: string,
    variables: Record<string, unknown>,
    roles: string[],
  ) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set(
        'Authorization',
        `Bearer ${await firmar({ sub: 'a0000000-0000-4000-8000-000000000001', realm_access: { roles } })}`,
      )
      .set('X-Request-Id', 'req-002')
      .send({ query, variables });

  describe('registrarObra', () => {
    it('admin registra la obra: reenvía la entrada a POST /obras y devuelve la obra SIN_CONTRATO', async () => {
      const respuesta = await enviar(MUTACION, { entrada: ENTRADA }, ['admin']);

      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.registrarObra).toEqual({
        id: ID_OBRA,
        estado: 'SIN_CONTRATO',
        motivoRechazoContrato: null,
        contrato: OBRA_REST.contrato,
        partidas: [
          {
            codigo: 'P-01',
            cantidadContratada: 850,
            precioUnitario: 420.5,
            meses: 'nov-dic',
            insumos: [{ materialId: 'm1', cantidadPorUnidad: 1.1 }],
          },
        ],
      });
      expect(pedidosObras).toHaveLength(1);
      expect(pedidosObras[0]).toMatchObject({ metodo: 'POST', ruta: '/obras' });
      expect(JSON.parse(pedidosObras[0].cuerpo)).toEqual(ENTRADA);
      expect(pedidosObras[0].encabezados.authorization).toMatch(/^Bearer /);
      expect(pedidosObras[0].encabezados['x-request-id']).toBe('req-002');
    });

    it('acepta partidas sin insumos ni meses (la 003 todavía no da el catálogo)', async () => {
      const partida = {
        codigo: 'P-01',
        nombre: 'Losa',
        unidad: 'm2',
        cantidadContratada: 1,
        precioUnitario: 357425,
      };
      await enviar(MUTACION, { entrada: { ...ENTRADA, partidas: [partida] } }, [
        'admin',
      ]);
      expect(JSON.parse(pedidosObras[0].cuerpo).partidas).toEqual([partida]);
    });

    it('422 PRESUPUESTO_NO_COINCIDE de Obras llega en extensions.codigo, con data null y sin reintento', async () => {
      responderObras = () => ({
        estado: 422,
        cuerpo: {
          title: 'El presupuesto no coincide con el monto del contrato',
          status: 422,
          detail: 'Presupuesto 357425.00, monto 400000.00',
          codigo: 'PRESUPUESTO_NO_COINCIDE',
        },
      });
      const respuesta = await enviar(MUTACION, { entrada: ENTRADA }, ['admin']);

      expect(respuesta.body.data).toBeNull();
      expect(respuesta.body.errors).toHaveLength(1);
      expect(respuesta.body.errors[0].path).toEqual(['registrarObra']);
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'PRESUPUESTO_NO_COINCIDE',
        servicio: 'obras',
        estado: 422,
      });
      expect(pedidosObras).toHaveLength(1);
    });

    it.each([
      'CODIGO_PARTIDA_REPETIDO',
      'INSUMO_REPETIDO',
      'CONTRATO_INVALIDO',
    ])('422 %s llega con su codigo y los errores por campo', async (codigo) => {
      const errores = [{ campo: 'partidas[1].codigo', mensaje: 'Revisar' }];
      responderObras = () => ({
        estado: 422,
        cuerpo: { title: 'Regla', status: 422, codigo, errores },
      });
      const respuesta = await enviar(MUTACION, { entrada: ENTRADA }, ['admin']);
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo,
        servicio: 'obras',
        estado: 422,
        errores,
      });
    });

    it('un 500 de Obras no se reintenta (es una mutación)', async () => {
      responderObras = () => ({
        estado: 500,
        cuerpo: { title: 'Error', status: 500, codigo: 'ERROR_INTERNO' },
      });
      const respuesta = await enviar(MUTACION, { entrada: ENTRADA }, ['admin']);
      expect(respuesta.body.errors[0].extensions.codigo).toBe('ERROR_INTERNO');
      expect(pedidosObras).toHaveLength(1);
    });

    it.each([['residente'], ['gerente']])(
      '%s recibe SIN_PERMISO (403) sin llamar a Obras',
      async (rol) => {
        const respuesta = await enviar(MUTACION, { entrada: ENTRADA }, [rol]);
        expect(respuesta.body.data).toBeNull();
        expect(respuesta.body.errors[0].extensions).toMatchObject({
          codigo: 'SIN_PERMISO',
          estado: 403,
        });
        expect(pedidosObras).toHaveLength(0);
      },
    );

    it('si Obras responde 403, también llega SIN_PERMISO', async () => {
      responderObras = () => ({
        estado: 403,
        cuerpo: { title: 'Prohibido', status: 403 },
      });
      const respuesta = await enviar(MUTACION, { entrada: ENTRADA }, ['admin']);
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'SIN_PERMISO',
        servicio: 'obras',
      });
    });
  });

  describe('obra(id)', () => {
    const CONSULTA = `query ($id: ID!) {
      obra(id: $id) {
        id nombre estado motivoRechazoContrato
        residente { id nombre correo } maestro { nombre } almacenero { nombre } cliente { nombre }
        contrato { contratoId monto }
        partidas { id codigo ejecutadaAcumulada avancePct }
      }
    }`;

    it('devuelve el detalle de Obras con las asignaciones resueltas en Keycloak', async () => {
      responderObras = () => ({
        estado: 200,
        cuerpo: {
          ...OBRA_REST,
          motivoRechazoContrato: 'El monto del contrato debe ser mayor a 0',
        },
      });
      const respuesta = await enviar(CONSULTA, { id: ID_OBRA }, ['admin']);

      expect(respuesta.body.errors).toBeUndefined();
      expect(pedidosObras[0]).toMatchObject({
        metodo: 'GET',
        ruta: `/obras/${ID_OBRA}`,
      });
      expect(respuesta.body.data.obra).toMatchObject({
        id: ID_OBRA,
        estado: 'SIN_CONTRATO',
        motivoRechazoContrato: 'El monto del contrato debe ser mayor a 0',
        residente: {
          id: ASIGNACIONES.residenteId,
          nombre: 'Usuario 3',
          correo: `${ASIGNACIONES.residenteId}@ejemplo.bo`,
        },
        maestro: { nombre: 'Usuario 4' },
        almacenero: { nombre: 'Usuario 5' },
        cliente: { nombre: 'Usuario 6' },
        contrato: { contratoId: null, monto: 357425 },
        partidas: [
          { id: 'p1', codigo: 'P-01', ejecutadaAcumulada: 0, avancePct: 0 },
        ],
      });
      expect(pedidosKeycloak).toContain(
        `/admin/realms/supervision/users/${ASIGNACIONES.residenteId}`,
      );
    });

    it('sin pedir asignaciones no llama a Keycloak', async () => {
      responderObras = () => ({ estado: 200, cuerpo: OBRA_REST });
      await enviar(
        'query ($id: ID!) { obra(id: $id) { id estado } }',
        { id: ID_OBRA },
        ['residente'],
      );
      expect(pedidosKeycloak).toEqual([]);
    });

    it('404 OBRA_NO_ENCONTRADA: obra vuelve null con el codigo en extensions', async () => {
      responderObras = () => ({
        estado: 404,
        cuerpo: {
          title: 'Obra no encontrada',
          status: 404,
          codigo: 'OBRA_NO_ENCONTRADA',
        },
      });
      const respuesta = await enviar(CONSULTA, { id: 'otra' }, ['residente']);
      expect(respuesta.body.data).toEqual({ obra: null });
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'OBRA_NO_ENCONTRADA',
        servicio: 'obras',
        estado: 404,
      });
    });

    it('si Keycloak falla, solo las asignaciones vuelven null y el resto de la obra llega', async () => {
      // Usuarios que no están en la caché de 5 minutos (las pruebas anteriores guardaron los de ASIGNACIONES)
      const otras = Object.fromEntries(
        Object.entries(ASIGNACIONES).map(([campo, id]) => [
          campo,
          id.replace('a0000000', 'a1111111'),
        ]),
      );
      responderObras = () => ({
        estado: 200,
        cuerpo: { ...OBRA_REST, asignaciones: otras },
      });
      keycloakFalla = true;
      const respuesta = await enviar(CONSULTA, { id: ID_OBRA }, ['admin']);
      expect(respuesta.body.data.obra).toMatchObject({
        id: ID_OBRA,
        residente: null,
        maestro: null,
        almacenero: null,
        cliente: null,
      });
      expect(
        respuesta.body.errors.map(
          (e: { extensions: { servicio: string } }) => e.extensions.servicio,
        ),
      ).toEqual(Array(4).fill('keycloak'));
    });

    it('maestro (desde la app) recibe SIN_PERMISO', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/graphql')
        .set(
          'Authorization',
          `Bearer ${await firmar({ sub: 'u', azp: 'app-obra', realm_access: { roles: ['maestro'] } })}`,
        )
        .send({ query: CONSULTA, variables: { id: ID_OBRA } });
      expect(respuesta.body.errors[0].extensions.codigo).toBe('SIN_PERMISO');
      expect(pedidosObras).toHaveLength(0);
    });
  });
});
