import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICO = 'esPublico';

/** Marca una consulta que no exige token (solo `salud`). */
export const Publico = () => SetMetadata(ES_PUBLICO, true);
