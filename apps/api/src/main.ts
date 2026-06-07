import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, context, stack }) => {
    const ctx = context ? ` [${context}]` : '';
    const err = stack ? `\n${stack}` : '';
    return `${timestamp} ${level.toUpperCase().padEnd(5)}${ctx} ${message}${err}`;
  }),
);

const winstonLogger = WinstonModule.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        logFormat,
      ),
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'api.log'),
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
      tailable: true,
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'api-error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
      tailable: true,
    }),
  ],
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: winstonLogger });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:5173';
  app.enableCors({ origin: webOrigin.split(','), credentials: true });

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port);
  winstonLogger.log(`API Perseus rodando em http://localhost:${port}/api`, 'Bootstrap');
  winstonLogger.log(`Logs em: ${logsDir}`, 'Bootstrap');
}

bootstrap();
