import type { ReactNode } from 'react';
import { useIdentity } from '@/lib/identity/identity';
import { BrandSplash } from '@/components/BrandSplash';
import { Onboarding } from '@/components/Onboarding';

/**
 * Gates the whole signed-in app (simulator + Saath) behind a completed farmer
 * profile. Until onboarding is done, every route renders the onboarding screen.
 */
export function RequireOnboarding({ children }: { children: ReactNode }) {
  const { ready, needsOnboarding } = useIdentity();

  if (!ready) return <BrandSplash label="Loading your profile…" />;
  if (needsOnboarding) return <Onboarding />;
  return <>{children}</>;
}
