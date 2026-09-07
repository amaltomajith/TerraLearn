import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import Home from '@/components/home';
import { BrandSplash } from '@/components/BrandSplash';
import { IdentityProvider } from '@/lib/identity/identity';
import { AssistantProvider } from '@/lib/assistant/AssistantProvider';
import { GlobalAssistant } from '@/components/assistant/GlobalAssistant';
import { RequireOnboarding } from './RequireOnboarding';

const SaathApp = lazy(() => import('@/components/saath/SaathApp'));

/**
 * Everything below the auth boundary. Signed-out users are bounced to /sign-in;
 * signed-in users get their farmer identity + the onboarding gate, then the app.
 * `SaathApp` stays lazy so its map / realtime deps stay out of the `/` chunk.
 */
export function RootGate() {
  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <IdentityProvider>
          <RequireOnboarding>
            <AssistantProvider>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route
                  path="/saath/*"
                  element={
                    <Suspense fallback={<BrandSplash label="Loading Saath…" />}>
                      <SaathApp />
                    </Suspense>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <GlobalAssistant />
            </AssistantProvider>
          </RequireOnboarding>
        </IdentityProvider>
      </SignedIn>
    </>
  );
}
