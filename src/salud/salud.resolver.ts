import { Query, Resolver } from '@nestjs/graphql';
import { Publico } from '../comun/auth/publico.decorator.js';

// Consulta técnica para comprobar que el gateway responde; no es del negocio. No exige token (convenciones)
@Resolver()
export class SaludResolver {
  @Publico()
  @Query(() => String)
  salud(): string {
    return 'ok';
  }
}
