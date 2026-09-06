/** Full-screen branded loading state. Shown while Clerk / the farmer profile resolve. */
export function BrandSplash({ label = 'Loading TerraLearn…' }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-foreground font-medium">{label}</span>
      </div>
    </div>
  );
}
