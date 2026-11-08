import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

/** Roles del realm (contrato: enum Rol). Mismos valores que en Keycloak. */
export enum RolUsuario {
  admin = 'admin',
  residente = 'residente',
  gerente = 'gerente',
  maestro = 'maestro',
  almacenero = 'almacenero',
  cliente = 'cliente',
}
registerEnumType(RolUsuario, { name: 'Rol' });

/** Usuario de Keycloak: nombre = nombre + apellido; correo = email. */
@ObjectType()
export class Usuario {
  @Field(() => ID)
  id: string;

  @Field()
  nombre: string;

  @Field(() => String, { nullable: true })
  correo: string | null;
}
