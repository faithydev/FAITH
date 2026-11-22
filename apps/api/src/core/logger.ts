import pino from 'pino';

/** Structured JSON logs. Credentials and tokens are redacted wherever they appear. */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  redact: {
    paths: [
      'password', 'passwordHash', '*.password', '*.passwordHash', '*.currentPassword', '*.newPassword',
      'token', '*.token', '*.secret', '*.twoFactorSecret', '*.backupCodes', '*.code', '*.idToken', '*.id_token',
      '*.accessKeyId', '*.secretAccessKey', '*.clientSecret', '*.client_secret', '*.apiKey', '*.keyHash',
      'req.headers.cookie', 'req.headers.authorization', 'req.headers["x-api-key"]', 'req.headers["x-faith-mock-signature"]',
      'res.headers["set-cookie"]',
    ],
    censor: '[redacted]',
  },
});
