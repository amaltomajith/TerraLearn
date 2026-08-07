import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit?: string;
  isLoading?: boolean;
  delay?: number;
  badge?: React.ReactNode;
}

export function MetricCard({ icon: Icon, label, value, unit, isLoading, delay = 0, badge }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="group bg-card rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-border/60 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:border-primary/20 transition-all duration-300"
    >
      <div className="flex items-start gap-3.5">
        <div className="bg-primary/8 dark:bg-primary/15 rounded-lg p-2.5 flex-shrink-0 group-hover:bg-primary/12 dark:group-hover:bg-primary/20 transition-colors duration-300">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">{label}</p>
            {badge}
          </div>
          {isLoading ? (
            <div className="space-y-1.5">
              <div className="h-7 w-20 bg-muted/60 animate-pulse rounded-md" />
            </div>
          ) : (
            <p className="text-2xl font-mono font-medium text-foreground leading-none">
              {value}
              {unit && <span className="text-sm ml-1 text-muted-foreground font-sans">{unit}</span>}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

