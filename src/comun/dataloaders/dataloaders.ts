import DataLoader from 'dataloader';
import type { ContextoGraphql, PeticionGateway } from '../auth/contexto.js';

/**
 * DataLoaders de cada petición HTTP (docs/estructura.md): viven mientras dura la petición, así que la caché nunca
 * mezcla datos de dos usuarios. Se guardan junto a la petición (WeakMap: se liberan con ella).
 */
const cargadoresPorPeticion = new WeakMap<
  PeticionGateway,
  Map<string, DataLoader<unknown, unknown>>
>();

/**
 * El DataLoader `nombre` de esta petición; lo crea la primera vez con `cargar`. Todas las llamadas con la misma clave
 * dentro de la petición se resuelven con una sola llamada al servicio.
 */
export function cargador<K, V>(
  contexto: ContextoGraphql,
  nombre: string,
  cargar: DataLoader.BatchLoadFn<K, V>,
): DataLoader<K, V> {
  let cargadores = cargadoresPorPeticion.get(contexto.req);
  if (!cargadores) {
    cargadores = new Map();
    cargadoresPorPeticion.set(contexto.req, cargadores);
  }
  let encontrado = cargadores.get(nombre);
  if (!encontrado) {
    encontrado = new DataLoader<K, V>(cargar) as DataLoader<unknown, unknown>;
    cargadores.set(nombre, encontrado);
  }
  return encontrado as DataLoader<K, V>;
}

/**
 * Función de carga para servicios sin consulta por lote: pide cada clave por separado (en paralelo) y, si una falla,
 * solo esa clave recibe el error.
 */
export function cadaUno<K, V>(
  pedir: (clave: K) => Promise<V>,
): DataLoader.BatchLoadFn<K, V> {
  return (claves) =>
    Promise.all(
      claves.map((clave) =>
        pedir(clave).catch((error: unknown) =>
          error instanceof Error ? error : new Error(String(error)),
        ),
      ),
    );
}

/** Un valor que se pide una sola vez por petición (por ejemplo, el catálogo completo de materiales). */
export function unaVezPorPeticion<V>(
  contexto: ContextoGraphql,
  nombre: string,
  pedir: () => Promise<V>,
): Promise<V> {
  return cargador<'todo', V>(contexto, nombre, async (claves) => {
    const valor = await pedir();
    return claves.map(() => valor);
  }).load('todo');
}
