// DailyGuidelinesCard.tsx
// Context-aware daily farm guidelines derived from climate + soil + crop-cycle data.
// No extra API calls — everything is passed in from home.tsx.

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Droplets,
  Thermometer,
  Wind,
  Sun,
  ShieldAlert,
  Sprout,
  CheckCircle2,
  CloudRain,
  FlaskConical,
  Loader2,
} from "lucide-react";
import type { ClimateData, SoilData } from "@/lib/api";
import type { CropCycle } from "@/lib/farm/types";
import { cn } from "@/lib/utils";

interface Guideline {
  id: string;
  icon: React.ElementType;
  title: string;
  detail: string;
  priority: "ok" | "info" | "warn" | "urgent";
}

function buildGuidelines(
  climate: ClimateData,
  soil: SoilData | null,
  activeCycle: CropCycle | null,
): Guideline[] {
  const tips: Guideline[] = [];
  const { temperature, precipitation, humidity, windSpeed } = climate;

  // Irrigation
  if (precipitation >= 10) {
    tips.push({
      id: "irrigation-skip",
      icon: CloudRain,
      title: "Skip irrigation today",
      detail: `${precipitation.toFixed(0)} mm recorded — soil moisture should be adequate. Check field drainage if waterlogging is likely.`,
      priority: "ok",
    });
  } else if (precipitation >= 4) {
    tips.push({
      id: "irrigation-reduced",
      icon: Droplets,
      title: "Light rain — reduce irrigation",
      detail: `${precipitation.toFixed(0)} mm received. Apply only a supplemental dose if crops are in a critical growth window.`,
      priority: "info",
    });
  } else if (humidity < 40 && temperature > 32) {
    tips.push({
      id: "irrigation-urgent",
      icon: Droplets,
      title: "Irrigate now — high evapotranspiration",
      detail: `Low humidity (${humidity}%) and heat (${temperature.toFixed(0)}°C) are accelerating water loss. Water early morning or evening.`,
      priority: "urgent",
    });
  } else {
    tips.push({
      id: "irrigation-normal",
      icon: Droplets,
      title: "Routine irrigation window",
      detail: `No significant rainfall (${precipitation.toFixed(0)} mm). Water per your schedule — ideally before 8 AM to minimise evaporation.`,
      priority: "info",
    });
  }

  // Temperature stress
  if (temperature > 38) {
    tips.push({
      id: "heat-stress",
      icon: Thermometer,
      title: "Extreme heat alert",
      detail: `${temperature.toFixed(0)}°C — avoid midday field work. Mulch beds and cover nurseries to reduce soil surface temperature.`,
      priority: "urgent",
    });
  } else if (temperature > 34) {
    tips.push({
      id: "heat-warn",
      icon: Sun,
      title: "High temperature — heat stress possible",
      detail: `${temperature.toFixed(0)}°C today. Schedule spraying and transplanting before 9 AM or after 5 PM.`,
      priority: "warn",
    });
  } else if (temperature < 12) {
    tips.push({
      id: "cold-stress",
      icon: ShieldAlert,
      title: "Cold temperature — frost risk",
      detail: `${temperature.toFixed(0)}°C — protect sensitive seedlings. Delay irrigation to avoid chilling the root zone further.`,
      priority: "warn",
    });
  }

  // Spray window
  const goodSprayWindow =
    (windSpeed === undefined || windSpeed < 15) &&
    humidity >= 50 &&
    humidity <= 85 &&
    temperature >= 18 &&
    temperature <= 32 &&
    precipitation < 2;

  if (precipitation >= 6) {
    tips.push({
      id: "spray-skip",
      icon: ShieldAlert,
      title: "Do not spray today",
      detail: "Rain will wash off pesticides before absorption. Wait for a dry window of at least 6 hours.",
      priority: "warn",
    });
  } else if (windSpeed !== undefined && windSpeed >= 20) {
    tips.push({
      id: "spray-wind",
      icon: Wind,
      title: "Too windy to spray",
      detail: `Wind at ${windSpeed.toFixed(0)} km/h causes drift. Postpone until wind drops below 15 km/h.`,
      priority: "warn",
    });
  } else if (goodSprayWindow) {
    tips.push({
      id: "spray-good",
      icon: CheckCircle2,
      title: "Good spray conditions today",
      detail: "Wind, humidity and temperature are ideal. Apply pesticides or foliar sprays early morning for best uptake.",
      priority: "ok",
    });
  }

  // Fertiliser / crop-stage tips
  if (soil && activeCycle) {
    const sowingDate = new Date(activeCycle.sowing_date);
    const daysSinceSowing = Math.floor(
      (Date.now() - sowingDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceSowing < 7) {
      tips.push({
        id: "germination",
        icon: Sprout,
        title: "Germination phase",
        detail: `Day ${daysSinceSowing} after sowing — maintain consistent moisture. Avoid heavy irrigation that can cause soil crusting.`,
        priority: "info",
      });
    } else if (daysSinceSowing >= 25 && daysSinceSowing <= 35 && precipitation < 8) {
      tips.push({
        id: "fert-topdress",
        icon: FlaskConical,
        title: "Top-dressing window open",
        detail: `${daysSinceSowing} DAS — ideal timing for urea top-dressing. Apply before the next rain event for best uptake.`,
        priority: "info",
      });
    } else if (precipitation >= 8 && daysSinceSowing >= 10) {
      tips.push({
        id: "fert-delay",
        icon: FlaskConical,
        title: "Delay fertiliser application",
        detail: `Heavy rain (${precipitation.toFixed(0)} mm) will leach nutrients. Wait for drier soil conditions.`,
        priority: "warn",
      });
    }
  }

  // Disease pressure
  if (humidity > 85 && temperature > 22) {
    tips.push({
      id: "disease-pressure",
      icon: ShieldAlert,
      title: "High disease pressure conditions",
      detail: `Humidity ${humidity}% with warm temperatures — ideal for fungal disease. Scout fields; consider a preventive fungicide if symptoms appear.`,
      priority: "warn",
    });
  }

  // Deduplicate and cap
  const seen = new Set<string>();
  return tips
    .filter((t) => { if (seen.has(t.id)) return false; seen.add(t.id); return true; })
    .slice(0, 5);
}

const PRIORITY_STYLES: Record<Guideline["priority"], string> = {
  ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
  urgent: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25",
};
const PRIORITY_ICON: Record<Guideline["priority"], string> = {
  ok: "text-emerald-500", info: "text-sky-500", warn: "text-amber-500", urgent: "text-rose-500",
};
const PRIORITY_LABEL: Record<Guideline["priority"], string> = {
  ok: "Clear", info: "Note", warn: "Caution", urgent: "Urgent",
};

interface Props {
  climate: ClimateData | null;
  soil: SoilData | null;
  activeCycle: CropCycle | null;
  isLoading?: boolean;
}

export function DailyGuidelinesCard({ climate, soil, activeCycle, isLoading }: Props) {
  const guidelines = useMemo(
    () => (climate ? buildGuidelines(climate, soil, activeCycle) : []),
    [climate, soil, activeCycle],
  );

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <motion.div
      className="bg-card rounded-2xl border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.15)] overflow-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/40">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-500" />
            Today&apos;s farm guidelines
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">{today}</p>
        </div>
        {climate && (
          <div className="text-right">
            <p className="text-lg font-bold text-foreground leading-none">
              {climate.temperature.toFixed(0)}°C
            </p>
            <p className="text-[11px] text-muted-foreground">
              {climate.precipitation.toFixed(0)} mm · {climate.humidity}% RH
              {climate.windSpeed !== undefined && ` · ${climate.windSpeed.toFixed(0)} km/h`}
            </p>
          </div>
        )}
      </div>

      <div className="px-5 py-4">
        {isLoading || !climate ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            {isLoading ? "Reading today\u2019s conditions\u2026" : "Location needed for guidelines"}
          </div>
        ) : (
          <ul className="space-y-2.5">
            {guidelines.map((g, i) => {
              const Icon = g.icon;
              return (
                <motion.li
                  key={g.id}
                  className={cn("flex gap-3 rounded-xl border px-3 py-2.5", PRIORITY_STYLES[g.priority])}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.06 }}
                >
                  <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", PRIORITY_ICON[g.priority])} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold leading-tight">{g.title}</span>
                      <span className={cn("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border", PRIORITY_STYLES[g.priority])}>
                        {PRIORITY_LABEL[g.priority]}
                      </span>
                    </div>
                    <p className="text-[12px] mt-0.5 leading-snug opacity-90">{g.detail}</p>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}
        {climate && !activeCycle && (
          <p className="text-[11px] text-muted-foreground mt-3">
            Start a crop cycle to get fertiliser and growth-stage tips.
          </p>
        )}
      </div>
    </motion.div>
  );
}
