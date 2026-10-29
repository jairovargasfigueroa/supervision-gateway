import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { VERIFICADOR_TOKEN } from '../src/comun/auth/verificador-token.js';
import { crearClavesPrueba } from './soporte/tokens-prueba.js';

const ID_OBRA = 'b0000000-0000-4000-8000-000000000101';

const MATERIAL_REST = {
  id: 'c0000000-0000-4000-8000-000000000001',
  codigo: 'CEM-IP30',
  nombre: 'Cemento IP-30',
  tipo: 'CEMENTO',
  unidad: 'bolsa',
  unidadPlural: 'bolsas',
  precioReferencial: 62,
  activo: true,
  atributos: [{ nombre: 'peso', valor: '50 kg' }],
};

const STOCK_REST = [
  {
    materialId: MATERIAL_REST.id,
    codigo: 'CEM-IP30',
    nombre: 'Cemento IP-30',
    unidad: 'bolsa',
    unidadPlural: 'bolsas',
    cantidad: 120,
    minimo: 100,
    estado: 'JUSTO',
  },
  {
    materialId: 'c0000000-0000-4000-8000-000000000002',
    codigo: 'ACE-12',
    nombre: 'Fierro corrugado 12 mm',
    unidad: 'barra',
    unidadPlural: 'barras',
    cantidad: 0,
    minimo: 50,
    estado: 'BAJO',
  },
];

const ENTRADA = {
  codigo: 'cem-ip30',
  nombre: 'Cemento IP-30',
  tipo: 'CEMENTO',
  unidad: 'bolsa',
  unidadPlural: 'bolsas',
  precioReferencial: 62,
  atributos: [{ nombre: 'peso', valor: '50 kg' }],
};

const CAMPOS_MATERIAL = 'id codigo nombre tipo unidad unidadPlural precioReferencial activo atributos { nombre valor }';
const CAMPOS_STOCK = 'materialId codigo nombre unidad unidadPlural cantidad minimo estado';

const CONSULTA_MATERIALES = `query ($busqueda: String, $soloActivos: Boolean, $pagina: Int, $tamano: Int) {
  materiales(busqueda: $busqueda, soloActivos: $soloActivos, pagina: $pagina, tamano: $tamano) {
    items { ${CAMPOS_MATERIAL} } total pagina tamano
  }
}`;
const CONSULTA_STOCK = `query ($obraId: ID!) { stockObra(obraId: $obraId) { ${CAMPOS_STOCK} } }`;
const CREAR = `mutation ($entrada: MaterialEntrada!) { crearMaterial(entrada: $entrada) { ${CAMPOS_MATERIAL} } }`;
const ACTUALIZAR = `mutation ($id: ID!, $entrada: MaterialEntrada!) {
  actualizarMaterial(id: $id, entrada: $entrada) { ${CAMPOS_MATERIAL} }
}`;
const DEFINIR_MINIMO = `mutation ($obraId: ID!, $materialId: ID!, $minimo: Float!) {
  definirStockMinimo(obraId: $obraId, materialId: $materialId, minimo: $minimo) { ${CAMPOS_STOCK} }
}`;

interface Pedido {
  metodo: string;
  ruta: string;
  encabezados: IncomingHttpHeaders;
  cuerpo: string;
}

/** 003: consultas y mutaciones de materiales contra un servicio Materiales simulado. */
describe('Materiales (e2e)', () => {
  let app: INestApplication;
  let materiales: Server;
  let pedidos: Pedido[];
  let responder: (pedido: Pedido) => { estado: number; cuerpo: unknown; esperaMs?: number };
  let firmar: Awaited<ReturnType<typeof crearClavesPrueba>>['firmar'];

  const escuchar = async (servidor: Server) => {
    await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo));
    return `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  };

  beforeAll(async () => {
    materiales = createServer((req, res) => {
      let cuerpo = '';
      req.on('data', (parte: Buffer) => (cuerpo += parte.toString()));
      req.on('end', () => {
        const pedido = { metodo: req.method!, ruta: req.url!, encabezados: req.headers, cuerpo };
        pedidos.push(pedido);
        const { estado, cuerpo: respuesta, esperaMs = 0 } = responder(pedido);
        setTimeout(() => {
          if (res.destroyed) return;
          res.statusCode = estado;
          res.setHeader('content-type', estado >= 400 ? 'application/problem+json' : 'application/json');
          res.end(JSON.stringify(respuesta));
        }, esperaMs);
      });
    });
    process.env.MATERIALES_URL = await escuchar(materiales);

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
    pedidos = [];
    responder = () => ({ estado: 200, cuerpo: {} });
  });

  afterAll(async () => {
    await app.close();
    materiales.closeAllConnections();
    materiales.close();
  });

  const enviar = async (query: string, variables: Record<string, unknown>, roles: string[]) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set(
        'Authorization',
        `Bearer ${await firmar({ sub: 'a0000000-0000-4000-8000-000000000001', realm_access: { roles } })}`,
      )
      .set('X-Request-Id', 'req-003')
      .send({ query, variables });

  describe('materiales', () => {
    it('devuelve la página de Materiales y reenvía filtros, token y X-Request-Id', async () => {
      responder = () => ({ estado: 200, cuerpo: { items: [MATERIAL_REST], total: 1, pagina: 1, tamano: 20 } });
      const respuesta = await enviar(CONSULTA_MATERIALES, { busqueda: 'cem', soloActivos: true }, ['residente']);

      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.materiales).toEqual({ items: [MATERIAL_REST], total: 1, pagina: 1, tamano: 20 });
      expect(pedidos).toHaveLength(1);
      expect(pedidos[0]).toMatchObject({
        metodo: 'GET',
        ruta: '/materiales?busqueda=cem&soloActivos=true&pagina=1&tamano=20',
      });
      expect(pedidos[0].encabezados.authorization).toMatch(/^Bearer /);
      expect(pedidos[0].encabezados['x-request-id']).toBe('req-003');
    });

    it('pasa la página y el tamaño pedidos', async () => {
      responder = () => ({ estado: 200, cuerpo: { items: [], total: 41, pagina: 3, tamano: 10 } });
      const respuesta = await enviar(CONSULTA_MATERIALES, { pagina: 3, tamano: 10 }, ['gerente']);
      expect(respuesta.body.data.materiales).toMatchObject({ total: 41, pagina: 3, tamano: 10 });
      expect(pedidos[0].ruta).toBe('/materiales?pagina=3&tamano=10');
    });

    it('400 PAGINACION_INVALIDA de Materiales llega en extensions.codigo', async () => {
      responder = () => ({
        estado: 400,
        cuerpo: { title: 'Paginación inválida', status: 400, codigo: 'PAGINACION_INVALIDA' },
      });
      const respuesta = await enviar(CONSULTA_MATERIALES, { tamano: 500 }, ['admin']);
      expect(respuesta.body.data).toBeNull();
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'PAGINACION_INVALIDA',
        servicio: 'materiales',
      });
    });

    it('si Materiales no responde, llega SERVICIO_NO_DISPONIBLE después de reintentar una vez', async () => {
      responder = () => ({ estado: 503, cuerpo: { title: 'Caído', status: 503 } });
      const respuesta = await enviar(CONSULTA_MATERIALES, {}, ['admin']);
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'SERVICIO_NO_DISPONIBLE',
        servicio: 'materiales',
      });
      expect(pedidos).toHaveLength(2);
    });

    it.each([['maestro'], ['almacenero']])('%s desde el ERP recibe SIN_PERMISO sin llamar a Materiales', async (rol) => {
      const respuesta = await enviar(CONSULTA_MATERIALES, {}, [rol]);
      expect(respuesta.body.errors[0].extensions).toMatchObject({ codigo: 'SIN_PERMISO', estado: 403 });
      expect(pedidos).toHaveLength(0);
    });
  });

  describe('stockObra', () => {
    it('devuelve las filas de stock con su estado', async () => {
      responder = () => ({ estado: 200, cuerpo: STOCK_REST });
      const respuesta = await enviar(CONSULTA_STOCK, { obraId: ID_OBRA }, ['residente']);
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.stockObra).toEqual(STOCK_REST);
      expect(pedidos[0]).toMatchObject({ metodo: 'GET', ruta: `/obras/${ID_OBRA}/stock` });
    });

    it('404 OBRA_NO_ENCONTRADA (obra que el residente no ve) llega con su codigo', async () => {
      responder = () => ({
        estado: 404,
        cuerpo: { title: 'Obra no encontrada', status: 404, codigo: 'OBRA_NO_ENCONTRADA' },
      });
      const respuesta = await enviar(CONSULTA_STOCK, { obraId: 'otra' }, ['residente']);
      expect(respuesta.body.data).toBeNull();
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'OBRA_NO_ENCONTRADA',
        servicio: 'materiales',
        estado: 404,
      });
    });

    it('si Materiales tarda más de 3 s, llega SERVICIO_NO_DISPONIBLE', async () => {
      responder = () => ({ estado: 200, cuerpo: STOCK_REST, esperaMs: 3500 });
      const respuesta = await enviar(CONSULTA_STOCK, { obraId: ID_OBRA }, ['admin']);
      expect(respuesta.body.errors[0].extensions.codigo).toBe('SERVICIO_NO_DISPONIBLE');
    }, 15000);
  });

  describe('crearMaterial', () => {
    it('admin crea: reenvía la entrada a POST /materiales y devuelve el material', async () => {
      responder = () => ({ estado: 201, cuerpo: MATERIAL_REST });
      const respuesta = await enviar(CREAR, { entrada: ENTRADA }, ['admin']);

      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.crearMaterial).toEqual(MATERIAL_REST);
      expect(pedidos).toHaveLength(1);
      expect(pedidos[0]).toMatchObject({ metodo: 'POST', ruta: '/materiales' });
      expect(JSON.parse(pedidos[0].cuerpo)).toEqual(ENTRADA);
    });

    it('409 CODIGO_MATERIAL_REPETIDO llega en extensions.codigo, con data null y sin reintento', async () => {
      responder = () => ({
        estado: 409,
        cuerpo: {
          title: 'Ya existe un material con el código CEM-IP30',
          status: 409,
          codigo: 'CODIGO_MATERIAL_REPETIDO',
        },
      });
      const respuesta = await enviar(CREAR, { entrada: ENTRADA }, ['admin']);

      expect(respuesta.body.data).toBeNull();
      expect(respuesta.body.errors[0].path).toEqual(['crearMaterial']);
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'CODIGO_MATERIAL_REPETIDO',
        servicio: 'materiales',
        estado: 409,
      });
      expect(pedidos).toHaveLength(1);
    });

    it('un 500 de Materiales no se reintenta (es una mutación)', async () => {
      responder = () => ({ estado: 500, cuerpo: { title: 'Error', status: 500, codigo: 'ERROR_INTERNO' } });
      const respuesta = await enviar(CREAR, { entrada: ENTRADA }, ['admin']);
      expect(respuesta.body.errors[0].extensions.codigo).toBe('ERROR_INTERNO');
      expect(pedidos).toHaveLength(1);
    });

    it('un tipo fuera del enum lo rechaza GraphQL sin llamar a Materiales', async () => {
      const respuesta = await enviar(CREAR, { entrada: { ...ENTRADA, tipo: 'VIDRIO' } }, ['admin']);
      expect(respuesta.body.errors).toHaveLength(1);
      expect(pedidos).toHaveLength(0);
    });
  });

  describe('actualizarMaterial', () => {
    it('admin desactiva: PUT /materiales/{id} con el material completo', async () => {
      responder = () => ({ estado: 200, cuerpo: { ...MATERIAL_REST, activo: false } });
      const entrada = { ...ENTRADA, codigo: 'CEM-IP30', activo: false };
      const respuesta = await enviar(ACTUALIZAR, { id: MATERIAL_REST.id, entrada }, ['admin']);

      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.actualizarMaterial.activo).toBe(false);
      expect(pedidos[0]).toMatchObject({ metodo: 'PUT', ruta: `/materiales/${MATERIAL_REST.id}` });
      expect(JSON.parse(pedidos[0].cuerpo)).toEqual(entrada);
    });

    it.each([
      [404, 'MATERIAL_NO_ENCONTRADO'],
      [409, 'CODIGO_MATERIAL_REPETIDO'],
    ])('%i %s llega con su codigo', async (estado, codigo) => {
      responder = () => ({ estado, cuerpo: { title: 'Error', status: estado, codigo } });
      const respuesta = await enviar(ACTUALIZAR, { id: 'x', entrada: ENTRADA }, ['admin']);
      expect(respuesta.body.errors[0].extensions).toMatchObject({ codigo, servicio: 'materiales', estado });
    });
  });

  describe('definirStockMinimo', () => {
    it('admin fija el mínimo: PUT .../stock/{materialId}/minimo con { minimo } y devuelve la fila', async () => {
      const fila = { ...STOCK_REST[1], minimo: 40 };
      responder = () => ({ estado: 200, cuerpo: fila });
      const respuesta = await enviar(
        DEFINIR_MINIMO,
        { obraId: ID_OBRA, materialId: fila.materialId, minimo: 40 },
        ['admin'],
      );

      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.definirStockMinimo).toEqual(fila);
      expect(pedidos[0]).toMatchObject({
        metodo: 'PUT',
        ruta: `/obras/${ID_OBRA}/stock/${fila.materialId}/minimo`,
      });
      expect(JSON.parse(pedidos[0].cuerpo)).toEqual({ minimo: 40 });
    });

    it.each([
      [422, 'MATERIAL_INACTIVO'],
      [404, 'OBRA_NO_ENCONTRADA'],
      [404, 'MATERIAL_NO_ENCONTRADO'],
    ])('%i %s llega con su codigo', async (estado, codigo) => {
      responder = () => ({ estado, cuerpo: { title: 'Error', status: estado, codigo } });
      const respuesta = await enviar(DEFINIR_MINIMO, { obraId: ID_OBRA, materialId: 'm', minimo: 1 }, ['admin']);
      expect(respuesta.body.errors[0].extensions).toMatchObject({ codigo, servicio: 'materiales', estado });
    });
  });

  describe('SIN_PERMISO en mutaciones para quien no es admin', () => {
    const MUTACIONES: [string, string, Record<string, unknown>][] = [
      ['crearMaterial', CREAR, { entrada: ENTRADA }],
      ['actualizarMaterial', ACTUALIZAR, { id: 'x', entrada: ENTRADA }],
      ['definirStockMinimo', DEFINIR_MINIMO, { obraId: ID_OBRA, materialId: 'm', minimo: 1 }],
    ];

    for (const rol of ['residente', 'gerente']) {
      it.each(MUTACIONES)(`${rol} en %s recibe SIN_PERMISO (403) sin llamar a Materiales`, async (_, query, vars) => {
        const respuesta = await enviar(query, vars, [rol]);
        expect(respuesta.body.data).toBeNull();
        expect(respuesta.body.errors[0].extensions).toMatchObject({ codigo: 'SIN_PERMISO', estado: 403 });
        expect(pedidos).toHaveLength(0);
      });
    }
  });
});
