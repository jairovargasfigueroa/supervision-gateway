import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Solo los orígenes del ERP (convenciones, «Seguridad»); nunca "*"
  const origenes = (process.env.CORS_ORIGENES ?? '')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean);
  app.enableCors({ origin: origenes, exposedHeaders: ['X-Request-Id'] });
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
