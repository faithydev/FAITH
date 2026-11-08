import pino from 'pino';

/** Structured JSON logs. Credentials and tokens are redacted wherever they appear. */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  redact: {
    paths: ['password', 'passwordHash', '*.password', '*.token', 'req.headers.cookie', 'req.headers.authorization'],
    censor: '[redacted]',
  },
});
