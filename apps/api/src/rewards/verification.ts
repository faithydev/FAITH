import type { VerificationAvailability } from '@faith/database';

export type MetricReading = { metric: 'VIEWS' | 'CLICKS' | 'LEADS' | 'SALES'; value: bigint };

/**
 * One adapter per social platform. An adapter says honestly what it can verify today. Nothing
 * here scrapes or guesses: until official API access exists for a creator's account, the
 * platform reports that a human has to check the number.
 */
export interface SocialVerificationAdapter {
  readonly platform: string;
  availability(): VerificationAvailability;
  /** What the creator or reviewer should be told about this platform. */
  note(): string;
  fetchMetrics?(url: string, accessToken: string): Promise<MetricReading[]>;
}

class ManualAdapter implements SocialVerificationAdapter {
  constructor(readonly platform: string, private readonly state: VerificationAvailability, private readonly text: string) {}
  availability() {
    return this.state;
  }
  note() {
    return this.text;
  }
}

/**
 * YouTube, TikTok and Instagram all expose per-video numbers only through official APIs, and
 * mostly only with the creator's own authorization. FAITH holds no such credentials yet, so
 * these report that and metrics are recorded by a reviewer.
 */
export const verificationAdapters: Record<string, SocialVerificationAdapter> = {
  youtube: new ManualAdapter('youtube', 'ACCOUNT_AUTH_REQUIRED', 'Automated counts need the creator to authorise FAITH through Google. Until that integration exists, a reviewer records them.'),
  tiktok: new ManualAdapter('tiktok', 'ACCOUNT_AUTH_REQUIRED', 'Automated counts need the creator to authorise FAITH through TikTok. Until that integration exists, a reviewer records them.'),
  instagram: new ManualAdapter('instagram', 'ACCOUNT_AUTH_REQUIRED', 'Automated counts need a connected professional account. Until that integration exists, a reviewer records them.'),
  other: new ManualAdapter('other', 'MANUAL_REVIEW', 'This platform has no adapter. Metrics are reviewed by hand from the evidence supplied.'),
};

export const adapterFor = (platform: string) => verificationAdapters[platform] ?? verificationAdapters.other!;

/** Same content, different tracking noise: these all become one canonical URL. */
export function normalizeContentUrl(raw: string): string {
  const u = new URL(raw.trim());
  u.protocol = 'https:';
  u.hash = '';
  u.hostname = u.hostname.toLowerCase().replace(/^(www|m|mobile|vm)\./, '');
  if (u.hostname === 'youtu.be') {
    const id = u.pathname.slice(1);
    u.hostname = 'youtube.com';
    u.pathname = '/watch';
    u.search = `?v=${id}`;
  } else if (u.hostname === 'youtube.com' && u.pathname.startsWith('/shorts/')) {
    const id = u.pathname.split('/')[2];
    u.pathname = '/watch';
    u.search = `?v=${id}`;
  } else if (u.hostname === 'youtube.com' && u.searchParams.get('v')) {
    u.search = `?v=${u.searchParams.get('v')}`;
  } else {
    u.search = '';
  }
  u.pathname = u.pathname.replace(/\/+$/, '') || '/';
  return u.toString();
}
