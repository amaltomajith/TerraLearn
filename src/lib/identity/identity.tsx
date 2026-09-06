import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { getFarmerByClerkId, getMyFarms } from '@/lib/saath/queries';
import type { Farm, Farmer } from '@/lib/saath/types';
import { isSupabaseConfigured } from '@/lib/saath/client';
import { isProfileComplete } from './isProfileComplete';

/**
 * The signed-in farmer's identity, shared by the whole app (simulator + Saath).
 * One Clerk user ⇒ one `farmers` row (looked up by `clerk_user_id`). No demo /
 * "view as" indirection — `activeFarmer` is always the user's own row.
 */
interface Identity {
  ready: boolean;
  clerkUserId: string | null;
  /** The farmer row owned by the signed-in Clerk user (null until onboarding). */
  ownFarmer: Farmer | null;
  /** Alias of ownFarmer. */
  farmer: Farmer | null;
  /** Alias kept for the ~18 Saath components that read `activeFarmer`. */
  activeFarmer: Farmer | null;
  activeFarmerId: string | null;
  farms: Farm[];
  primaryFarm: Farm | null;
  needsOnboarding: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<Identity | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const { isLoaded: authLoaded } = useAuth();
  const { user } = useUser();
  const clerkUserId = user?.id ?? null;

  const [ownFarmer, setOwnFarmer] = useState<Farmer | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [resolved, setResolved] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !clerkUserId) {
      setOwnFarmer(null);
      setFarms([]);
      setResolved(true);
      return;
    }
    try {
      const f = await getFarmerByClerkId(clerkUserId);
      setOwnFarmer(f);
      setFarms(f ? await getMyFarms() : []);
    } catch {
      setOwnFarmer(null);
      setFarms([]);
    } finally {
      setResolved(true);
    }
  }, [clerkUserId]);

  useEffect(() => {
    setResolved(false);
    void load();
  }, [load]);

  const value = useMemo<Identity>(() => {
    const primaryFarm = farms.find((f) => f.is_primary) ?? farms[0] ?? null;
    return {
      ready: authLoaded && resolved,
      clerkUserId,
      ownFarmer,
      farmer: ownFarmer,
      activeFarmer: ownFarmer,
      activeFarmerId: ownFarmer?.id ?? null,
      farms,
      primaryFarm,
      needsOnboarding: resolved && !isProfileComplete(ownFarmer, farms),
      refresh: load,
    };
  }, [authLoaded, resolved, clerkUserId, ownFarmer, farms, load]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useIdentity(): Identity {
  const v = useContext(Ctx);
  if (!v) throw new Error('useIdentity must be used within <IdentityProvider>');
  return v;
}
