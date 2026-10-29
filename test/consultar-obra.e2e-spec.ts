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
const ASIGNACIONES = {
  residenteId: 'a0000000-0000-4000-8000-000000000203',
  maestroId: 'a0000000-0000-4000-8000-000000000204',
  almaceneroId: 'a0000000-0000-4000-8000-000000000205',
  clienteId: 'a0000000-0000-4000-8000-000000000206',
};

const OBRA_REST = {
  id: ID_OBRA,
  nombre: 'Edificio Las Palmas',
  ubicacion: 'Av. Banzer 4to anillo, Santa Cruz',
  estado: 'EN_EJECUCION',
  motivoRechazoContrato: null,
  fechaInicio: '2026-11-01',
  asignaciones: ASIGNACIONES,
  contrato: {
    contratoId: 'c0000000-0000-4000-8000-000000000201',
    monto: 1250000,
    plazoDias: 300,
    anticipoPct: 10,
    retencionPct: 7,
  },
  avancePct: 32.5,
  plazoPct: 41,
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
      ejecutadaAcumulada: 300,
      avancePct: 35.29,
      insumos: [
        { materialId: 'm1', cantidadPorUnidad: 1.1 },
        { materialId: 'm2', cantidadPorUnidad: 8 },
      ],
    },
    {
      id: 'p2',
      codigo: 'P-02',
      nombre: 'Muro de ladrillo',
      unidad: 'm2',
      cantidadContratada: 400,
      precioUnitario: 180,
      meses: null,
      ejecutadaAcumulada: 0,
      avancePct: 0,
      insumos: [{ materialId: 'm1', cantidadPorUnidad: 0.3 }],
    },
  ],
};

const material = (id: string, codigo: string, nombre: string) => ({
  id,
  codigo,
  nombre,
  tipo: 'OTRO',
  unidad: 'u',
  unidadPlural: 'u',
  precioReferencial: 1,
  activo: true,
  atributos: [],
});
const CATALOGO = [
  material('m1', 'CEM-IP30', 'Cemento IP-30'),
  material('m2', 'ACE-12', 'Acero de 12 mm'),
];

/** Responde según la ruta (sin la consulta); lo que no está en el mapa responde 404. */
const porRuta =
  (mapa: Record<string, Respuesta>) =>
  ({ ruta }: { ruta: string }): Respuesta =>
    mapa[ruta.split('?')[0]] ?? { estado: 404 };

/** 006: obras y obra(id) completos contra Obras, Materiales, Finanzas y Keycloak simulados. */
describe('Consultar obra (e2e)', () => {
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
    obras.responder = porRuta({
      '/obras': { cuerpo: [] },
      [`/obras/${ID_OBRA}`]: { cuerpo: OBRA_REST },
    });
    materiales.responder = porRuta({
      '/materiales': {
        cuerpo: { items: CATALOGO, total: 2, pagina: 1, tamano: 100 },
      },
    });
  });

  afterAll(async () => {
    await app.close();
    for (const servicio of [obras, materiales, finanzas, keycloak])
      servicio.cerrar();
  });

  const consultar = async (
    query: string,
    variables: Record<string, unknown> = {},
    roles: string[] = ['admin'],
  ) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set(
        'Authorization',
        `Bearer ${await firmar({ sub: 'a0000000-0000-4000-8000-000000000001', realm_access: { roles } })}`,
      )
      .set('X-Request-Id', 'req-006')
      .send({ query, variables });

  describe('obras(estado, busqueda)', () => {
    it('pasa los filtros a GET /obras y devuelve los indicadores y la última planilla', async () => {
      const resumen = {
        id: ID_OBRA,
        nombre: OBRA_REST.nombre,
        ubicacion: OBRA_REST.ubicacion,
        estado: 'EN_EJECUCION',
        fechaInicio: '2026-11-01',
        avancePct: 20,
        plazoPct: 41,
        enRiesgo: true,
        ultimaPlanilla: { periodo: '2027-02', estado: 'APROBADA' },
      };
      obras.responder = () => ({ cuerpo: [resumen] });
      const respuesta = await consultar(
        `query ($estado: EstadoObra, $busqueda: String) {
          obras(estado: $estado, busqueda: $busqueda) {
            id nombre ubicacion estado fechaInicio avancePct plazoPct enRiesgo ultimaPlanilla { periodo estado }
          }
        }`,
        { estado: 'EN_EJECUCION', busqueda: 'Las Palmas' },
        ['residente'],
      );
      expect(respuesta.body.errors).toBeUndefined();
      expect(respuesta.body.data.obras).toEqual([resumen]);
      expect(obras.rutas).toEqual([
        '/obras?estado=EN_EJECUCION&busqueda=Las+Palmas',
      ]);
    });
  });

  describe('obra(id)', () => {
    it('devuelve encabezado, indicadores, contrato y partidas con el material de cada insumo', async () => {
      const respuesta = await consultar(
        `query ($id: ID!) {
          obra(id: $id) {
            id nombre ubicacion estado fechaInicio avancePct plazoPct enRiesgo
            contrato { contratoId monto plazoDias anticipoPct retencionPct }
            partidas {
              codigo nombre unidad cantidadContratada ejecutadaAcumulada avancePct precioUnitario
              insumos { materialId cantidadPorUnidad material { codigo nombre } }
            }
          }
        }`,
        { id: ID_OBRA },
      );
      expect(respuesta.body.errors).toBeUndefined();
      const obra = respuesta.body.data.obra;
      expect(obra).toMatchObject({
        id: ID_OBRA,
        estado: 'EN_EJECUCION',
        avancePct: 32.5,
        plazoPct: 41,
        enRiesgo: false,
        contrato: OBRA_REST.contrato,
      });
      expect(obra.partidas[0]).toMatchObject({
        codigo: 'P-01',
        ejecutadaAcumulada: 300,
        avancePct: 35.29,
        insumos: [
          {
            materialId: 'm1',
            material: { codigo: 'CEM-IP30', nombre: 'Cemento IP-30' },
          },
          {
            materialId: 'm2',
            material: { codigo: 'ACE-12', nombre: 'Acero de 12 mm' },
          },
        ],
      });
      expect(obra.partidas[1].insumos[0].material.codigo).toBe('CEM-IP30');
      // DataLoader de la petición: un solo pedido del catálogo para los tres insumos
      expect(materiales.rutas).toEqual(['/materiales?pagina=1&tamano=100']);
    });

    it('la misma obra pedida con dos alias se pide una sola vez a Obras', async () => {
      const respuesta = await consultar(
        `query ($id: ID!) { a: obra(id: $id) { id } b: obra(id: $id) { nombre } }`,
        { id: ID_OBRA },
      );
      expect(respuesta.body.data).toEqual({
        a: { id: ID_OBRA },
        b: { nombre: OBRA_REST.nombre },
      });
      expect(obras.rutas).toEqual([`/obras/${ID_OBRA}`]);
    });

    it('si Materiales falla, solo Insumo.material vuelve null y el resto de la obra llega', async () => {
      materiales.responder = () => ({ estado: 503 });
      const respuesta = await consultar(
        `query ($id: ID!) { obra(id: $id) { nombre partidas { codigo insumos { materialId material { nombre } } } } }`,
        { id: ID_OBRA },
      );
      expect(respuesta.body.data.obra.nombre).toBe(OBRA_REST.nombre);
      expect(respuesta.body.data.obra.partidas[0].insumos[0]).toEqual({
        materialId: 'm1',
        material: null,
      });
      expect(respuesta.body.errors[0].extensions).toMatchObject({
        codigo: 'SERVICIO_NO_DISPONIBLE',
        servicio: 'materiales',
      });
    });
  });
});
