import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('Gateway (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('responde la consulta salud', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ salud }' })
      .expect(200)
      .expect({ data: { salud: 'ok' } });
  });

  afterEach(async () => {
    await app.close();
  });
});
