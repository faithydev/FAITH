import { Footer, PrimaryNavigation } from '@/components/layout/public';
import { RouteTransition } from '@/components/motion/fx';
import type { ReactNode } from 'react';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PrimaryNavigation />
      <main id="main" className="min-h-[70vh]"><RouteTransition>{children}</RouteTransition></main>
      <Footer />
    </>
  );
}
