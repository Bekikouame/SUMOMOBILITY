import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  // Configuration CORS 
  app.enableCors({
    origin: true, // En dev, autoriser toutes les origines
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Validation globale
  app.useGlobalPipes(new ValidationPipe({
     whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Swagger config
  const config = new DocumentBuilder()
    .setTitle('Sumo API')
    .setDescription('Documentation de l’API Sumo (Auth + Users)')
    .setVersion('1.0')
    .addBearerAuth() // pour ajouter le bouton Authorize avec JWT
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document); 

  await app.listen(3000, '0.0.0.0');
  console.log('Backend démarré sur ',await app.getUrl());
  console.log(`Swagger disponible sur ${await app.getUrl()}/api`);
}
bootstrap();
