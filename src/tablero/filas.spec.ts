import {
  EstadoObra,
  EstadoPlanilla,
  type ObraResumen,
} from '../obras/modelos/obra-resumen.modelo.js';
import { filaTablero } from './filas.js';

const obra = (avancePct: number, plazoPct: number): ObraResumen => ({
  id: 'o1',
  nombre: 'Edificio Las Palmas',
  ubicacion: 'Santa Cruz',
  estado: EstadoObra.EN_EJECUCION,
  fechaInicio: '2026-11-01',
  avancePct,
  plazoPct,
  enRiesgo: true,
  ultimaPlanilla: { periodo: '2027-02', estado: EstadoPlanilla.APROBADA },
});

describe('filaTablero', () => {
  it('copia los datos de la obra y calcula diferencia = plazo − avance', () => {
    expect(filaTablero(obra(32.5, 41))).toEqual({
      obraId: 'o1',
      nombre: 'Edificio Las Palmas',
      avancePct: 32.5,
      plazoPct: 41,
      diferencia: 8.5,
      enRiesgo: true,
      ultimaPlanilla: { periodo: '2027-02', estado: 'APROBADA' },
    });
  });

  it('calcula en centésimas, sin errores de coma flotante', () => {
    // 41.1 - 32.3 en coma flotante da 8.800000000000004
    expect(filaTablero(obra(32.3, 41.1)).diferencia).toBe(8.8);
  });

  it('es negativa si el avance va por delante del plazo', () => {
    expect(filaTablero(obra(50.25, 40)).diferencia).toBe(-10.25);
  });

  it('sin planillas, ultimaPlanilla es null', () => {
    const sinPlanillas = obra(0, 0);
    sinPlanillas.ultimaPlanilla = null;
    expect(filaTablero(sinPlanillas).ultimaPlanilla).toBeNull();
  });
});
