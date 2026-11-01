import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

// Tipos de la 503 (docs/contratos.md): mismos nombres que el JSON del servicio de IA.

export enum ConjuntoReporte {
  OBRAS = 'OBRAS',
  CONSUMO_MATERIAL = 'CONSUMO_MATERIAL',
  MOVIMIENTOS = 'MOVIMIENTOS',
  COBROS = 'COBROS',
  PLANILLAS = 'PLANILLAS',
  CONSUMOS_ATIPICOS = 'CONSUMOS_ATIPICOS',
}
registerEnumType(ConjuntoReporte, { name: 'ConjuntoReporte' });

/** Reportes comunes (atajos con receta fija, sin modelo de lenguaje para entender el pedido). */
export enum AtajoReporte {
  AVANCE_OBRAS = 'AVANCE_OBRAS',
  OBRAS_EN_RIESGO = 'OBRAS_EN_RIESGO',
  CONSUMO_MATERIAL_MES = 'CONSUMO_MATERIAL_MES',
  SALIDAS_SIN_STOCK = 'SALIDAS_SIN_STOCK',
  COBROS_VENCIDOS = 'COBROS_VENCIDOS',
  COBROS_POR_VENCER = 'COBROS_POR_VENCER',
  COBRADO_POR_OBRA = 'COBRADO_POR_OBRA',
  PLANILLAS_OBSERVADAS = 'PLANILLAS_OBSERVADAS',
  PLANILLAS_APROBADAS = 'PLANILLAS_APROBADAS',
  CONSUMOS_ATIPICOS_PENDIENTES = 'CONSUMOS_ATIPICOS_PENDIENTES',
}
registerEnumType(AtajoReporte, { name: 'AtajoReporte' });

export enum TipoColumna {
  TEXTO = 'TEXTO',
  NUMERO = 'NUMERO',
  MONTO = 'MONTO',
  PORCENTAJE = 'PORCENTAJE',
  FECHA = 'FECHA',
  BOOLEANO = 'BOOLEANO',
}
registerEnumType(TipoColumna, { name: 'TipoColumna' });

export enum ResultadoConsultaReporte {
  OK = 'OK',
  NO_RECONOCIDA = 'NO_RECONOCIDA',
  RECETA_INVALIDA = 'RECETA_INVALIDA',
  ERROR = 'ERROR',
}
registerEnumType(ResultadoConsultaReporte, {
  name: 'ResultadoConsultaReporte',
});

@ObjectType()
export class ColumnaReporte {
  @Field()
  clave: string;

  /** Encabezado en español. */
  @Field()
  titulo: string;

  @Field(() => TipoColumna)
  tipo: TipoColumna;
}

/** Lo que se aplicó (filtros, agrupación, métricas, orden), en texto para la persona. */
@ObjectType()
export class ElementoAplicado {
  @Field()
  nombre: string;

  @Field()
  valor: string;
}

/**
 * Resultado de `POST /consultas-reporte` (503). IA manda también la `receta`, que no se expone por GraphQL (la persona
 * ve `aplicado`).
 */
@ObjectType()
export class ConsultaReporte {
  @Field(() => ID)
  id: string;

  @Field(() => String, { nullable: true })
  texto: string | null;

  @Field(() => AtajoReporte, { nullable: true })
  atajo: AtajoReporte | null;

  @Field(() => ConjuntoReporte)
  conjunto: ConjuntoReporte;

  @Field()
  tituloConjunto: string;

  @Field(() => [ElementoAplicado])
  aplicado: ElementoAplicado[];

  @Field()
  resumen: string;

  /** true si el resumen es el de plantilla (el modelo falló o tardó). */
  @Field()
  resumenPlantilla: boolean;

  @Field(() => [String])
  avisos: string[];

  @Field(() => [ColumnaReporte])
  columnas: ColumnaReporte[];

  /**
   * Hasta 100 filas, con los valores como texto (null = sin dato). El SDL del contrato es `[[String]!]!`: NestJS no
   * puede declarar la lista interna como no nula con valores nulos, así que lo ajusta `listasInternasNoNulas`
   * (comun/graphql) al armar el esquema.
   */
  @Field(() => [[String]], { nullable: 'items' })
  filas: (string | null)[][];

  @Field(() => Int)
  totalFilas: number;

  /** true si había más de 100 filas («Se muestran las primeras 100 filas»). */
  @Field()
  truncado: boolean;

  @Field()
  creadaEn: string;
}

/** Una consulta del historial del usuario (`GET /consultas-reporte`, 503). */
@ObjectType()
export class ConsultaReporteCorta {
  @Field(() => ID)
  id: string;

  @Field(() => String, { nullable: true })
  texto: string | null;

  @Field(() => AtajoReporte, { nullable: true })
  atajo: AtajoReporte | null;

  /** null si no se reconoció. */
  @Field(() => ConjuntoReporte, { nullable: true })
  conjunto: ConjuntoReporte | null;

  @Field(() => ResultadoConsultaReporte)
  resultado: ResultadoConsultaReporte;

  @Field(() => String, { nullable: true })
  resumen: string | null;

  @Field(() => Int, { nullable: true })
  totalFilas: number | null;

  @Field()
  creadaEn: string;
}

/** Un conjunto del catálogo en modo REST (`GET /catalogo-reportes`, 503). */
@ObjectType()
export class ConjuntoDisponible {
  @Field(() => ConjuntoReporte)
  conjunto: ConjuntoReporte;

  @Field()
  titulo: string;

  @Field()
  descripcion: string;

  @Field(() => [ColumnaReporte])
  columnas: ColumnaReporte[];

  @Field(() => [String])
  filtros: string[];

  @Field(() => [String])
  agrupaciones: string[];

  @Field(() => [String])
  ejemplos: string[];
}

@ObjectType()
export class AtajoDisponible {
  @Field(() => AtajoReporte)
  atajo: AtajoReporte;

  @Field()
  titulo: string;

  @Field()
  descripcion: string;
}

@ObjectType()
export class CatalogoReportes {
  @Field(() => [ConjuntoDisponible])
  conjuntos: ConjuntoDisponible[];

  @Field(() => [AtajoDisponible])
  atajos: AtajoDisponible[];
}
