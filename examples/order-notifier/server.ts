/**
 * Sample FAITH app. Receives `order.paid` webhooks, verifies them, and prints a running total of
 * the orders it fetches through the API. It runs outside the FAITH backend, as every third-party
 * app must: plugin code is never executed inside the platform.
 */
import { createServer } from 'node:http';
import { FaithClient, verifyWebhook } from '@faith/sdk';

export function createNotifier(opts: { apiKey: string; webhookSecret: string; baseUrl?: string; log?: (m: string) => void }) {
  const faith = new FaithClient({ apiKey: opts.apiKey, baseUrl: opts.baseUrl });
  const log = opts.log ?? console.log;
  const seen = new Set<string>();

  return createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/webhooks/faith') {
      res.writeHead(404).end();
      return;
    }
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const event = verifyWebhook<{ number: string; totalMinor: string; currency: string }>({
          body,
          signature: req.headers['x-faith-signature'] as string | undefined,
          timestamp: req.headers['x-faith-timestamp'] as string | undefined,
          secret: opts.webhookSecret,
        });
        res.writeHead(200).end('ok');
        // Deliveries can repeat, so handlers must be idempotent.
        if (seen.has(event.id)) return;
        seen.add(event.id);
        log(`Sold ${event.data.number} for ${event.data.totalMinor} ${event.data.currency}`);
        void faith.orders().then((o) => log(`Orders visible to this key: ${o.items.length}`));
      } catch (err) {
        res.writeHead(400).end((err as Error).message);
      }
    });
  });
}

if (process.argv[1]?.endsWith('server.ts')) {
  const { FAITH_API_KEY, FAITH_WEBHOOK_SECRET, FAITH_API_URL } = process.env;
  if (!FAITH_API_KEY || !FAITH_WEBHOOK_SECRET) throw new Error('Set FAITH_API_KEY and FAITH_WEBHOOK_SECRET');
  createNotifier({ apiKey: FAITH_API_KEY, webhookSecret: FAITH_WEBHOOK_SECRET, baseUrl: FAITH_API_URL })
    .listen(4100, () => console.log('Order notifier on http://localhost:4100'));
}
