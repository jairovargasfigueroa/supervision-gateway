import {
  GraphQLError,
  Kind,
  type ASTVisitor,
  type FragmentDefinitionNode,
  type SelectionSetNode,
  type ValidationContext,
  type ValidationRule,
} from 'graphql';

// Convenciones, «Seguridad»: profundidad máxima 8 y complejidad máxima 1000 por consulta.
export const PROFUNDIDAD_MAXIMA = 8;
export const COMPLEJIDAD_MAXIMA = 1000;

interface Medida {
  profundidad: number;
  campos: number;
}

/** Mide la profundidad y la cantidad de campos de una selección, entrando en los fragmentos. */
function medir(
  seleccion: SelectionSetNode,
  fragmentos: Record<string, FragmentDefinitionNode>,
  visitados: Set<string>,
): Medida {
  let profundidad = 0;
  let campos = 0;
  for (const nodo of seleccion.selections) {
    if (nodo.kind === Kind.FIELD) {
      campos += 1;
      if (nodo.selectionSet) {
        const hija = medir(nodo.selectionSet, fragmentos, visitados);
        profundidad = Math.max(profundidad, hija.profundidad + 1);
        campos += hija.campos;
      } else {
        profundidad = Math.max(profundidad, 1);
      }
    } else {
      const conjunto =
        nodo.kind === Kind.INLINE_FRAGMENT
          ? nodo.selectionSet
          : visitados.has(nodo.name.value)
            ? undefined
            : fragmentos[nodo.name.value]?.selectionSet;
      if (nodo.kind === Kind.FRAGMENT_SPREAD) visitados.add(nodo.name.value);
      if (conjunto) {
        const hija = medir(conjunto, fragmentos, visitados);
        profundidad = Math.max(profundidad, hija.profundidad);
        campos += hija.campos;
      }
    }
  }
  return { profundidad, campos };
}

function demasiado(mensaje: string): GraphQLError {
  return new GraphQLError(mensaje, { extensions: { codigo: 'DATOS_INVALIDOS', servicio: 'gateway', estado: 400 } });
}

/** Regla de validación de GraphQL que rechaza consultas demasiado profundas o con demasiados campos. */
export function limitarConsultas(
  profundidadMaxima = PROFUNDIDAD_MAXIMA,
  complejidadMaxima = COMPLEJIDAD_MAXIMA,
): ValidationRule {
  return (contexto: ValidationContext): ASTVisitor => {
    const fragmentos: Record<string, FragmentDefinitionNode> = {};
    for (const definicion of contexto.getDocument().definitions) {
      if (definicion.kind === Kind.FRAGMENT_DEFINITION) fragmentos[definicion.name.value] = definicion;
    }
    return {
      OperationDefinition(operacion) {
        const { profundidad, campos } = medir(operacion.selectionSet, fragmentos, new Set());
        if (profundidad > profundidadMaxima) {
          contexto.reportError(demasiado(`La consulta pasa la profundidad máxima (${profundidadMaxima}).`));
        }
        if (campos > complejidadMaxima) {
          contexto.reportError(demasiado(`La consulta pasa la complejidad máxima (${complejidadMaxima}).`));
        }
      },
    };
  };
}
