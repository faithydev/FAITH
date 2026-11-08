#!/usr/bin/env node
/** Development helper: logs in a seeded account and writes a Playwright storage state. */
const [email, out] = process.argv.slice(2);
const res = await fetch('http://localhost:4000/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'FaithDemo2026!' }) });
if (!res.ok) throw new Error(`login failed ${res.status}`);
const value = /faith_session=([^;]+)/.exec(res.headers.get('set-cookie'))[1];
const { writeFileSync } = await import('node:fs');
writeFileSync(out, JSON.stringify({ cookies: [{ name: 'faith_session', value, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax', expires: Math.floor(Date.now() / 1000) + 86400 }], origins: [] }));
