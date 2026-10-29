import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { createRemoteJWKSet } from 'jose';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { Limitador } from '../src/comun/auth/limitador.js';
import { VERIFICADOR_TOKEN, VerificadorToken } from '../src/comun/auth/verificador-token.js';
import { AUDIENCIA, crearClavesPrueba, EMISOR } from './soporte/tokens-prueba.js';

/** Convenciones, «Seguridad»: límites de consulta y de peticiones, encabezados y Keycloak caído. */
describe('Seguridad del gateway (e2e)', () => {
  async function crearApp(opciones: { verificador: VerificadorToken; limitador?: Limitador }) {
    let constructor = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(VERIFICADOR_TOKEN)
      .useValue(opciones.verificador);
    if (opciones.limitador) constructor = constructor.overrideProvider(Limitador).useValue(opciones.limitador);
    const app: INestApplication = (await constructor.compile()).createNestApplication();
    await app.init();
    return app;
  }

  it('envía los encabezados de seguridad', async () => {
    const app = await crearApp({ verificador: (await crearClavesPrueba()).verificador });
    const respuesta = await request(app.getHttpServer()).post('/graphql').send({ query: '{ salud }' });
    expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
    expect(respuesta.headers['referrer-policy']).toBe('no-referrer');
    await app.close();
  });

  it('rechaza una consulta más profunda que 8 con DATOS_INVALIDOS', async () => {
    const app = await crearApp({ verificador: (await crearClavesPrueba()).verificador });
    const profunda = `{ a: obras { ultimaPlanilla { periodo } } ${'__schema { types { fields { type { ofType { ofType { ofType { ofType { name } } } } } } } }'} }`;
    const respuesta = await request(app.getHttpServer()).post('/graphql').send({ query: profunda });
    expect(respuesta.body.errors[0].extensions.codigo).toBe('DATOS_INVALIDOS');
    await app.close();
  });

  it('pasado el límite por minuto responde DEMASIADAS_PETICIONES con Retry-After', async () => {
    const claves = await crearClavesPrueba();
    const app = await crearApp({ verificador: claves.verificador, limitador: new Limitador(2) });
    const token = await claves.firmar({ sub: 'u-limite', name: 'Prueba' });
    const consultar = () =>
      request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: '{ obras { id } }' });
    await consultar();
    await consultar();
    const respuesta = await consultar();
    expect(respuesta.body.errors[0].extensions.codigo).toBe('DEMASIADAS_PETICIONES');
    expect(Number(respuesta.headers['retry-after'])).toBeGreaterThan(0);
    await app.close();
  });

  it('si Keycloak no responde al pedir el JWKS responde SERVICIO_NO_DISPONIBLE y no NO_AUTENTICADO', async () => {
    const claves = await crearClavesPrueba();
    const sinKeycloak = new VerificadorToken(createRemoteJWKSet(new URL('http://127.0.0.1:1/certs')), EMISOR, AUDIENCIA);
    const app = await crearApp({ verificador: sinKeycloak });
    const respuesta = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${await claves.firmar({ sub: 'u1' })}`)
      .send({ query: '{ obras { id } }' });
    expect(respuesta.body.errors[0].extensions).toMatchObject({ codigo: 'SERVICIO_NO_DISPONIBLE', servicio: 'keycloak' });
    await app.close();
  });
});
