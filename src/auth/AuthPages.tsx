import { SignIn, SignUp } from '@clerk/clerk-react';
import { clerkAppearance } from '@/components/saath/clerkAppearance';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-6">
      <div className="flex items-center gap-1.5">
        <span className="text-2xl font-black tracking-tight text-foreground">Terra</span>
        <span className="text-2xl font-black tracking-tight text-primary">Learn</span>
      </div>
      {children}
    </div>
  );
}

export function SignInPage() {
  return (
    <Shell>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/"
        appearance={clerkAppearance}
      />
    </Shell>
  );
}

export function SignUpPage() {
  return (
    <Shell>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl="/"
        appearance={clerkAppearance}
      />
    </Shell>
  );
}
