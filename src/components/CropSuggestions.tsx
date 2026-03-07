import { Sprout, ThermometerSun, Droplets, FlaskConical, Star, ChevronRight } from 'lucide-react';
import type { CropInfo } from '@/lib/api';
import { getSeasonName } from '@/lib/api';

interface CropSuggestion {
  crop: CropInfo;
  score: number;
  reasons: string[];
}

interface CropSuggestionsProps {
  suggestions: CropSuggestion[];
  season: string;
  onSelectCrop?: (cropName: string) => void;
  show: boolean;
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

export function CropSuggestions({ suggestions, season, onSelectCrop, show }: CropSuggestionsProps) {
  if (!show || suggestions.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-accent/5 to-primary/5 dark:from-accent/8 dark:to-primary/8 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-accent/20 dark:border-accent/15 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-2 mb-4">
        <Sprout className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-bold text-foreground">
          Smart Crop Suggestions
        </h3>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Best crops for <span className="font-semibold text-foreground">{getSeasonName(season)}</span> based on your location's environmental conditions
      </p>

      <div className="space-y-3">
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.crop.name}
            onClick={() => onSelectCrop?.(suggestion.crop.name)}
            className="w-full text-left bg-card/70 dark:bg-card/50 hover:bg-card dark:hover:bg-card/80 rounded-lg p-4 border border-border/40 hover:border-primary/30 transition-all group animate-in fade-in slide-in-from-left-4 duration-300"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full ${getScoreBg(suggestion.score)} flex items-center justify-center`}>
                  <span className={`text-sm font-mono font-bold ${getScoreColor(suggestion.score)}`}>
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
                  <span className={`text-xs font-semibold ${getScoreColor(suggestion.score)}`}>
                    {getScoreLabel(suggestion.score)} ({Math.round(suggestion.score)}%)
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>

            {/* Reasons */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {suggestion.reasons.map((reason, i) => {
                let Icon = Star;
                if (reason.toLowerCase().includes('temperature')) Icon = ThermometerSun;
                else if (reason.toLowerCase().includes('humidity')) Icon = Droplets;
                else if (reason.toLowerCase().includes('ph')) Icon = FlaskConical;
                else if (reason.toLowerCase().includes('season') || reason.toLowerCase().includes('planting')) Icon = Sprout;

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
          </button>
        ))}
      </div>
    </div>
  );
}
