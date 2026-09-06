// Back-compat shim. The identity provider now lives in src/lib/identity and is
// shared by the whole app (simulator + Saath). Saath components still import
// `useSaathIdentity` / `SaathIdentityProvider` from here.
export {
  IdentityProvider as SaathIdentityProvider,
  useIdentity as useSaathIdentity,
} from '@/lib/identity/identity';
