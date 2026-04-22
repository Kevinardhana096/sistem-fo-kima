import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // Enable CORS for frontend

  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? '127.0.0.1';

  await app.listen(port, host);

  console.log(`Backend ready at http://${host}:${port}`);
}
void bootstrap();
