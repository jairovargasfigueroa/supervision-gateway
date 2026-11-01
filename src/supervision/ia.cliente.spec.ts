import type { ContextoGraphql } from '../comun/auth/contexto.js';
import type { ClienteServicio } from '../comun/http/cliente-servicio.js';
import { IaCliente } from './ia.cliente.js';
import { EstadoRevision } from './modelos/consumo-atipico.modelo.js';
import { AtajoReporte } from './modelos/reporte.modelo.js';

const contexto = {
  req: { requestId: 'req-1', token: 't' },
} as unknown as ContextoGraphql;

function crear() {
  const servicio = {
    consultar: vi.fn().mockResolvedValue([]),
    enviar: vi.fn().mockResolvedValue({ id: 'mov-1' }),
  };
  return {
    servicio,
    ia: new IaCliente(servicio as unknown as ClienteServicio),
  };
}

describe('IaCliente', () => {
  it('predicciones pide GET /predicciones con los ids separados por coma y escapados', async () => {
    const { servicio, ia } = crear();
    await ia.predicciones(['o1', 'a/b'], contexto);
    expect(servicio.consultar).toHaveBeenCalledWith(
      'ia',
      '/predicciones?obraIds=o1,a%2Fb',
      contexto,
    );
  });

  it('prediccionObra pide GET /obras/{id}/prediccion con el historial', async () => {
    const { servicio, ia } = crear();
    await ia.prediccionObra('a/b', 30, contexto);
    expect(servicio.consultar).toHaveBeenCalledWith(
      'ia',
      '/obras/a%2Fb/prediccion?historial=30',
      contexto,
    );
  });

  it('consumosAtipicos pide GET /consumos-atipicos con la obra y, si viene, el estado', async () => {
    const { servicio, ia } = crear();
    await ia.consumosAtipicos({ obraId: 'a/b' }, contexto);
    expect(servicio.consultar).toHaveBeenLastCalledWith(
      'ia',
      '/consumos-atipicos?obraId=a%2Fb',
      contexto,
    );
    await ia.consumosAtipicos(
      { obraId: 'o1', estado: EstadoRevision.NORMAL },
      contexto,
    );
    expect(servicio.consultar).toHaveBeenLastCalledWith(
      'ia',
      '/consumos-atipicos?obraId=o1&estado=NORMAL',
      contexto,
    );
  });

  it('resumenAtipicos pide GET /consumos-atipicos/resumen con los ids separados por coma', async () => {
    const { servicio, ia } = crear();
    await ia.resumenAtipicos(['o1', 'a/b'], contexto);
    expect(servicio.consultar).toHaveBeenCalledWith(
      'ia',
      '/consumos-atipicos/resumen?obraIds=o1,a%2Fb',
      contexto,
    );
  });

  it('revisarConsumoAtipico envía PUT /consumos-atipicos/{id}/revision (sin reintento: enviar)', async () => {
    const { servicio, ia } = crear();
    const revision = {
      estado: EstadoRevision.CONFIRMADO,
      comentario: 'Se usó en otra obra',
    };
    await ia.revisarConsumoAtipico('a/b', revision, contexto);
    expect(servicio.enviar).toHaveBeenCalledWith(
      'ia',
      'PUT',
      '/consumos-atipicos/a%2Fb/revision',
      revision,
      contexto,
    );
    expect(servicio.consultar).not.toHaveBeenCalled();
  });

  it('modeloRiesgo pide GET /modelos/riesgo-retraso', async () => {
    const { servicio, ia } = crear();
    await ia.modeloRiesgo(contexto);
    expect(servicio.consultar).toHaveBeenCalledWith(
      'ia',
      '/modelos/riesgo-retraso',
      contexto,
    );
  });

  it('catalogoReportes pide GET /catalogo-reportes', async () => {
    const { servicio, ia } = crear();
    await ia.catalogoReportes(contexto);
    expect(servicio.consultar).toHaveBeenCalledWith(
      'ia',
      '/catalogo-reportes',
      contexto,
    );
  });

  it('consultasReporte pide GET /consultas-reporte con el límite solo si viene', async () => {
    const { servicio, ia } = crear();
    await ia.consultasReporte(undefined, contexto);
    expect(servicio.consultar).toHaveBeenLastCalledWith(
      'ia',
      '/consultas-reporte',
      contexto,
    );
    await ia.consultasReporte(5, contexto);
    expect(servicio.consultar).toHaveBeenLastCalledWith(
      'ia',
      '/consultas-reporte?limite=5',
      contexto,
    );
  });

  it('consultarReporte envía POST /consultas-reporte con 60 s y sin reintento (enviar)', async () => {
    const { servicio, ia } = crear();
    const pedido = {
      atajo: AtajoReporte.COBROS_POR_VENCER,
      directorio: { clientes: [{ id: 'c1', nombre: 'Constructora Andina' }] },
    };
    await ia.consultarReporte(pedido, contexto);
    expect(servicio.enviar).toHaveBeenCalledWith(
      'ia',
      'POST',
      '/consultas-reporte',
      pedido,
      contexto,
      { tiempoMaximoMs: 60_000 },
    );
    expect(servicio.consultar).not.toHaveBeenCalled();
  });

  describe('502: agentes', () => {
    it('agentes pide GET /agentes', async () => {
      const { servicio, ia } = crear();
      await ia.agentes(contexto);
      expect(servicio.consultar).toHaveBeenCalledWith(
        'ia',
        '/agentes',
        contexto,
      );
    });

    it('ejecutarAgente envía POST /agentes/{agente}/ejecuciones sin cuerpo (sin reintento: enviar)', async () => {
      const { servicio, ia } = crear();
      await ia.ejecutarAgente('CONTROL_COBROS', contexto);
      expect(servicio.enviar).toHaveBeenCalledWith(
        'ia',
        'POST',
        '/agentes/CONTROL_COBROS/ejecuciones',
        undefined,
        contexto,
      );
      expect(servicio.consultar).not.toHaveBeenCalled();
    });

    it('ejecuciones, hallazgos y sugerencias envían solo los filtros que vienen', async () => {
      const { servicio, ia } = crear();
      await ia.ejecuciones({}, contexto);
      expect(servicio.consultar).toHaveBeenLastCalledWith(
        'ia',
        '/ejecuciones',
        contexto,
      );
      await ia.ejecuciones(
        { agente: 'CONTROL_MATERIALES', estado: null, limite: 5 },
        contexto,
      );
      expect(servicio.consultar).toHaveBeenLastCalledWith(
        'ia',
        '/ejecuciones?agente=CONTROL_MATERIALES&limite=5',
        contexto,
      );
      await ia.hallazgos({ obraId: 'a/b', agente: undefined }, contexto);
      expect(servicio.consultar).toHaveBeenLastCalledWith(
        'ia',
        '/hallazgos?obraId=a%2Fb',
        contexto,
      );
      await ia.sugerencias(
        {
          estado: 'PENDIENTE',
          agente: 'SEGUIMIENTO_OBRAS',
          obraId: 'o1',
          limite: 10,
        },
        contexto,
      );
      expect(servicio.consultar).toHaveBeenLastCalledWith(
        'ia',
        '/sugerencias?estado=PENDIENTE&agente=SEGUIMIENTO_OBRAS&obraId=o1&limite=10',
        contexto,
      );
    });

    it('ejecucion pide GET /ejecuciones/{id} con el id escapado', async () => {
      const { servicio, ia } = crear();
      await ia.ejecucion('a/b', contexto);
      expect(servicio.consultar).toHaveBeenCalledWith(
        'ia',
        '/ejecuciones/a%2Fb',
        contexto,
      );
    });

    it('aprobarSugerencia envía el comentario solo si viene; rechazarSugerencia envía el motivo (sin reintento)', async () => {
      const { servicio, ia } = crear();
      await ia.aprobarSugerencia('s1', undefined, contexto);
      expect(servicio.enviar).toHaveBeenLastCalledWith(
        'ia',
        'POST',
        '/sugerencias/s1/aprobar',
        {},
        contexto,
      );
      await ia.aprobarSugerencia('s1', 'Se programó', contexto);
      expect(servicio.enviar).toHaveBeenLastCalledWith(
        'ia',
        'POST',
        '/sugerencias/s1/aprobar',
        { comentario: 'Se programó' },
        contexto,
      );
      await ia.rechazarSugerencia(
        'a/b',
        'No corresponde a esta obra',
        contexto,
      );
      expect(servicio.enviar).toHaveBeenLastCalledWith(
        'ia',
        'POST',
        '/sugerencias/a%2Fb/rechazar',
        { motivo: 'No corresponde a esta obra' },
        contexto,
      );
      expect(servicio.consultar).not.toHaveBeenCalled();
    });
  });

  describe('502: Obra.hallazgos y Obra.sugerencias (DataLoader de la petición)', () => {
    const peticion = () =>
      ({
        req: { requestId: 'req-2', token: 't' },
      }) as unknown as ContextoGraphql;

    it('la misma obra con el mismo filtro se pide una sola vez; con otro filtro, aparte', async () => {
      const { servicio, ia } = crear();
      const contextoPeticion = peticion();
      await Promise.all([
        ia.hallazgosDeObra('o1', 'CONTROL_COBROS', contextoPeticion),
        ia.hallazgosDeObra('o1', 'CONTROL_COBROS', contextoPeticion),
        ia.hallazgosDeObra('o1', undefined, contextoPeticion),
        ia.sugerenciasDeObra('o1', 'PENDIENTE', contextoPeticion),
        ia.sugerenciasDeObra('o2', 'PENDIENTE', contextoPeticion),
      ]);
      expect(
        servicio.consultar.mock.calls
          .map(([, ruta]) => String(ruta))
          .sort((a, b) => a.localeCompare(b)),
      ).toEqual([
        '/hallazgos?obraId=o1',
        '/hallazgos?obraId=o1&agente=CONTROL_COBROS',
        '/sugerencias?obraId=o1&estado=PENDIENTE',
        '/sugerencias?obraId=o2&estado=PENDIENTE',
      ]);
    });

    it('si una obra falla, solo esa recibe el error', async () => {
      const { servicio, ia } = crear();
      servicio.consultar.mockImplementation((_s: string, ruta: string) =>
        ruta.includes('o2')
          ? Promise.reject(new Error('IA no responde'))
          : Promise.resolve([]),
      );
      const contextoPeticion = peticion();
      const [uno, dos] = await Promise.allSettled([
        ia.sugerenciasDeObra('o1', null, contextoPeticion),
        ia.sugerenciasDeObra('o2', null, contextoPeticion),
      ]);
      expect(uno).toEqual({ status: 'fulfilled', value: [] });
      expect(dos.status).toBe('rejected');
    });
  });
});
