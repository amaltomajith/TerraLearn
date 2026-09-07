import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, Wheat, Calendar, Clock, ArrowDownRight, ArrowUpRight, ShieldCheck, ShieldAlert, ShieldX, Store, LineChart, Info } from 'lucide-react';
import { format } from 'date-fns';
import { getWarningIcon } from './CustomIcons';

interface FinancialResultsProps {
  yield: number;
  pricePerUnit: number;
  profit: number;
  show: boolean;
  currencySymbol?: string;
  currencyCode?: string;
  harvestDate?: Date;
  growingDays?: number;
  grossRevenue?: number;
  totalCosts?: number;
  areaHectares?: number;
  warnings?: string[];
  viabilityScore?: number;
  priceSource?: 'buyer' | 'agmarknet' | 'reference';
  buyerName?: string;
  buyerDistanceKm?: number;
  mandiTrendPct?: number;
}

export function FinancialResults({
  yield: yieldValue,
  pricePerUnit,
  profit,
  show,
  currencySymbol = '$',
  currencyCode = 'USD',
  harvestDate,
  growingDays,
  grossRevenue,
  totalCosts,
  areaHectares = 1,
  warnings = [],
  viabilityScore = 100,
  priceSource = 'reference',
  buyerName,
  buyerDistanceKm,
  mandiTrendPct,
}: FinancialResultsProps) {
  const [animatedProfit, setAnimatedProfit] = useState(0);
  const [animatedRevenue, setAnimatedRevenue] = useState(0);

  useEffect(() => {
    if (!show) {
      setAnimatedProfit(0);
      setAnimatedRevenue(0);
      return;
    }

    const duration = 1000;
    const steps = 50;
    const profitIncrement = profit / steps;
    const revenueIncrement = (grossRevenue || 0) / steps;
    let current = 0;
    let currentRev = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current += profitIncrement;
      currentRev += revenueIncrement;
      if (step >= steps) {
        setAnimatedProfit(profit);
        setAnimatedRevenue(grossRevenue || 0);
        clearInterval(timer);
      } else {
        setAnimatedProfit(Math.round(current));
        setAnimatedRevenue(Math.round(currentRev));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [profit, grossRevenue, show]);

  if (!show) return null;

  const formatCurrency = (value: number) => {
    return `${currencySymbol}${Math.abs(value).toLocaleString()}`;
  };

  const getViabilityColor = (score: number) => {
    if (score >= 70) return 'text-accent';
    if (score >= 40) return 'text-amber-500';
    return 'text-destructive';
  };

  const getViabilityBg = (score: number) => {
    if (score >= 70) return 'bg-accent/8 dark:bg-accent/12 border-accent/20';
    if (score >= 40) return 'bg-amber-500/8 dark:bg-amber-500/12 border-amber-500/20';
    return 'bg-destructive/8 dark:bg-destructive/12 border-destructive/20';
  };

  const getViabilityLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Marginal';
    if (score >= 20) return 'Poor';
    return 'Not Viable';
  };

  const getViabilityIcon = (score: number) => {
    if (score >= 60) return <ShieldCheck className="w-5 h-5" />;
    if (score >= 40) return <ShieldAlert className="w-5 h-5" />;
    return <ShieldX className="w-5 h-5" />;
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="bg-gradient-to-br from-primary/4 via-card to-accent/4 dark:from-primary/8 dark:via-card dark:to-accent/6 rounded-2xl p-7 shadow-[0_4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)] border border-primary/15 dark:border-primary/10 overflow-hidden relative"
    >
      {/* Decorative gradient orb */}
      <div className="absolute -top-20 -right-20 w-48 h-48 bg-accent/5 dark:bg-accent/8 rounded-full blur-3xl pointer-events-none" />
      
      <div className="space-y-5 relative">
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              Simulation Results
            </h3>
            {harvestDate && (
              <span className="text-xs font-mono text-muted-foreground px-2.5 py-1 bg-muted/40 rounded-full">
                {currencyCode}
              </span>
            )}
          </div>
        </motion.div>

        {/* Viability Score */}
        {viabilityScore !== undefined && (
          <motion.div variants={itemVariants} className={`rounded-xl p-4 border ${getViabilityBg(viabilityScore)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={getViabilityColor(viabilityScore)}>
                  {getViabilityIcon(viabilityScore)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Crop Viability</p>
                  <p className={`text-xs font-medium ${getViabilityColor(viabilityScore)}`}>
                    {getViabilityLabel(viabilityScore)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-28 h-2.5 bg-foreground/5 dark:bg-foreground/10 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      viabilityScore >= 70
                        ? 'bg-accent'
                        : viabilityScore >= 40
                        ? 'bg-amber-500'
                        : 'bg-destructive'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${viabilityScore}%` }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <span className={`text-2xl font-mono font-bold ${getViabilityColor(viabilityScore)}`}>
                  {viabilityScore}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Warnings */}
        <AnimatePresence>
          {warnings.length > 0 && (
            <motion.div 
              variants={itemVariants}
              className="bg-amber-500/6 dark:bg-amber-500/10 border border-amber-500/15 rounded-xl p-4 space-y-2"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Conditions Analysis</span>
              </div>
              {warnings.map((warning, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-start gap-2.5 pl-1"
                >
                  <span className="text-amber-600 dark:text-amber-400 mt-0.5">
                    {getWarningIcon(warning)}
                  </span>
                  <p className="text-sm text-amber-700 dark:text-amber-300/80">
                    {warning}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Harvest Timeline */}
        {harvestDate && growingDays && (
          <motion.div variants={itemVariants} className="bg-card/60 dark:bg-card/40 rounded-xl p-4 border border-border/40">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Harvest Timeline</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-lg font-mono font-semibold text-foreground">
                  {format(harvestDate, 'MMMM d, yyyy')}
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-primary/8 dark:bg-primary/15 px-3 py-1.5 rounded-full">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-mono font-medium text-primary">{growingDays}d</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Key metrics grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wheat className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Yield</span>
            </div>
            <p className="text-xl font-mono font-semibold text-foreground">
              {yieldValue.toLocaleString()}
              <span className="text-sm ml-1 text-muted-foreground font-sans">tons</span>
            </p>
            {yieldValue === 0 && (
              <p className="text-xs text-destructive font-medium">
                No viable yield expected
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Price</span>
            </div>
            <p className="text-xl font-mono font-semibold text-foreground">
              {formatCurrency(pricePerUnit)}
              <span className="text-sm ml-1 text-muted-foreground font-sans">/ton</span>
            </p>
            {priceSource === 'buyer' && buyerName && (
              <p className="text-[11px] font-medium text-accent flex items-center gap-1">
                <Store className="w-3 h-3 shrink-0" />
                buyer demand · {buyerName}
                {buyerDistanceKm != null ? ` · ${buyerDistanceKm} km away` : ''}
              </p>
            )}
            {priceSource === 'agmarknet' && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <LineChart className="w-3 h-3 shrink-0" />
                mandi price · Agmarknet
                {mandiTrendPct != null && mandiTrendPct !== 0 && (
                  <span
                    className={`inline-flex items-center gap-0.5 ${
                      mandiTrendPct > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-destructive'
                    }`}
                  >
                    {mandiTrendPct > 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {mandiTrendPct > 0 ? '+' : ''}
                    {mandiTrendPct}%
                  </span>
                )}
              </p>
            )}
            {priceSource === 'reference' && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3 shrink-0" />
                reference price · no live market data for this crop or location
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Net Profit</span>
            </div>
            <motion.p 
              className={`text-3xl font-mono font-extrabold ${profit >= 0 ? 'text-accent' : 'text-destructive'}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
            >
              {profit < 0 ? '-' : ''}{formatCurrency(Math.abs(animatedProfit))}
            </motion.p>
            {profit < 0 && (
              <p className="text-xs text-destructive font-medium">
                Operating at a loss
              </p>
            )}
          </div>
        </motion.div>

        {/* Financial Breakdown */}
        {grossRevenue !== undefined && totalCosts !== undefined && (
          <motion.div variants={itemVariants} className="bg-card/40 dark:bg-card/30 rounded-xl p-4 border border-border/30">
            <p className="text-[10px] font-semibold text-muted-foreground mb-3 uppercase tracking-widest">
              Breakdown · {areaHectares.toFixed(2)} ha
            </p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center">
                    <ArrowUpRight className="w-3 h-3 text-accent" />
                  </div>
                  <span className="text-sm text-foreground">Gross Revenue</span>
                </div>
                <span className="text-sm font-mono font-medium text-foreground">
                  {formatCurrency(animatedRevenue)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-destructive/10 flex items-center justify-center">
                    <ArrowDownRight className="w-3 h-3 text-destructive" />
                  </div>
                  <span className="text-sm text-foreground">Total Costs</span>
                </div>
                <span className="text-sm font-mono font-medium text-destructive">
                  -{formatCurrency(totalCosts)}
                </span>
              </div>
              <div className="border-t border-border/30 pt-2.5 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Net Profit</span>
                  <span className={`text-sm font-mono font-bold ${profit >= 0 ? 'text-accent' : 'text-destructive'}`}>
                    {profit < 0 ? '-' : ''}{formatCurrency(Math.abs(animatedProfit))}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div variants={itemVariants} className="pt-4 border-t border-border/20 space-y-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Estimates based on real-time climate data, soil conditions, seasonal factors, latitude analysis, and projected market trends. 
            Costs include fixed per-hectare expenses and variable costs. Actual results may vary.
          </p>
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed italic">
            <span className="font-semibold not-italic text-muted-foreground/80">Note:</span> This project is a proof-of-concept for a data-driven agricultural simulation. While it fetches real-time baseline data via Open-Meteo &amp; ISRIC SoilGrids, the yield and pricing models are intended for demonstration purposes and should not be used for actual financial planning.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
