import {
  Sprout,
  ThermometerSun,
  Droplets,
  FlaskConical,
  Star,
  ChevronRight,
  CalendarClock,
  Recycle,
} from 'lucide-react';
import { format } from 'date-fns';
import type { CropInfo } from '@/lib/api';
import { getSeasonName, getSeason, calculateHarvestDate } from '@/lib/api';
import type { CircularOpportunity } from '@/lib/cropEnterprise';

interface CropSuggestion {
  crop: CropInfo;
  score: number;
  reasons: string[];
  circular?: CircularOpportunity;
}

interface CropSuggestionsProps {
  suggestions: CropSuggestion[];
  season: string;
  plantingDate?: Date;
  lat?: number;
  selectedCrop?: string;
  onSelectCrop?: (cropName: string) => void;
  show: boolean;
  /** 'panel' = compact, lives in the simulator card before a run.
   *  'results' = full styling, shown after a simulation (default). */
  variant?: 'panel' | 'results';
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-accent';
  if (score >= 60) return 'text-primary';
  if (score >= 40) return 'text-secondary';
  return 'text-muted-foreground';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-accent/10';
  if (score >= 60) return 'bg-primary/10';
  if (score >= 40) return 'bg-secondary/10';
  return 'bg-muted/10';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

export function CropSuggestions({
  suggestions,
  season,
  plantingDate,
  lat,
  selectedCrop,
  onSelectCrop,
  show,
  variant = 'results',
}: CropSuggestionsProps) {
  if (!show || suggestions.length === 0) return null;

  const isPanel = variant === 'panel';

  return (
    <div
      className={
        isPanel
          ? 'rounded-xl border border-accent/20 dark:border-accent/15 bg-accent/5 dark:bg-accent/8 p-4 animate-in fade-in slide-in-from-bottom-2 duration-300'
          : 'bg-gradient-to-br from-accent/5 to-primary/5 dark:from-accent/8 dark:to-primary/8 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-accent/20 dark:border-accent/15 animate-in fade-in slide-in-from-bottom-4 duration-500'
      }
    >
      <div className={`flex items-center gap-2 ${isPanel ? 'mb-2' : 'mb-4'}`}>
        <Sprout className={`${isPanel ? 'w-4 h-4' : 'w-5 h-5'} text-accent`} />
        <h3 className={`${isPanel ? 'text-sm' : 'text-lg'} font-bold text-foreground`}>
          {isPanel ? 'Suggested for this spot' : 'Smart Crop Suggestions'}
        </h3>
      </div>
      {!isPanel && (
        <p className="text-sm text-muted-foreground mb-5">
          Best crops for{' '}
          <span className="font-semibold text-foreground">{getSeasonName(season)}</span> based on
          your location's environmental conditions
        </p>
      )}

      <div className={isPanel ? 'space-y-2' : 'space-y-3'}>
        {suggestions.map((suggestion, index) => {
          const isSelected =
            !!selectedCrop &&
            selectedCrop.toLowerCase() === suggestion.crop.name.toLowerCase();
          const harvest =
            plantingDate ? calculateHarvestDate(plantingDate, suggestion.crop.name) : null;
          const seasonFits =
            plantingDate != null && lat != null
              ? suggestion.crop.seasons.includes(getSeason(plantingDate, lat))
              : null;

          return (
            <button
              key={suggestion.crop.name}
              onClick={() => onSelectCrop?.(suggestion.crop.name)}
              className={`w-full text-left bg-card/70 dark:bg-card/50 hover:bg-card dark:hover:bg-card/80 rounded-lg p-4 border transition-all group animate-in fade-in slide-in-from-left-4 duration-300 ${
                isSelected
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-border/40 hover:border-primary/30'
              }`}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full ${getScoreBg(
                      suggestion.score,
                    )} flex items-center justify-center`}
                  >
                    <span
                      className={`text-sm font-mono font-bold ${getScoreColor(suggestion.score)}`}
                    >
                      {index + 1}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {suggestion.crop.name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {suggestion.crop.growingDays} days to harvest
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`px-2.5 py-1 rounded-full ${getScoreBg(suggestion.score)}`}>
                    <span
                      className={`text-xs font-semibold ${getScoreColor(suggestion.score)}`}
                    >
                      {getScoreLabel(suggestion.score)} ({Math.round(suggestion.score)}%)
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>

              {/* Harvest window + season fit */}
              {(harvest || seasonFits != null) && (
                <div className="flex flex-wrap gap-1.5 mb-2 text-xs">
                  {harvest && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
                      <CalendarClock className="w-3 h-3" />
                      Harvest ~ {format(harvest, 'MMM yyyy')}
                    </span>
                  )}
                  {seasonFits != null && (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                        seasonFits
                          ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                          : 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                      }`}
                    >
                      <Sprout className="w-3 h-3" />
                      {seasonFits ? 'Season fit' : 'Off-season'}
                    </span>
                  )}
                </div>
              )}

              {/* Reasons */}
              <div className="flex flex-wrap gap-1.5">
                {suggestion.reasons.map((reason, i) => {
                  let Icon = Star;
                  if (reason.toLowerCase().includes('temperature')) Icon = ThermometerSun;
                  else if (reason.toLowerCase().includes('humidity')) Icon = Droplets;
                  else if (reason.toLowerCase().includes('ph')) Icon = FlaskConical;
                  else if (
                    reason.toLowerCase().includes('season') ||
                    reason.toLowerCase().includes('planting')
                  )
                    Icon = Sprout;

                  return (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full"
                    >
                      <Icon className="w-3 h-3" />
                      {reason}
                    </span>
                  );
                })}
              </div>

              {/* Circular-agriculture opportunity */}
              {suggestion.circular && (
                <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-accent">
                  <Recycle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    + {suggestion.circular.count} {suggestion.circular.theirEnterpriseLabel} farm
                    {suggestion.circular.count === 1 ? '' : 's'} within{' '}
                    {suggestion.circular.nearestKm} km buy {suggestion.circular.resource}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
