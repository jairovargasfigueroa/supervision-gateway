import { Query, Resolver } from '@nestjs/graphql';

// Consulta técnica para comprobar que el gateway responde; no es del negocio
@Resolver()
export class SaludResolver {
  @Query(() => String)
  salud(): string {
    return 'ok';
  }
}
