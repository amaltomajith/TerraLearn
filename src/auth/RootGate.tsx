import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import Home from '@/components/home';
import { BrandSplash } from '@/components/BrandSplash';
import { Onboarding } from '@/components/Onboarding';
import { IdentityProvider } from '@/lib/identity/identity';
import { AssistantProvider } from '@/lib/assistant/AssistantProvider';
import { GlobalAssistant } from '@/components/assistant/GlobalAssistant';
import { RequireOnboarding } from './RequireOnboarding';

const SaathApp = lazy(() => import('@/components/saath/SaathApp'));
const CascadeApp = lazy(() => import('@/components/cascade/CascadeApp'));
const TeamPanel = lazy(() => import('@/components/farm/TeamPanel'));
const JoinFarm = lazy(() => import('@/components/farm/JoinFarm'));

/** `/add-farm/:farmId` — the add-farm wizard prefilled to edit an existing farm. */
function EditFarmRoute() {
  const { farmId } = useParams();
  return <Onboarding mode="add-farm" farmId={farmId} />;
}

/**
 * Everything below the auth boundary. Signed-out users are bounced to /sign-in;
 * signed-in users get their farmer identity + the onboarding gate, then the app.
 * `SaathApp` stays lazy so its map / realtime deps stay out of the `/` chunk.
 * `/join` is outside RequireOnboarding so workers can redeem invites before
 * completing their profile.
 */
export function RootGate() {
  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <IdentityProvider>
          <Routes>
            {/* /join is accessible before onboarding is complete */}
            <Route
              path="/join"
              element={
                <Suspense fallback={<BrandSplash label="Loading…" />}>
                  <JoinFarm />
                </Suspense>
              }
            />
            <Route
              path="/*"
              element={
                <RequireOnboarding>
                  <AssistantProvider>
                    <Routes>
                      <Route path="/dashboard" element={<Home />} />
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/add-farm" element={<Onboarding mode="add-farm" />} />
                      <Route path="/add-farm/:farmId" element={<EditFarmRoute />} />
                      <Route
                        path="/farm/team"
                        element={
                          <Suspense fallback={<BrandSplash label="Loading team…" />}>
                            <TeamPanel />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/saath/*"
                        element={
                          <Suspense fallback={<BrandSplash label="Loading Saath…" />}>
                            <SaathApp />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/cascade/*"
                        element={
                          <Suspense fallback={<BrandSplash label="Loading Cascade…" />}>
                            <CascadeApp />
                          </Suspense>
                        }
                      />
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                    <GlobalAssistant />
                  </AssistantProvider>
                </RequireOnboarding>
              }
            />
          </Routes>
        </IdentityProvider>
      </SignedIn>
    </>
  );
}

