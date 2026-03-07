import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Cloud, Layers, Calculator, BarChart3, Check, Loader2 
} from 'lucide-react';

export type SimulationStep = 
  | 'idle'
  | 'locating'
  | 'climate'
  | 'soil'
  | 'calculating'
  | 'complete'
  | 'error';

interface SimulationStatusProps {
  currentStep: SimulationStep;
  isVisible: boolean;
}

const STEPS = [
  { id: 'locating' as const, label: 'Resolving location', icon: MapPin },
  { id: 'climate' as const, label: 'Fetching climate data', icon: Cloud },
  { id: 'soil' as const, label: 'Analyzing soil conditions', icon: Layers },
  { id: 'calculating' as const, label: 'Running yield model', icon: Calculator },
  { id: 'complete' as const, label: 'Simulation complete', icon: BarChart3 },
];

function getStepStatus(stepId: string, currentStep: SimulationStep): 'pending' | 'active' | 'complete' | 'error' {
  const stepOrder = ['locating', 'climate', 'soil', 'calculating', 'complete'];
  const currentIndex = stepOrder.indexOf(currentStep);
  const stepIndex = stepOrder.indexOf(stepId);
  
  if (currentStep === 'error') return stepIndex <= currentIndex ? 'error' : 'pending';
  if (stepIndex < currentIndex) return 'complete';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

export function SimulationStatus({ currentStep, isVisible }: SimulationStatusProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isFirstRun, setIsFirstRun] = useState(true);

  useEffect(() => {
    if (currentStep === 'idle' || currentStep === 'complete' || currentStep === 'error') {
      return;
    }
    
    setElapsedTime(0);
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 100);
    }, 100);
    
    return () => clearInterval(interval);
  }, [currentStep]);

  useEffect(() => {
    if (currentStep === 'idle') {
      setElapsedTime(0);
    }
    // After first completion, subsequent runs use cache so it's fast
    if (currentStep === 'complete') {
      setIsFirstRun(false);
    }
  }, [currentStep]);

  return (
    <AnimatePresence>
      {isVisible && currentStep !== 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="bg-card rounded-xl p-6 shadow-lg border border-border/60 overflow-hidden relative"
        >
          {/* Animated gradient bar at top */}
          <div className="absolute top-0 left-0 right-0 h-1">
            {currentStep !== 'complete' && currentStep !== 'error' ? (
              <motion.div 
                className="h-full bg-gradient-to-r from-primary via-accent to-primary"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                style={{ width: '50%' }}
              />
            ) : currentStep === 'complete' ? (
              <motion.div 
                className="h-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 0.5 }}
              />
            ) : (
              <div className="h-full bg-destructive" />
            )}
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {currentStep !== 'complete' && currentStep !== 'error' && (
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              )}
              {currentStep === 'complete' && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                >
                  <Check className="w-4 h-4 text-accent" />
                </motion.div>
              )}
              <h4 className="text-sm font-semibold text-foreground">
                {currentStep === 'complete' ? 'Analysis Complete' : 'Running Simulation'}
              </h4>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-xs font-mono text-muted-foreground">
                {(elapsedTime / 1000).toFixed(1)}s
              </span>
              {isFirstRun && currentStep !== 'complete' && currentStep !== 'error' && (
                <span className="text-[10px] text-muted-foreground/60">
                  est. 15–30s first run
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            {STEPS.map((step, index) => {
              const status = getStepStatus(step.id, currentStep);
              const StepIcon = step.icon;
              
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors duration-300 ${
                    status === 'active' ? 'bg-primary/8' :
                    status === 'complete' ? 'bg-accent/5' :
                    ''
                  }`}
                >
                  {/* Step indicator */}
                  <div className={`relative w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                    status === 'complete' ? 'bg-accent/15 text-accent' :
                    status === 'active' ? 'bg-primary/15 text-primary' :
                    status === 'error' ? 'bg-destructive/15 text-destructive' :
                    'bg-muted/40 text-muted-foreground/50'
                  }`}>
                    {status === 'complete' ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </motion.div>
                    ) : status === 'active' ? (
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <StepIcon className="w-3.5 h-3.5" />
                      </motion.div>
                    ) : (
                      <StepIcon className="w-3.5 h-3.5" />
                    )}
                    
                    {/* Connector line */}
                    {index < STEPS.length - 1 && (
                      <div className={`absolute top-full left-1/2 -translate-x-1/2 w-px h-1 transition-colors duration-300 ${
                        status === 'complete' ? 'bg-accent/30' : 'bg-border/50'
                      }`} />
                    )}
                  </div>

                  {/* Label */}
                  <span className={`text-sm transition-colors duration-300 ${
                    status === 'complete' ? 'text-accent font-medium' :
                    status === 'active' ? 'text-foreground font-medium' :
                    'text-muted-foreground/60'
                  }`}>
                    {step.label}
                  </span>

                  {/* Active spinner */}
                  {status === 'active' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="ml-auto"
                    >
                      <div className="w-3 h-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                    </motion.div>
                  )}

                  {/* Complete check */}
                  {status === 'complete' && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="ml-auto text-xs text-accent/70 font-mono"
                    >
                      done
                    </motion.span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
