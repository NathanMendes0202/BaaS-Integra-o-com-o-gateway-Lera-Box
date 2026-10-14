import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:5173').split(','),
    exposedHeaders: ['x-correlation-id'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('API BaaS - Integração com gateway Lera Box')
      .setDescription(
        'Checkout Pix e cartão, carteira, saques, webhooks e conciliação. Valores monetários em centavos.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(config.get<string>('PORT', '3000'));
  await app.listen(port);
  new Logger('Bootstrap').log(`API em http://localhost:${port}/api  |  Swagger em /api/docs`);
}

bootstrap();
