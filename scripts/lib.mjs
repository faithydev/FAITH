/** Small helpers shared by the local bootstrap, dev and start scripts. */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { resolve } from 'node:path';

export const root = resolve(import.meta.dirname, '..');
const envPath = resolve(root, '.env');

/** Creates .env from .env.example on first run, filling every secret with fresh random bytes. */
export function ensureEnv() {
  if (existsSync(envPath)) return false;
  copyFileSync(resolve(root, '.env.example'), envPath);
  const secrets = ['APP_ENCRYPTION_KEY', 'SESSION_COOKIE_SECRET', 'DOWNLOAD_SIGNING_SECRET', 'MOCK_PAYMENT_WEBHOOK_SECRET'];
  let text = readFileSync(envPath, 'utf8');
  for (const name of secrets) {
    text = text.replace(new RegExp(`^${name}=.*$`, 'm'), `${name}=${randomBytes(32).toString('base64')}`);
  }
  writeFileSync(envPath, text);
  return true;
}

export function readEnv() {
  const env = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

export function run(command, options = {}) {
  console.log(`\n[faith] ${command}`);
  const result = spawnSync(command, { cwd: root, stdio: 'inherit', shell: true, ...options });
  if (result.status !== 0) {
    console.error(`[faith] Failed: ${command}`);
    process.exit(result.status ?? 1);
  }
}

export function portOpen(port, host = '127.0.0.1') {
  return new Promise((done) => {
    const socket = createConnection({ port, host });
    socket.setTimeout(800);
    socket.once('connect', () => { socket.destroy(); done(true); });
    socket.once('timeout', () => { socket.destroy(); done(false); });
    socket.once('error', () => done(false));
  });
}

export async function waitForPort(port, label, seconds = 60) {
  for (let i = 0; i < seconds * 4; i++) {
    if (await portOpen(port)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${label} did not open port ${port} within ${seconds}s`);
}

/** Starts the embedded server unless DATABASE_URL already answers. Returns the child, or null. */
export async function ensureDatabase(env) {
  const url = new URL(env.DATABASE_URL);
  const port = Number(url.port || 5432);
  if (await portOpen(port, url.hostname)) return null;
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error(`DATABASE_URL points at ${url.hostname}:${port}, which is not reachable.`);
  }
  const child = spawn(process.execPath, ['scripts/dev-db.mjs'], {
    cwd: root, stdio: 'inherit', env: { ...process.env, FAITH_PG_PORT: String(port) },
  });
  await waitForPort(port, 'PostgreSQL', 90);
  return child;
}

/**
 * The web app caches public API answers for up to a minute. After the database is rebuilt those
 * answers point at rows that no longer exist, so the cache goes with the old data.
 */
export function clearWebDataCache() {
  rmSync(resolve(root, 'apps/web/.next/cache/fetch-cache'), { recursive: true, force: true });
}

const palette = { api: 36, web: 35, worker: 33 };

/** Runs a long-lived service and prefixes each output line with its name. */
export function service(name, command, env) {
  const child = spawn(command, { cwd: root, shell: true, env: { ...process.env, ...env } });
  const prefix = `\x1b[${palette[name] ?? 37}m${name.padEnd(6)}\x1b[0m`;
  const pipe = (stream, out) => {
    let tail = '';
    stream.on('data', (chunk) => {
      const lines = (tail + chunk).split(/\r?\n/);
      tail = lines.pop();
      for (const line of lines) out.write(`${prefix} ${line}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  return child;
}

/** Stops every child, including process trees on Windows, when this process is interrupted. */
export function stopOnExit(children) {
  const stop = () => {
    for (const child of children.filter(Boolean)) {
      if (child.exitCode !== null) continue;
      if (process.platform === 'win32') spawnSync(`taskkill /pid ${child.pid} /T /F`, { shell: true, stdio: 'ignore' });
      else child.kill('SIGTERM');
    }
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
