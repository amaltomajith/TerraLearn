// Maps Clerk's widgets onto TerraLearn's "Earthy Premium" tokens. Works in both
// themes because it points at the CSS variables defined in src/index.css.
// Typed loosely on purpose — Clerk's Appearance type is accepted structurally.

export const clerkAppearance = {
  variables: {
    colorPrimary: 'hsl(152 47% 20%)',
    colorText: 'hsl(20 14% 16%)',
    colorBackground: 'hsl(42 29% 97%)',
    colorInputBackground: 'hsl(0 0% 100%)',
    borderRadius: '0.75rem',
    fontFamily: 'Manrope, ui-sans-serif, system-ui, sans-serif',
  },
  elements: {
    card: 'shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-border/60',
    headerTitle: 'font-serif',
    formButtonPrimary:
      'bg-primary hover:bg-primary/90 text-primary-foreground normal-case font-semibold',
    footerActionLink: 'text-primary hover:text-primary/80',
  },
} as const;
