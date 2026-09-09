/**
 * Standardised Precipitation Index (SPI) computation
 *
 * Uses the Wilson–Hilferty normal-approximation to fit a gamma distribution to
 * the n-month rolling precipitation totals, then converts to a Z-score.
 *
 * Reference: McKee et al. (1993); MoA Manual for Drought Management (2016).
 *
 * Severity classes follow the Manual for Drought Management 2016 (Table 3-1):
 *   ≥ −0.5        Near-Normal / No drought
 *   −0.5 to −1.0  Watch (mild)
 *   −1.0 to −1.5  Warning (moderate)
 *   −1.5 to −2.0  Emergency (severe)
 *   < −2.0        Catastrophic (extreme)
 */

export type SPISeverity = 'near-normal' | 'watch' | 'warning' | 'emergency' | 'catastrophic';

export interface SPIPoint {
  date: string;       // ISO YYYY-MM-DD (first day of window's END month)
  spi: number;
  severity: SPISeverity;
}

function toMonthlyTotals(dates: string[], daily: number[]): { yearMonth: string; total: number }[] {
  const map = new Map<string, number>();
  for (let i = 0; i < dates.length; i++) {
    const ym = dates[i].slice(0, 7);
    map.set(ym, (map.get(ym) ?? 0) + (daily[i] ?? 0));
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([yearMonth, total]) => ({ yearMonth, total }));
}

function rollingSum(monthly: number[], window: number): number[] {
  return monthly.map((_, i) => {
    if (i < window - 1) return NaN;
    let s = 0;
    for (let j = i - window + 1; j <= i; j++) s += monthly[j];
    return s;
  });
}

function fitGamma(values: number[]): { alpha: number; beta: number; pZero: number } {
  const n = values.length;
  if (n === 0) return { alpha: 1, beta: 1, pZero: 0 };
  const zeros = values.filter((v) => v === 0).length;
  const nonzero = values.filter((v) => v > 0);
  const pZero = zeros / n;
  if (nonzero.length < 4) return { alpha: 1, beta: 1, pZero };
  const mean = nonzero.reduce((a, b) => a + b, 0) / nonzero.length;
  const variance = nonzero.reduce((s, v) => s + (v - mean) ** 2, 0) / (nonzero.length - 1);
  if (variance === 0 || mean === 0) return { alpha: 1, beta: mean || 1, pZero };
  const beta = variance / mean;
  return { alpha: mean / beta, beta, pZero };
}

function logGamma(x: number): number {
  if (x <= 0) return 0;
  const c = [0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,
              -176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  const z = x - 1;
  let sum = c[0];
  for (let i = 1; i < 9; i++) sum += c[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

function gammaCDF(x: number, alpha: number, beta: number): number {
  if (x <= 0) return 0;
  const t = x / beta;
  let term = 1 / alpha;
  let sum = term;
  for (let k = 1; k <= 300; k++) {
    term *= t / (alpha + k);
    sum += term;
    if (term < 1e-10 * sum) break;
  }
  return Math.min(Math.max(Math.exp(-t + alpha * Math.log(t) - logGamma(alpha) + Math.log(sum)), 0), 1);
}

function normalQuantile(p: number): number {
  if (p <= 0) return -4;
  if (p >= 1) return 4;
  const sign = p < 0.5 ? -1 : 1;
  const q = Math.min(p, 1 - p);
  const t = Math.sqrt(-2 * Math.log(q));
  const num = 2.515517 + 0.802853 * t + 0.010328 * t * t;
  const den = 1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t;
  return sign * (t - num / den);
}

function classifySPI(spi: number): SPISeverity {
  if (spi >= -0.5) return 'near-normal';
  if (spi >= -1.0) return 'watch';
  if (spi >= -1.5) return 'warning';
  if (spi >= -2.0) return 'emergency';
  return 'catastrophic';
}

/**
 * Compute SPI-3 or SPI-6 from a daily precipitation series.
 * @param dates     ISO YYYY-MM-DD strings
 * @param dailyMm   Daily precipitation (mm), same length as dates
 * @param windowMonths  3 or 6
 */
export function computeSPI(dates: string[], dailyMm: number[], windowMonths: 3 | 6): SPIPoint[] {
  const monthly = toMonthlyTotals(dates, dailyMm);
  const totals = monthly.map((m) => m.total);
  const yearMonths = monthly.map((m) => m.yearMonth);
  const rolling = rollingSum(totals, windowMonths);
  const calibration = rolling.filter((v) => !isNaN(v));
  const { alpha, beta, pZero } = fitGamma(calibration);

  return rolling
    .map((r, i) => {
      if (isNaN(r)) return null;
      const H = Math.max(0.0005, Math.min(0.9995,
        r === 0 ? pZero : pZero + (1 - pZero) * gammaCDF(r, alpha, beta)
      ));
      const spi = Math.round(normalQuantile(H) * 100) / 100;
      return { date: yearMonths[i] + '-01', spi, severity: classifySPI(spi) } as SPIPoint;
    })
    .filter((p): p is SPIPoint => p !== null);
}

export function latestSPI(points: SPIPoint[]): SPIPoint | null {
  return points.length > 0 ? points[points.length - 1] : null;
}
