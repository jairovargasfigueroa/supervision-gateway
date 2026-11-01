import type { GraphQLObjectType, GraphQLSchema } from 'graphql';

/**
 * Campos del contrato con una lista de listas cuyas listas internas no son nulas pero sus valores sí
 * (`[[String]!]!`): NestJS code-first solo sabe declarar `[[String]]!` o `[[String!]!]!`.
 */
export const LISTAS_INTERNAS_NO_NULAS: readonly [string, string][] = [
  ['ConsultaReporte', 'filas'], // 503
];

interface Envoltura {
  ofType: unknown;
  constructor: new (tipo: unknown) => unknown;
}

/** `GraphQLList` o `GraphQLNonNull`, sin `instanceof`: en las pruebas, NestJS y este archivo cargan copias distintas de `graphql`. */
const es = (tipo: unknown, clase: 'GraphQLList' | 'GraphQLNonNull') =>
  Object.prototype.toString.call(tipo) === `[object ${clase}]`;

/**
 * `transformSchema` del GraphQLModule: cambia `[[T]]!` por `[[T]!]!` en los campos indicados. Solo agrega un
 * `NonNull` a la lista interna (el resolver ya la devuelve siempre), así que el esquema sigue siendo válido. Usa las
 * clases del propio esquema para armar los tipos nuevos.
 */
export function listasInternasNoNulas(
  campos: readonly [string, string][] = LISTAS_INTERNAS_NO_NULAS,
): (esquema: GraphQLSchema) => GraphQLSchema {
  return (esquema) => {
    for (const [nombreTipo, nombreCampo] of campos) {
      const tipo = esquema.getType(nombreTipo);
      const campo =
        tipo && 'getFields' in tipo
          ? (tipo as GraphQLObjectType).getFields()[nombreCampo]
          : undefined;
      if (!campo) throw new Error(`No existe ${nombreTipo}.${nombreCampo}`);
      const exterior = campo.type as unknown as Envoltura;
      const lista = exterior.ofType as Envoltura;
      if (
        !es(exterior, 'GraphQLNonNull') ||
        !es(lista, 'GraphQLList') ||
        !es(lista.ofType, 'GraphQLList')
      )
        throw new Error(`${nombreTipo}.${nombreCampo} no es [[T]]!`);
      const NoNulo = exterior.constructor;
      const Lista = lista.constructor;
      campo.type = new NoNulo(
        new Lista(new NoNulo(lista.ofType)),
      ) as typeof campo.type;
    }
    return esquema;
  };
}
