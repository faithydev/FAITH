import { Badge } from '@/components/ui/primitives';
import { Link } from '@/i18n/navigation';

export type CreatorRow = { userId: string; headline: string; niches: string[]; user: { profile: { displayName: string; username: string; bio: string | null; country: string | null } | null } };

export function CreatorCard({ c }: { c: CreatorRow }) {
  const p = c.user.profile;
  if (!p) return null;
  return (
    <Link href={`/creators/${p.username}`} className="card hover-depth block p-5">
      <p className="font-semibold">{p.displayName}</p>
      <p className="mt-0.5 text-sm text-muted">{c.headline}</p>
      {c.niches.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{c.niches.map((n) => <Badge key={n}>{n}</Badge>)}</div>}
    </Link>
  );
}
