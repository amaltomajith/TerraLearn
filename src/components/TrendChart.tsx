import * as React from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

export interface TrendChartProps {
  title: string;
  description?: string;
  badgeText?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive';
  data: Record<string, any>[];
  xAxisKey: string;
  seriesKey: string;
  seriesConfig: {
    label: string;
    color: string;
    unit?: string;
  };
  chartType?: 'area' | 'line';
  isLoading?: boolean;
  error?: string | null;
}

export function TrendChart({
  title,
  description,
  badgeText,
  badgeVariant = 'secondary',
  data,
  xAxisKey,
  seriesKey,
  seriesConfig,
  chartType = 'area',
  isLoading = false,
  error = null,
}: TrendChartProps) {
  const chartConfig: ChartConfig = React.useMemo(
    () => ({
      [seriesKey]: {
        label: seriesConfig.label,
        color: seriesConfig.color,
      },
    }),
    [seriesKey, seriesConfig]
  );

  const gradientId = React.useId().replace(/:/g, '');

  const formatXTick = (value: string) => {
    if (!value) return '';
    // Format YYYY-MM-DD dates to Year or MM/YY
    if (typeof value === 'string' && value.length === 10 && value.includes('-')) {
      const parts = value.split('-');
      return `${parts[1]}/${parts[0].slice(2)}`;
    }
    // Format ISO timestamps (YYYY-MM-DDTHH:mm) to HH:mm
    if (typeof value === 'string' && value.includes('T')) {
      const timePart = value.split('T')[1];
      return timePart ? timePart.slice(0, 5) : value;
    }
    return String(value);
  };

  return (
    <div className="bg-card rounded-2xl p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-border/60 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-300 flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-bold text-foreground leading-snug">{title}</h4>
            {badgeText && (
              <Badge variant={badgeVariant} className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5">
                {badgeText}
              </Badge>
            )}
          </div>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>

      {/* Content State */}
      {isLoading ? (
        <div className="h-56 w-full flex flex-col justify-center gap-3">
          <div className="h-full w-full bg-muted/40 animate-pulse rounded-xl" />
        </div>
      ) : error ? (
        <div className="h-56 w-full flex flex-col items-center justify-center gap-2 bg-destructive/5 rounded-xl border border-destructive/20 p-4 text-center">
          <AlertCircle className="w-6 h-6 text-destructive" />
          <p className="text-sm font-semibold text-destructive">{error}</p>
          <p className="text-xs text-muted-foreground">Failed to load chart data</p>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="h-56 w-full flex items-center justify-center text-xs text-muted-foreground bg-muted/20 rounded-xl">
          No trend data available for this location
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-60 w-full aspect-auto">
          {chartType === 'area' ? (
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={seriesConfig.color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={seriesConfig.color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
              <XAxis
                dataKey={xAxisKey}
                tickLine={false}
                axisLine={false}
                minTickGap={45}
                tickFormatter={formatXTick}
                className="text-[11px]"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
                className="text-[11px]"
                tickFormatter={(val) => `${val}${seriesConfig.unit ? seriesConfig.unit : ''}`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(lbl) => formatXTick(String(lbl))}
                    formatter={(val) => (
                      <span className="font-mono font-semibold">
                        {val} {seriesConfig.unit || ''}
                      </span>
                    )}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey={seriesKey}
                stroke={seriesConfig.color}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#grad-${gradientId})`}
              />
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
              <XAxis
                dataKey={xAxisKey}
                tickLine={false}
                axisLine={false}
                minTickGap={45}
                tickFormatter={formatXTick}
                className="text-[11px]"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
                className="text-[11px]"
                tickFormatter={(val) => `${val}${seriesConfig.unit ? seriesConfig.unit : ''}`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(lbl) => formatXTick(String(lbl))}
                    formatter={(val) => (
                      <span className="font-mono font-semibold">
                        {val} {seriesConfig.unit || ''}
                      </span>
                    )}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey={seriesKey}
                stroke={seriesConfig.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          )}
        </ChartContainer>
      )}
    </div>
  );
}
