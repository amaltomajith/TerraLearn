import { Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { ClerkProvider, ClerkLoaded, ClerkLoading } from "@clerk/clerk-react";
import { ThemeProvider } from "./components/ThemeProvider";
import { BrandSplash } from "./components/BrandSplash";
import { hasClerk, hasSupabase } from "./lib/saath/config";
import { UnconfiguredApp } from "./auth/UnconfiguredApp";
import { RootGate } from "./auth/RootGate";
import { SignInPage, SignUpPage } from "./auth/AuthPages";
import { clerkAppearance } from "./components/saath/clerkAppearance";

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

function App() {
  return (
    <ThemeProvider>
      <Toaster position="top-right" richColors theme="system" />
      {!hasClerk || !hasSupabase ? (
        <UnconfiguredApp />
      ) : (
        <ClerkProvider
          publishableKey={clerkKey as string}
          appearance={clerkAppearance}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          afterSignOutUrl="/sign-in"
        >
          <ClerkLoading>
            <BrandSplash />
          </ClerkLoading>
          <ClerkLoaded>
            <Routes>
              <Route path="/sign-in/*" element={<SignInPage />} />
              <Route path="/sign-up/*" element={<SignUpPage />} />
              <Route path="/*" element={<RootGate />} />
            </Routes>
          </ClerkLoaded>
        </ClerkProvider>
      )}
    </ThemeProvider>
  );
}

export default App;
