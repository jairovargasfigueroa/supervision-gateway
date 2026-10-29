import { generateKeyPair } from 'jose';
import { crearClavesPrueba } from '../../../test/soporte/tokens-prueba.js';

describe('VerificadorToken', () => {
  const datosResidente = {
    sub: 'a0000000-0000-4000-8000-000000000003',
    name: 'Daniela Roca Justiniano',
    realm_access: { roles: ['residente'] },
  };

  it('acepta un token válido y devuelve el usuario', async () => {
    const { verificador, firmar } = await crearClavesPrueba();
    await expect(verificador.verificar(await firmar(datosResidente))).resolves.toEqual({
      id: 'a0000000-0000-4000-8000-000000000003',
      nombre: 'Daniela Roca Justiniano',
      roles: ['residente'],
      azp: 'erp',
    });
  });

  it('rechaza un emisor distinto', async () => {
    const { verificador, firmar } = await crearClavesPrueba();
    const token = await firmar({ ...datosResidente, iss: 'http://localhost:8080/realms/otro' });
    await expect(verificador.verificar(token)).rejects.toThrow();
  });

  it('rechaza un token sin la audiencia plataforma-api', async () => {
    const { verificador, firmar } = await crearClavesPrueba();
    await expect(verificador.verificar(await firmar({ ...datosResidente, aud: 'account' }))).rejects.toThrow();
  });

  it('rechaza un token vencido', async () => {
    const { verificador, firmar } = await crearClavesPrueba();
    const token = await firmar(datosResidente, { vence: Math.floor(Date.now() / 1000) - 60 });
    await expect(verificador.verificar(token)).rejects.toThrow();
  });

  it('rechaza un token firmado con otra clave', async () => {
    const { verificador, firmar } = await crearClavesPrueba();
    const { privateKey } = await generateKeyPair('RS256');
    await expect(verificador.verificar(await firmar(datosResidente, { clave: privateKey }))).rejects.toThrow();
  });
});
