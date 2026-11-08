import { GraphQLError } from 'graphql';

export type Servicio = 'obras' | 'materiales' | 'finanzas' | 'ia';

/** Código genérico de cada estado HTTP cuando el servicio no manda uno propio (convenciones, «Errores REST»). */
const CODIGO_POR_ESTADO: Record<number, string> = {
  400: 'DATOS_INVALIDOS',
  401: 'NO_AUTENTICADO',
  403: 'SIN_PERMISO',
  413: 'ARCHIVO_DEMASIADO_GRANDE',
  429: 'DEMASIADAS_PETICIONES',
  500: 'ERROR_INTERNO',
  503: 'SERVICIO_NO_DISPONIBLE',
  504: 'TIEMPO_AGOTADO',
};

interface ProblemDetails {
  title?: string;
  detail?: string;
  codigo?: string;
  errores?: { campo: string; mensaje: string }[];
}

/** Convierte una respuesta de error (Problem Details) del servicio en un error GraphQL con extensions.codigo. */
export async function errorDesdeRespuesta(
  respuesta: Response,
  servicio: Servicio,
): Promise<GraphQLError> {
  let problema: ProblemDetails = {};
  if (respuesta.headers.get('content-type')?.includes('json')) {
    try {
      problema = (await respuesta.json()) as ProblemDetails;
    } catch {
      // Cuerpo que no es JSON válido: se usa el código genérico del estado
    }
  }
  const codigo =
    problema.codigo ??
    CODIGO_POR_ESTADO[respuesta.status] ??
    (respuesta.status >= 500 ? 'ERROR_INTERNO' : 'DATOS_INVALIDOS');
  return new GraphQLError(problema.title ?? `Error en ${servicio}`, {
    extensions: {
      codigo,
      servicio,
      estado: respuesta.status,
      ...(problema.errores ? { errores: problema.errores } : {}),
    },
  });
}

/** El servicio no respondió (caído o más lento que el tiempo máximo): solo sus campos vuelven en null. */
export function servicioNoDisponible(
  servicio: Servicio | 'keycloak',
): GraphQLError {
  return new GraphQLError(`${servicio} no está disponible`, {
    extensions: { codigo: 'SERVICIO_NO_DISPONIBLE', servicio, estado: 503 },
  });
}
