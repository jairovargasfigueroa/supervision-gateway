import {
  GraphQLList,
  GraphQLNonNull,
  isListType,
  isNonNullType,
  isObjectType,
  type GraphQLSchema,
} from 'graphql';

/**
 * Campos del contrato con una lista de listas cuyas listas internas no son nulas pero sus valores sí
 * (`[[String]!]!`): NestJS code-first solo sabe declarar `[[String]]!` o `[[String!]!]!`.
 */
export const LISTAS_INTERNAS_NO_NULAS: readonly [string, string][] = [
  ['ConsultaReporte', 'filas'], // 503
];

/**
 * `transformSchema` del GraphQLModule: cambia `[[T]]!` por `[[T]!]!` en los campos indicados. Solo agrega un
 * `NonNull` a la lista interna (el resolver ya la devuelve siempre), así que el esquema sigue siendo válido.
 */
export function listasInternasNoNulas(
  campos: readonly [string, string][] = LISTAS_INTERNAS_NO_NULAS,
): (esquema: GraphQLSchema) => GraphQLSchema {
  return (esquema) => {
    for (const [nombreTipo, nombreCampo] of campos) {
      const tipo = esquema.getType(nombreTipo);
      const campo = isObjectType(tipo)
        ? tipo.getFields()[nombreCampo]
        : undefined;
      if (!campo) throw new Error(`No existe ${nombreTipo}.${nombreCampo}`);
      const externa = isNonNullType(campo.type)
        ? campo.type.ofType
        : campo.type;
      if (!isListType(externa) || !isListType(externa.ofType))
        throw new Error(
          `${nombreTipo}.${nombreCampo} no es una lista de listas`,
        );
      const lista = new GraphQLList(new GraphQLNonNull(externa.ofType));
      campo.type = isNonNullType(campo.type)
        ? new GraphQLNonNull(lista)
        : lista;
    }
    return esquema;
  };
}
