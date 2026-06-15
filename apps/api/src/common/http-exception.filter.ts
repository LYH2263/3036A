import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { Request, Response } from 'express';
import { formatStandardDateTime } from './time.util';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message = '服务器内部错误';
    let code = 'INTERNAL_ERROR';

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      'message' in exceptionResponse
    ) {
      const rawMessage = (exceptionResponse as { message: string | string[] }).message;
      message = Array.isArray(rawMessage) ? rawMessage.join('; ') : rawMessage;
      code =
        ((exceptionResponse as { errorCode?: string }).errorCode ??
          (exceptionResponse as { error?: string }).error ??
          code)
          .toString()
          .toUpperCase()
          .replace(/\s+/g, '_');
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      path: request.url,
      timestamp: formatStandardDateTime(new Date())
    });
  }
}
