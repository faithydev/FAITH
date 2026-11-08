import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { logger } from './logger';

/** Domain error. `code` is stable and the web app translates it into each language. */
export class AppError extends HttpException {
  constructor(status: number, public readonly code: string, public readonly details?: unknown) {
    super(code, status);
  }
}

export const badRequest = (code: string, details?: unknown) => new AppError(400, code, details);
export const unauthorized = (code = 'UNAUTHENTICATED') => new AppError(401, code);
export const forbidden = (code = 'FORBIDDEN') => new AppError(403, code);
export const notFound = (code = 'NOT_FOUND') => new AppError(404, code);
export const conflict = (code: string, details?: unknown) => new AppError(409, code, details);
export const tooMany = (code = 'RATE_LIMITED') => new AppError(429, code);

const statusCodes: Record<number, string> = {
  400: 'BAD_REQUEST', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED', 409: 'CONFLICT', 413: 'PAYLOAD_TOO_LARGE', 415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'VALIDATION', 429: 'RATE_LIMITED',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL';
    let details: unknown;

    if (exception instanceof AppError) {
      status = exception.getStatus();
      code = exception.code;
      details = exception.details;
    } else if (exception instanceof ZodError) {
      status = 422;
      code = 'VALIDATION';
      details = exception.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = statusCodes[status] ?? 'HTTP_ERROR';
    } else if (isPrismaCode(exception, 'P2002')) {
      status = 409;
      code = 'ALREADY_EXISTS';
    } else if (isPrismaCode(exception, 'P2025')) {
      status = 404;
      code = 'NOT_FOUND';
    }

    if (status >= 500) {
      logger.error({ err: exception, path: req.path, requestId }, 'unhandled error');
    }
    res.status(status).json({ error: { code, details, requestId } });
  }
}

function isPrismaCode(e: unknown, code: string): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === code;
}
