import 'reflect-metadata';

import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

function normalizeValidationMessage(message: string): string {
  const unknownFieldMatch = message.match(/^property (.+) should not exist$/);
  if (unknownFieldMatch) {
    return `不允许提交字段：${unknownFieldMatch[1]}`;
  }
  return message;
}

function collectValidationMessages(errors: ValidationError[]): string[] {
  const result: string[] = [];

  for (const item of errors) {
    if (item.constraints) {
      result.push(...Object.values(item.constraints).map(normalizeValidationMessage));
    }
    if (item.children && item.children.length > 0) {
      result.push(...collectValidationMessages(item.children));
    }
  }

  return result;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: true,
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const messages = collectValidationMessages(errors);
        return new BadRequestException({
          message: messages.length > 0 ? messages : ['请求参数校验失败'],
          errorCode: 'VALIDATION_FAILED'
        });
      }
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = Number(process.env.PORT ?? '4000');
  await app.listen(port);
}

bootstrap();
