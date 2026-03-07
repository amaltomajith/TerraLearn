import { Sprout, Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { motion } from 'framer-motion';

export function Navigation() {
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-xl border-b border-border/50 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="max-w-[1600px] mx-auto px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-sm">
            <Sprout className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl font-black text-foreground tracking-tight">Terra</h1>
            <h1 className="text-2xl font-black text-primary tracking-tight">Learn</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground hidden sm:block">
            Precision Agriculture Simulator
          </span>
          
          <button
            onClick={toggleTheme}
            className="relative w-10 h-10 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-all duration-300 hover:border-primary/30 active:scale-95 group"
            aria-label="Toggle theme"
          >
            <motion.div
              key={theme}
              initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 text-foreground group-hover:text-primary transition-colors" />
              ) : (
                <Sun className="w-4 h-4 text-foreground group-hover:text-accent transition-colors" />
              )}
            </motion.div>
          </button>
        </div>
      </div>
    </nav>
  );
}

