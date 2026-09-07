// API utilities for TerraLearn

export interface ClimateData {
  temperature: number; // Celsius
  precipitation: number; // mm
  humidity: number; // %
}

export interface AirQualityData {
  current: {
    pm2_5: number;
    pm10: number;
    ozone: number;
    nitrogenDioxide: number;
    sulphurDioxide: number;
    carbonMonoxide: number;
    usAqi: number;
  };
  hourly: {
    time: string[];
    pm2_5: number[];
    pm10: number[];
    ozone: number[];
    nitrogenDioxide: number[];
    sulphurDioxide: number[];
    carbonMonoxide: number[];
    usAqi: number[];
  };
}

export interface ClimateTrendsData {
  daily: {
    time: string[];
    temperature2mMean: number[];
    precipitationSum: number[];
  };
}


export interface SoilData {
  pH: number;
  nitrogen: number; // ppm
  phosphorus: number; // ppm
  potassium: number; // ppm
  // Where the values came from:
  //   'isric'     — a real ISRIC SoilGrids measurement for this point
  //   'estimated' — SoilGrids was unavailable; a deterministic latitude-band
  //                 heuristic seeded on the coordinate (same pin → same values)
  source: 'isric' | 'estimated';
}

export interface LocationInfo {
  country: string;
  countryCode: string;
  currencySymbol: string;
  currencyCode: string;
  exchangeRate: number; // relative to USD
}

export interface CropInfo {
  name: string;
  growingDays: number; // days from planting to harvest
  baseYield: number; // tons per hectare
  basePrice: number; // USD per ton
  optimalTempMin: number;
  optimalTempMax: number;
  optimalPHMin: number;
  optimalPHMax: number;
  optimalHumidityMin: number;
  optimalHumidityMax: number;
  seasons: ('spring' | 'summer' | 'autumn' | 'winter')[];
}

// Comprehensive crop database with growing parameters
export const CROP_DATABASE: Record<string, CropInfo> = {
  wheat: {
    name: 'Wheat',
    growingDays: 120,
    baseYield: 3.5,
    basePrice: 250,
    optimalTempMin: 10,
    optimalTempMax: 25,
    optimalPHMin: 6.0,
    optimalPHMax: 7.5,
    optimalHumidityMin: 40,
    optimalHumidityMax: 70,
    seasons: ['autumn', 'spring'],
  },
  corn: {
    name: 'Corn',
    growingDays: 100,
    baseYield: 10.5,
    basePrice: 180,
    optimalTempMin: 18,
    optimalTempMax: 33,
    optimalPHMin: 5.8,
    optimalPHMax: 7.0,
    optimalHumidityMin: 50,
    optimalHumidityMax: 80,
    seasons: ['spring', 'summer'],
  },
  soybeans: {
    name: 'Soybeans',
    growingDays: 100,
    baseYield: 3.2,
    basePrice: 450,
    optimalTempMin: 20,
    optimalTempMax: 30,
    optimalPHMin: 6.0,
    optimalPHMax: 7.0,
    optimalHumidityMin: 50,
    optimalHumidityMax: 85,
    seasons: ['spring', 'summer'],
  },
  rice: {
    name: 'Rice',
    growingDays: 150,
    baseYield: 7.0,
    basePrice: 380,
    optimalTempMin: 20,
    optimalTempMax: 35,
    optimalPHMin: 5.5,
    optimalPHMax: 6.5,
    optimalHumidityMin: 70,
    optimalHumidityMax: 95,
    seasons: ['spring', 'summer'],
  },
  barley: {
    name: 'Barley',
    growingDays: 90,
    baseYield: 3.8,
    basePrice: 220,
    optimalTempMin: 8,
    optimalTempMax: 22,
    optimalPHMin: 6.0,
    optimalPHMax: 8.0,
    optimalHumidityMin: 40,
    optimalHumidityMax: 65,
    seasons: ['autumn', 'spring'],
  },
  oats: {
    name: 'Oats',
    growingDays: 90,
    baseYield: 2.8,
    basePrice: 200,
    optimalTempMin: 5,
    optimalTempMax: 20,
    optimalPHMin: 5.5,
    optimalPHMax: 7.0,
    optimalHumidityMin: 50,
    optimalHumidityMax: 75,
    seasons: ['spring'],
  },
  cotton: {
    name: 'Cotton',
    growingDays: 180,
    baseYield: 2.5,
    basePrice: 1600,
    optimalTempMin: 20,
    optimalTempMax: 37,
    optimalPHMin: 5.8,
    optimalPHMax: 8.0,
    optimalHumidityMin: 40,
    optimalHumidityMax: 60,
    seasons: ['spring', 'summer'],
  },
  potatoes: {
    name: 'Potatoes',
    growingDays: 100,
    baseYield: 40.0,
    basePrice: 300,
    optimalTempMin: 10,
    optimalTempMax: 25,
    optimalPHMin: 5.0,
    optimalPHMax: 6.5,
    optimalHumidityMin: 60,
    optimalHumidityMax: 80,
    seasons: ['spring'],
  },
  tomatoes: {
    name: 'Tomatoes',
    growingDays: 80,
    baseYield: 70.0,
    basePrice: 850,
    optimalTempMin: 18,
    optimalTempMax: 30,
    optimalPHMin: 6.0,
    optimalPHMax: 6.8,
    optimalHumidityMin: 50,
    optimalHumidityMax: 70,
    seasons: ['spring', 'summer'],
  },
  sorghum: {
    name: 'Sorghum',
    growingDays: 120,
    baseYield: 4.0,
    basePrice: 170,
    optimalTempMin: 20,
    optimalTempMax: 38,
    optimalPHMin: 5.5,
    optimalPHMax: 8.5,
    optimalHumidityMin: 30,
    optimalHumidityMax: 60,
    seasons: ['spring', 'summer'],
  },
  sugarcane: {
    name: 'Sugarcane',
    growingDays: 365,
    baseYield: 75.0,
    basePrice: 50,
    optimalTempMin: 22,
    optimalTempMax: 38,
    optimalPHMin: 5.0,
    optimalPHMax: 8.5,
    optimalHumidityMin: 60,
    optimalHumidityMax: 90,
    seasons: ['spring'],
  },
  lettuce: {
    name: 'Lettuce',
    growingDays: 55,
    baseYield: 35.0,
    basePrice: 1200,
    optimalTempMin: 7,
    optimalTempMax: 20,
    optimalPHMin: 6.0,
    optimalPHMax: 7.0,
    optimalHumidityMin: 50,
    optimalHumidityMax: 70,
    seasons: ['spring', 'autumn'],
  },
  carrots: {
    name: 'Carrots',
    growingDays: 80,
    baseYield: 40.0,
    basePrice: 700,
    optimalTempMin: 10,
    optimalTempMax: 25,
    optimalPHMin: 6.0,
    optimalPHMax: 6.8,
    optimalHumidityMin: 50,
    optimalHumidityMax: 70,
    seasons: ['spring', 'autumn'],
  },
  onions: {
    name: 'Onions',
    growingDays: 100,
    baseYield: 50.0,
    basePrice: 400,
    optimalTempMin: 12,
    optimalTempMax: 28,
    optimalPHMin: 6.0,
    optimalPHMax: 7.0,
    optimalHumidityMin: 40,
    optimalHumidityMax: 65,
    seasons: ['spring', 'autumn'],
  },
  cabbage: {
    name: 'Cabbage',
    growingDays: 90,
    baseYield: 50.0,
    basePrice: 350,
    optimalTempMin: 10,
    optimalTempMax: 22,
    optimalPHMin: 6.0,
    optimalPHMax: 7.5,
    optimalHumidityMin: 60,
    optimalHumidityMax: 80,
    seasons: ['spring', 'autumn'],
  },
  spinach: {
    name: 'Spinach',
    growingDays: 45,
    baseYield: 20.0,
    basePrice: 1500,
    optimalTempMin: 5,
    optimalTempMax: 20,
    optimalPHMin: 6.0,
    optimalPHMax: 7.5,
    optimalHumidityMin: 50,
    optimalHumidityMax: 70,
    seasons: ['spring', 'autumn', 'winter'],
  },
  peppers: {
    name: 'Peppers',
    growingDays: 75,
    baseYield: 25.0,
    basePrice: 900,
    optimalTempMin: 18,
    optimalTempMax: 32,
    optimalPHMin: 6.0,
    optimalPHMax: 7.0,
    optimalHumidityMin: 50,
    optimalHumidityMax: 70,
    seasons: ['spring', 'summer'],
  },
  cucumbers: {
    name: 'Cucumbers',
    growingDays: 60,
    baseYield: 40.0,
    basePrice: 600,
    optimalTempMin: 18,
    optimalTempMax: 30,
    optimalPHMin: 6.0,
    optimalPHMax: 7.0,
    optimalHumidityMin: 60,
    optimalHumidityMax: 80,
    seasons: ['spring', 'summer'],
  },
  strawberries: {
    name: 'Strawberries',
    growingDays: 90,
    baseYield: 20.0,
    basePrice: 3000,
    optimalTempMin: 10,
    optimalTempMax: 26,
    optimalPHMin: 5.5,
    optimalPHMax: 6.5,
    optimalHumidityMin: 60,
    optimalHumidityMax: 80,
    seasons: ['spring'],
  },
  grapes: {
    name: 'Grapes',
    growingDays: 170,
    baseYield: 15.0,
    basePrice: 1800,
    optimalTempMin: 15,
    optimalTempMax: 35,
    optimalPHMin: 5.5,
    optimalPHMax: 7.0,
    optimalHumidityMin: 40,
    optimalHumidityMax: 60,
    seasons: ['spring'],
  },
};

// Country-to-currency mapping for common agricultural regions
const CURRENCY_MAP: Record<string, { symbol: string; code: string; rate: number }> = {
  IN: { symbol: '₹', code: 'INR', rate: 83.5 },
  US: { symbol: '$', code: 'USD', rate: 1 },
  GB: { symbol: '£', code: 'GBP', rate: 0.79 },
  EU: { symbol: '€', code: 'EUR', rate: 0.92 },
  DE: { symbol: '€', code: 'EUR', rate: 0.92 },
  FR: { symbol: '€', code: 'EUR', rate: 0.92 },
  IT: { symbol: '€', code: 'EUR', rate: 0.92 },
  ES: { symbol: '€', code: 'EUR', rate: 0.92 },
  JP: { symbol: '¥', code: 'JPY', rate: 155.0 },
  CN: { symbol: '¥', code: 'CNY', rate: 7.25 },
  BR: { symbol: 'R$', code: 'BRL', rate: 4.95 },
  AU: { symbol: 'A$', code: 'AUD', rate: 1.55 },
  CA: { symbol: 'C$', code: 'CAD', rate: 1.36 },
  RU: { symbol: '₽', code: 'RUB', rate: 92.0 },
  ZA: { symbol: 'R', code: 'ZAR', rate: 18.5 },
  NG: { symbol: '₦', code: 'NGN', rate: 1550 },
  KE: { symbol: 'KSh', code: 'KES', rate: 155 },
  MX: { symbol: 'Mex$', code: 'MXN', rate: 17.2 },
  AR: { symbol: '$', code: 'ARS', rate: 870 },
  PK: { symbol: '₨', code: 'PKR', rate: 280 },
  BD: { symbol: '৳', code: 'BDT', rate: 110 },
  TH: { symbol: '฿', code: 'THB', rate: 35.5 },
  VN: { symbol: '₫', code: 'VND', rate: 24500 },
  ID: { symbol: 'Rp', code: 'IDR', rate: 15700 },
  PH: { symbol: '₱', code: 'PHP', rate: 56.5 },
  EG: { symbol: 'E£', code: 'EGP', rate: 47.0 },
};

// ===== IN-MEMORY CACHE =====
// Cache key: "lat,lng" rounded to 2 decimal places (~1km precision)
const climateCache = new Map<string, ClimateData>();
const soilCache = new Map<string, SoilData>();
const locationCache = new Map<string, LocationInfo>();
const airQualityCache = new Map<string, AirQualityData>();
const climateTrendsCache = new Map<string, ClimateTrendsData>();
const mandiCache = new Map<string, MandiPriceSeries | null>();

function coordKey(lat: number, lng: number): string {
  return `${Math.round(lat * 100) / 100},${Math.round(lng * 100) / 100}`;
}

// Fetch location info using reverse geocoding (free, no API key)
export async function fetchLocationInfo(lat: number, lng: number): Promise<LocationInfo> {
  const key = coordKey(lat, lng);
  const cached = locationCache.get(key);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=5&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'TerraLearn/1.0 (agricultural-simulator)',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch location info');
    }

    const data = await response.json();
    const countryCode = data.address?.country_code?.toUpperCase() || 'US';
    const country = data.address?.country || 'United States';

    const currency = CURRENCY_MAP[countryCode] || CURRENCY_MAP['US'];

    const result = {
      country,
      countryCode,
      currencySymbol: currency.symbol,
      currencyCode: currency.code,
      exchangeRate: currency.rate,
    };
    locationCache.set(key, result);
    return result;
  } catch (error) {
    console.error('Location info error:', error);
    return {
      country: 'Unknown',
      countryCode: 'US',
      currencySymbol: '$',
      currencyCode: 'USD',
      exchangeRate: 1,
    };
  }
}

// Fetch climate data from Open-Meteo with monthly averages for the growing period
export async function fetchClimateData(lat: number, lng: number, plantingDate?: Date, growingDays?: number): Promise<ClimateData> {
  const key = coordKey(lat, lng);
  const cached = climateCache.get(key);
  if (cached) return cached;

  try {
    // If we have planting date and growing days, get historical averages for the growing period
    if (plantingDate && growingDays) {
      const startMonth = plantingDate.getMonth() + 1;
      const harvestDate = new Date(plantingDate);
      harvestDate.setDate(harvestDate.getDate() + growingDays);
      const endMonth = harvestDate.getMonth() + 1;

      // Use climate API for monthly averages (1991-2020 normals)
      const monthsParam = [];
      let m = startMonth;
      const visited = new Set<number>();
      while (!visited.has(m)) {
        visited.add(m);
        monthsParam.push(m);
        if (m === endMonth) break;
        m = m === 12 ? 1 : m + 1;
      }

      try {
        const climateResponse = await fetch(
          `https://climate-api.open-meteo.com/v1/climate?latitude=${lat}&longitude=${lng}&models=EC_Earth3P_HR&monthly=temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean&start_date=2020-01-01&end_date=2020-12-31`
        );

        if (climateResponse.ok) {
          const climateData = await climateResponse.json();
          const monthly = climateData.monthly;
          if (monthly && monthly.temperature_2m_mean) {
            // Average the months in the growing season
            let tempSum = 0, precipSum = 0, humiditySum = 0, count = 0;
            for (const month of monthsParam) {
              const idx = month - 1;
              if (idx < monthly.temperature_2m_mean.length) {
                tempSum += monthly.temperature_2m_mean[idx] || 0;
                precipSum += (monthly.precipitation_sum?.[idx] || 0);
                humiditySum += (monthly.relative_humidity_2m_mean?.[idx] || 50);
                count++;
              }
            }
            if (count > 0) {
              const result = {
                temperature: Math.round((tempSum / count) * 10) / 10,
                precipitation: Math.round((precipSum / count) * 10) / 10,
                humidity: Math.round(humiditySum / count),
              };
              climateCache.set(key, result);
              return result;
            }
          }
        }
      } catch {
        // Fall through to current weather
      }
    }

    // Fallback: use current weather
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation&temperature_unit=celsius`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch climate data');
    }

    const data = await response.json();

    const result = {
      temperature: Math.round(data.current.temperature_2m * 10) / 10,
      precipitation: Math.round((data.current.precipitation || 0) * 10) / 10,
      humidity: Math.round(data.current.relative_humidity_2m),
    };
    climateCache.set(key, result);
    return result;
  } catch (error) {
    console.error('Climate API error:', error);
    throw new Error('Unable to fetch climate data');
  }
}

// Fetch air quality data from Open-Meteo Air Quality API
export async function fetchAirQualityData(lat: number, lng: number): Promise<AirQualityData> {
  const key = coordKey(lat, lng);
  const cached = airQualityCache.get(key);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&hourly=pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,us_aqi&current=pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,us_aqi&timezone=auto`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch air quality data');
    }

    const data = await response.json();
    const hourly = data.hourly || {};

    const lastIdx = hourly.time?.length ? hourly.time.length - 1 : 0;

    const currentData = {
      pm2_5: Math.round((data.current?.pm2_5 ?? hourly.pm2_5?.[lastIdx] ?? 0) * 10) / 10,
      pm10: Math.round((data.current?.pm10 ?? hourly.pm10?.[lastIdx] ?? 0) * 10) / 10,
      ozone: Math.round((data.current?.ozone ?? hourly.ozone?.[lastIdx] ?? 0) * 10) / 10,
      nitrogenDioxide: Math.round((data.current?.nitrogen_dioxide ?? hourly.nitrogen_dioxide?.[lastIdx] ?? 0) * 10) / 10,
      sulphurDioxide: Math.round((data.current?.sulphur_dioxide ?? hourly.sulphur_dioxide?.[lastIdx] ?? 0) * 10) / 10,
      carbonMonoxide: Math.round((data.current?.carbon_monoxide ?? hourly.carbon_monoxide?.[lastIdx] ?? 0) * 10) / 10,
      usAqi: Math.round(data.current?.us_aqi ?? hourly.us_aqi?.[lastIdx] ?? 0),
    };

    const hourlyData = {
      time: hourly.time || [],
      pm2_5: (hourly.pm2_5 || []).map((v: number | null) => (v != null ? Math.round(v * 10) / 10 : 0)),
      pm10: (hourly.pm10 || []).map((v: number | null) => (v != null ? Math.round(v * 10) / 10 : 0)),
      ozone: (hourly.ozone || []).map((v: number | null) => (v != null ? Math.round(v * 10) / 10 : 0)),
      nitrogenDioxide: (hourly.nitrogen_dioxide || []).map((v: number | null) => (v != null ? Math.round(v * 10) / 10 : 0)),
      sulphurDioxide: (hourly.sulphur_dioxide || []).map((v: number | null) => (v != null ? Math.round(v * 10) / 10 : 0)),
      carbonMonoxide: (hourly.carbon_monoxide || []).map((v: number | null) => (v != null ? Math.round(v * 10) / 10 : 0)),
      usAqi: (hourly.us_aqi || []).map((v: number | null) => (v != null ? Math.round(v) : 0)),
    };

    const result: AirQualityData = {
      current: currentData,
      hourly: hourlyData,
    };

    airQualityCache.set(key, result);
    return result;
  } catch (error) {
    console.error('Air Quality API error:', error);
    throw new Error('Unable to fetch air quality data');
  }
}

// Fetch historical climate trends for the past 5 years from Open-Meteo Archive API
export async function fetchClimateTrends(lat: number, lng: number): Promise<ClimateTrendsData> {
  const key = coordKey(lat, lng);
  const cached = climateTrendsCache.get(key);
  if (cached) return cached;

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 5);

    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);

    const response = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startStr}&end_date=${endStr}&daily=temperature_2m_mean,precipitation_sum&timezone=auto`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch climate trends');
    }

    const data = await response.json();
    const daily = data.daily || {};

    const result: ClimateTrendsData = {
      daily: {
        time: daily.time || [],
        temperature2mMean: (daily.temperature_2m_mean || []).map((v: number | null) => (v != null ? Math.round(v * 10) / 10 : 0)),
        precipitationSum: (daily.precipitation_sum || []).map((v: number | null) => (v != null ? Math.round(v * 10) / 10 : 0)),
      },
    };

    climateTrendsCache.set(key, result);
    return result;
  } catch (error) {
    console.error('Climate Trends API error:', error);
    throw new Error('Unable to fetch climate trends');
  }
}


// ===================== AGMARKNET MANDI PRICES =====================
// Real daily mandi (wholesale market) prices from data.gov.in — resource
// 9ef84268-d588-465a-a308-a864a43d0070 ("Variety-wise Daily Market Prices").
// The API key (VITE_AGMARKNET_API_KEY) is bundled into the client; a free key
// is fine for this. The endpoint rate-limits and frequently returns no rows for
// a given commodity, so every failure path returns null and callers fall back
// to the static reference price.

// CROP_DATABASE key -> Agmarknet commodity name.
export const CROP_TO_AGMARKNET_COMMODITY: Record<string, string> = {
  wheat: 'Wheat',
  rice: 'Paddy(Dhan)(Common)',
  corn: 'Maize',
  soybeans: 'Soyabean',
  barley: 'Barley',
  cotton: 'Cotton',
  potatoes: 'Potato',
  tomatoes: 'Tomato',
  onions: 'Onion',
  sorghum: 'Jowar(Sorghum)',
  sugarcane: 'Sugarcane',
  cabbage: 'Cabbage',
  carrots: 'Carrot',
  spinach: 'Spinach',
  peppers: 'Green Chilli',
  cucumbers: 'Cucumbar(Kheera)',
  grapes: 'Grapes',
  lettuce: 'Lettuce',
  strawberries: 'Strawberry',
  oats: 'Oats',
};

export interface MandiPricePoint {
  date: string; // ISO YYYY-MM-DD
  modalPricePerTon: number; // INR / tonne
  market: string;
}

export interface MandiPriceSeries {
  commodity: string;
  points: MandiPricePoint[]; // chronological
  latestPerTon: number;
  trailingAvgPerTon: number; // mean over the window, excluding the latest day
  trendPct: number; // (latest - trailingAvg) / trailingAvg * 100, rounded
}

export async function fetchMandiPrices(
  cropName: string,
  opts?: { state?: string; days?: number },
): Promise<MandiPriceSeries | null> {
  const key = import.meta.env.VITE_AGMARKNET_API_KEY as string | undefined;
  const commodity = CROP_TO_AGMARKNET_COMMODITY[cropName.toLowerCase()];
  if (!key || !commodity) return null;

  const cacheKey = `${commodity}|${opts?.state ?? ''}`;
  if (mandiCache.has(cacheKey)) return mandiCache.get(cacheKey) ?? null;

  try {
    const params = new URLSearchParams({
      'api-key': key,
      format: 'json',
      limit: '400',
      'filters[commodity]': commodity,
    });
    if (opts?.state) params.set('filters[state]', opts.state);

    const response = await fetch(
      `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?${params.toString()}`,
    );
    if (!response.ok) throw new Error(`Agmarknet HTTP ${response.status}`);

    const data = await response.json();
    const rows: Array<Record<string, string>> = data.records ?? [];

    const points = rows
      .map((r) => ({
        // arrival_date is "DD/MM/YYYY"
        date: String(r.arrival_date ?? '').split('/').reverse().join('-'),
        modalPricePerTon: Number(r.modal_price) * 10, // INR/quintal -> INR/tonne
        market: r.market ?? '',
      }))
      .filter((p) => p.date.length === 10 && Number.isFinite(p.modalPricePerTon) && p.modalPricePerTon > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (points.length === 0) {
      mandiCache.set(cacheKey, null);
      return null;
    }

    const windowPoints = points.slice(-(opts?.days ?? 30));
    const latest = windowPoints[windowPoints.length - 1].modalPricePerTon;
    const prior = windowPoints.slice(0, -1);
    const trailingAvg = prior.length
      ? prior.reduce((sum, p) => sum + p.modalPricePerTon, 0) / prior.length
      : latest;

    const series: MandiPriceSeries = {
      commodity,
      points: windowPoints,
      latestPerTon: Math.round(latest),
      trailingAvgPerTon: Math.round(trailingAvg),
      trendPct: trailingAvg ? Math.round(((latest - trailingAvg) / trailingAvg) * 100) : 0,
    };
    mandiCache.set(cacheKey, series);
    return series;
  } catch (error) {
    console.warn('Agmarknet fetch failed, falling back to reference price:', error);
    mandiCache.set(cacheKey, null);
    return null;
  }
}

// Deterministic hash-seeded PRNG. The same rounded coordinate always produces
// the same stream, so the estimated-soil fallback below is stable per pin
// rather than reshuffling on every call.
function seededRandom(lat: number, lng: number): () => number {
  const str = `${Math.round(lat * 1000)},${Math.round(lng * 1000)}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fetch real soil data from ISRIC SoilGrids API (free, no API key required)
export async function fetchSoilData(lat: number, lng: number): Promise<SoilData> {
  const key = coordKey(lat, lng);
  const cached = soilCache.get(key);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lng}&lat=${lat}&property=phh2o&property=nitrogen&property=soc&depth=0-5cm&value=mean`
    );

    if (response.ok) {
      const data = await response.json();
      const properties = data.properties?.layers || [];

      let pH = 6.5;
      let nitrogen = 40;
      let phosphorus = 25;

      for (const layer of properties) {
        const meanValue = layer.depths?.[0]?.values?.mean;
        if (layer.name === 'phh2o' && meanValue != null) {
          pH = Math.round((meanValue / 10) * 10) / 10;
        }
        if (layer.name === 'nitrogen' && meanValue != null) {
          nitrogen = Math.round(meanValue / 10);
        }
        if (layer.name === 'soc' && meanValue != null) {
          phosphorus = Math.round(meanValue / 20);
        }
      }

      const potassium = Math.round(100 + (nitrogen * 1.5) + (phosphorus * 2));

      const result: SoilData = { pH, nitrogen, phosphorus, potassium, source: 'isric' };
      soilCache.set(key, result);
      return result;
    }

    throw new Error('SoilGrids unavailable');
  } catch (error) {
    console.warn('SoilGrids API fallback, using deterministic heuristic soil data:', error);
    const absLat = Math.abs(lat);
    // Deterministic, coordinate-seeded — the same pin always resolves to the
    // same estimated profile (no Math.random reshuffle between calls).
    const rand = seededRandom(lat, lng);

    let pH: number;
    let nitrogen: number;
    let phosphorus: number;
    let potassium: number;

    if (absLat < 10) {
      pH = 5.2 + rand() * 0.8;
      nitrogen = 45 + rand() * 30;
      phosphorus = 10 + rand() * 15;
      potassium = 80 + rand() * 60;
    } else if (absLat < 30) {
      pH = 5.8 + rand() * 1.0;
      nitrogen = 35 + rand() * 25;
      phosphorus = 15 + rand() * 20;
      potassium = 120 + rand() * 80;
    } else if (absLat < 50) {
      pH = 6.2 + rand() * 1.2;
      nitrogen = 50 + rand() * 40;
      phosphorus = 25 + rand() * 25;
      potassium = 150 + rand() * 100;
    } else {
      pH = 4.8 + rand() * 1.5;
      nitrogen = 20 + rand() * 20;
      phosphorus = 8 + rand() * 12;
      potassium = 60 + rand() * 50;
    }

    const fallback: SoilData = {
      pH: Math.round(pH * 10) / 10,
      nitrogen: Math.round(nitrogen),
      phosphorus: Math.round(phosphorus),
      potassium: Math.round(potassium),
      source: 'estimated',
    };
    soilCache.set(key, fallback);
    return fallback;
  }
}

// Determine the season for a given date at a given latitude
export function getSeason(date: Date, lat: number): 'spring' | 'summer' | 'autumn' | 'winter' {
  const month = date.getMonth();
  const isSouthern = lat < 0;

  let season: 'spring' | 'summer' | 'autumn' | 'winter';
  if (month >= 2 && month <= 4) season = 'spring';
  else if (month >= 5 && month <= 7) season = 'summer';
  else if (month >= 8 && month <= 10) season = 'autumn';
  else season = 'winter';

  if (isSouthern) {
    const flip: Record<string, 'spring' | 'summer' | 'autumn' | 'winter'> = {
      spring: 'autumn',
      summer: 'winter',
      autumn: 'spring',
      winter: 'summer',
    };
    season = flip[season];
  }

  return season;
}

export function getSeasonName(season: string): string {
  return season.charAt(0).toUpperCase() + season.slice(1);
}

// Suggest best crops for given environmental conditions and season
export function suggestCrops(
  climate: ClimateData,
  soil: SoilData,
  plantingDate: Date,
  lat: number
): { crop: CropInfo; score: number; reasons: string[] }[] {
  const season = getSeason(plantingDate, lat);
  const absLat = Math.abs(lat);

  const suggestions: { crop: CropInfo; score: number; reasons: string[] }[] = [];

  // Extreme latitude — no crops are viable
  if (absLat > 70) {
    return []; // No suggestions for polar regions
  }

  for (const [, cropInfo] of Object.entries(CROP_DATABASE)) {
    let score = 0;
    const reasons: string[] = [];

    // Latitude penalty
    let latPenalty = 0;
    if (absLat > 65) latPenalty = 60;
    else if (absLat > 60) latPenalty = 40;
    else if (absLat > 55) latPenalty = 20;

    // Season alignment (major factor)
    if (cropInfo.seasons.includes(season)) {
      score += 35;
      reasons.push(`Ideal for ${getSeasonName(season)} planting`);
    } else {
      const seasonOrder: Array<'spring' | 'summer' | 'autumn' | 'winter'> = ['spring', 'summer', 'autumn', 'winter'];
      const cropSeasonIndices = cropInfo.seasons.map(s => seasonOrder.indexOf(s));
      const currentIndex = seasonOrder.indexOf(season);
      const minDistance = Math.min(...cropSeasonIndices.map(i => {
        const d = Math.abs(i - currentIndex);
        return Math.min(d, 4 - d);
      }));
      if (minDistance === 1) {
        score += 15;
        reasons.push(`Adjacent season — not ideal but possible`);
      } else {
        score += 0;
        reasons.push(`Wrong season for this crop`);
      }
    }

    // Temperature alignment
    if (climate.temperature >= cropInfo.optimalTempMin && climate.temperature <= cropInfo.optimalTempMax) {
      score += 25;
      reasons.push(`Temperature ${climate.temperature}°C is within optimal range`);
    } else {
      const tempDist = Math.min(
        Math.abs(climate.temperature - cropInfo.optimalTempMin),
        Math.abs(climate.temperature - cropInfo.optimalTempMax)
      );
      const tempScore = Math.max(0, 25 - tempDist * 3);
      score += tempScore;
      if (tempDist > 5) {
        reasons.push(`Temperature ${climate.temperature}°C is outside optimal range`);
      }
    }

    // Frost check
    if (climate.temperature < 0) {
      score -= 30;
      reasons.push(`Freezing temperatures — most crops cannot survive`);
    } else if (climate.temperature < 5 && cropInfo.optimalTempMin > 10) {
      score -= 15;
    }

    // Soil pH
    if (soil.pH >= cropInfo.optimalPHMin && soil.pH <= cropInfo.optimalPHMax) {
      score += 20;
      reasons.push(`Soil pH ${soil.pH} is within optimal range`);
    } else {
      const phDist = Math.min(
        Math.abs(soil.pH - cropInfo.optimalPHMin),
        Math.abs(soil.pH - cropInfo.optimalPHMax)
      );
      score += Math.max(0, 20 - phDist * 8);
    }

    // Humidity
    if (climate.humidity >= cropInfo.optimalHumidityMin && climate.humidity <= cropInfo.optimalHumidityMax) {
      score += 15;
      reasons.push(`Humidity ${climate.humidity}% suits this crop well`);
    } else {
      const humDist = Math.min(
        Math.abs(climate.humidity - cropInfo.optimalHumidityMin),
        Math.abs(climate.humidity - cropInfo.optimalHumidityMax)
      );
      score += Math.max(0, 15 - humDist);
    }

    // Apply latitude penalty
    score -= latPenalty;
    score = Math.max(0, score);

    // Only include crops with a minimum viability
    if (score >= 15) {
      suggestions.push({ crop: cropInfo, score, reasons: reasons.filter(r => !r.includes('Wrong season')) });
    }
  }

  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// Calculate harvest date based on crop growing days
export function calculateHarvestDate(plantingDate: Date, crop: string): Date {
  const cropInfo = CROP_DATABASE[crop.toLowerCase()];
  const growingDays = cropInfo?.growingDays || 100;
  const harvestDate = new Date(plantingDate);
  harvestDate.setDate(harvestDate.getDate() + growingDays);
  return harvestDate;
}

// Calculate crop yield with realistic agricultural modeling
export interface SimulationResult {
  yield: number;
  pricePerUnit: number;
  profit: number;
  harvestDate: Date;
  growingDays: number;
  grossRevenue: number;
  totalCosts: number;
  areaHectares: number;
  warnings: string[];
  viabilityScore: number; // 0-100
  // Where pricePerUnit came from:
  //   'buyer'     — a real nearby demand listing (Saath)
  //   'agmarknet' — the latest mandi modal price for this commodity
  //   'reference' — the static CROP_DATABASE basePrice + seasonality/random model
  priceSource: 'buyer' | 'agmarknet' | 'reference';
  referencePricePerUnit: number; // the non-buyer reference (mandi or static), local currency / ton
  mandiTrendPct?: number; // recent mandi trend, when a mandi price was used
  buyerName?: string;
  buyerDistanceKm?: number;
}

export function calculateYield(
  crop: string,
  plantingDate: Date,
  climate: ClimateData,
  soil: SoilData,
  lat: number,
  exchangeRate: number = 1,
  areaHectares: number = 1,
  // Optional market signals, both in LOCAL currency per tonne. Supplied by the
  // caller only for India pins (where exchangeRate is the INR rate).
  marketOverride?: { pricePerTon: number; buyerName: string; distanceKm: number },
  mandiRef?: { pricePerTon: number; trendPct: number },
): SimulationResult {
  const cropKey = crop.toLowerCase();
  const cropInfo = CROP_DATABASE[cropKey];
  const warnings: string[] = [];

  const baseYield = cropInfo?.baseYield || 5.0;
  const basePrice = cropInfo?.basePrice || 300;
  const growingDays = cropInfo?.growingDays || 100;
  const absLat = Math.abs(lat);

  // ========== 1. EXTREME LATITUDE PENALTY ==========
  // Almost nothing grows above 65° latitude (Arctic/Antarctic circles)
  let latitudeFactor = 1.0;
  if (absLat > 70) {
    latitudeFactor = 0.0; // Effectively impossible — permafrost, no growing season
    warnings.push('Location is in a polar region — agriculture is not viable');
  } else if (absLat > 65) {
    latitudeFactor = 0.05;
    warnings.push('Extreme latitude — very limited growing season, near-permafrost conditions');
  } else if (absLat > 60) {
    latitudeFactor = 0.2;
    warnings.push('High latitude — short growing season and frost risk');
  } else if (absLat > 55) {
    latitudeFactor = 0.6;
    warnings.push('Northern/Southern latitude — reduced growing season');
  }

  // ========== 2. TEMPERATURE FACTOR (Gaussian curve) ==========
  let tempFactor = 1.0;
  if (cropInfo) {
    const optMid = (cropInfo.optimalTempMin + cropInfo.optimalTempMax) / 2;
    const optRange = (cropInfo.optimalTempMax - cropInfo.optimalTempMin) / 2;
    const deviation = Math.abs(climate.temperature - optMid);

    if (climate.temperature >= cropInfo.optimalTempMin && climate.temperature <= cropInfo.optimalTempMax) {
      // Within optimal range — small Gaussian penalty from center
      tempFactor = 0.85 + 0.15 * Math.exp(-0.5 * Math.pow(deviation / optRange, 2));
    } else if (deviation <= optRange * 2) {
      // Near-optimal — moderate penalty
      tempFactor = 0.3 + 0.55 * Math.exp(-0.5 * Math.pow(deviation / optRange, 2));
    } else {
      // Far from optimal — severe penalty
      tempFactor = Math.max(0.0, 0.15 * Math.exp(-0.5 * Math.pow(deviation / (optRange * 1.5), 2)));
    }

    // Frost kill: if average temp is below 0°C, most crops die
    if (climate.temperature < 0) {
      tempFactor *= 0.05;
      warnings.push('Freezing temperatures — crop survival extremely unlikely');
    } else if (climate.temperature < 5 && cropInfo.optimalTempMin > 10) {
      tempFactor *= 0.15;
      warnings.push('Temperatures far too cold for this warm-season crop');
    }

    // Heat stress
    if (climate.temperature > cropInfo.optimalTempMax + 10) {
      tempFactor *= 0.2;
      warnings.push('Extreme heat stress — crop damage likely');
    }
  } else {
    tempFactor = Math.max(0, 1 - Math.abs(climate.temperature - 20) / 30);
  }

  // ========== 3. SEASONAL ALIGNMENT FACTOR ==========
  let seasonFactor = 1.0;
  if (cropInfo) {
    const season = getSeason(plantingDate, lat);
    if (cropInfo.seasons.includes(season)) {
      seasonFactor = 1.0;
    } else {
      // Adjacent season = moderate penalty, opposite season = severe
      const seasonOrder: Array<'spring' | 'summer' | 'autumn' | 'winter'> = ['spring', 'summer', 'autumn', 'winter'];
      const cropSeasonIndices = cropInfo.seasons.map(s => seasonOrder.indexOf(s));
      const currentIndex = seasonOrder.indexOf(season);
      const minDistance = Math.min(...cropSeasonIndices.map(i => {
        const d = Math.abs(i - currentIndex);
        return Math.min(d, 4 - d);
      }));
      if (minDistance === 1) {
        seasonFactor = 0.55;
        warnings.push(`Suboptimal planting season — ${getSeasonName(season)} is not ideal for ${cropInfo.name}`);
      } else {
        seasonFactor = 0.15;
        warnings.push(`Wrong planting season — ${cropInfo.name} should be planted in ${cropInfo.seasons.map(getSeasonName).join(' or ')}`);
      }
    }
  }

  // ========== 4. PRECIPITATION & HUMIDITY ==========
  let waterFactor = 1.0;
  if (cropInfo) {
    // Check humidity alignment
    if (climate.humidity >= cropInfo.optimalHumidityMin && climate.humidity <= cropInfo.optimalHumidityMax) {
      waterFactor = 1.0;
    } else {
      const humDist = climate.humidity < cropInfo.optimalHumidityMin
        ? cropInfo.optimalHumidityMin - climate.humidity
        : climate.humidity - cropInfo.optimalHumidityMax;
      waterFactor = Math.max(0.2, 1 - humDist / 60);
    }

    // Extreme aridity
    if (climate.humidity < 15 && climate.precipitation < 2) {
      waterFactor *= 0.3;
      warnings.push('Extremely arid conditions — insufficient moisture for crop growth');
    }
  } else {
    waterFactor = 0.7 + (climate.humidity / 100) * 0.3;
  }

  // ========== 5. SOIL pH FACTOR ==========
  let pHFactor = 1.0;
  if (cropInfo) {
    if (soil.pH >= cropInfo.optimalPHMin && soil.pH <= cropInfo.optimalPHMax) {
      pHFactor = 1.0;
    } else {
      const phDist = soil.pH < cropInfo.optimalPHMin
        ? cropInfo.optimalPHMin - soil.pH
        : soil.pH - cropInfo.optimalPHMax;
      pHFactor = Math.max(0.2, 1 - phDist / 2.5);
      if (phDist > 1.5) {
        warnings.push(`Soil pH ${soil.pH} is far from optimal (${cropInfo.optimalPHMin}–${cropInfo.optimalPHMax})`);
      }
    }
  } else {
    pHFactor = Math.max(0.3, 1 - Math.abs(soil.pH - 6.8) / 3);
  }

  // ========== 6. NUTRIENT FACTOR ==========
  const nutrientFactor = (
    Math.min(soil.nitrogen / 80, 1.1) * 0.4 +
    Math.min(soil.phosphorus / 40, 1.1) * 0.3 +
    Math.min(soil.potassium / 180, 1.1) * 0.3
  );
  if (nutrientFactor < 0.5) {
    warnings.push('Poor soil nutrient levels — may require significant fertilization');
  }

  // ========== 7. GROWING DEGREE DAYS (GDD) APPROXIMATION ==========
  // Crops need accumulated heat units. If avg temp is low, they may not mature.
  let gddFactor = 1.0;
  if (cropInfo) {
    const baseTemp = Math.max(0, cropInfo.optimalTempMin - 5); // Base temperature for GDD
    const dailyGDD = Math.max(0, climate.temperature - baseTemp);
    const totalGDD = dailyGDD * growingDays;
    // Approximate required GDD (most crops need 1000-3000)
    const requiredGDD = growingDays * ((cropInfo.optimalTempMin + cropInfo.optimalTempMax) / 2 - baseTemp) * 0.8;
    gddFactor = Math.min(1.0, totalGDD / Math.max(requiredGDD, 1));
    if (gddFactor < 0.5) {
      warnings.push('Insufficient accumulated heat — crop may not reach maturity');
    }
  }

  // ========== COMBINE ALL FACTORS ==========
  const yieldMultiplier = latitudeFactor * tempFactor * seasonFactor * waterFactor * pHFactor * nutrientFactor * gddFactor;
  const finalYield = Math.round(baseYield * yieldMultiplier * areaHectares * 100) / 100;

  // ========== VIABILITY SCORE ==========
  const viabilityScore = Math.round(Math.min(100, yieldMultiplier * 100));

  // ========== HARVEST DATE ==========
  const harvestDate = new Date(plantingDate);
  // If conditions are poor, growth is slower
  const adjustedGrowingDays = Math.round(growingDays / Math.max(yieldMultiplier, 0.3));
  harvestDate.setDate(harvestDate.getDate() + Math.min(adjustedGrowingDays, growingDays * 3));

  // ========== PRICING ==========
  // Fully deterministic — no randomisation on any tier.
  // Reference price: a live mandi modal price when available, else the static
  // CROP_DATABASE basePrice converted to local currency.
  let referencePricePerUnit: number;
  let mandiTrendPct: number | undefined;
  if (mandiRef && mandiRef.pricePerTon > 0) {
    referencePricePerUnit = Math.round(mandiRef.pricePerTon);
    mandiTrendPct = mandiRef.trendPct;
  } else {
    referencePricePerUnit = Math.round(basePrice * exchangeRate);
  }

  // Actual price used: a real nearby buyer beats the reference; otherwise the
  // reference price itself (live mandi price, or the static base price).
  let finalPrice: number;
  let priceSource: SimulationResult['priceSource'];
  if (marketOverride && marketOverride.pricePerTon > 0) {
    finalPrice = Math.round(marketOverride.pricePerTon);
    priceSource = 'buyer';
  } else if (mandiRef && mandiRef.pricePerTon > 0) {
    finalPrice = referencePricePerUnit;
    priceSource = 'agmarknet';
  } else {
    finalPrice = referencePricePerUnit;
    priceSource = 'reference';
  }

  // ========== COSTS (more realistic) ==========
  const grossRevenue = Math.round(finalYield * finalPrice);
  // Base costs: seed, labor, equipment, irrigation, fertilizer
  // Fixed costs per hectare (in local currency): ~$800-1500/ha depending on crop
  const fixedCostPerHaUSD = cropInfo
    ? (cropInfo.basePrice > 1000 ? 1400 : cropInfo.basePrice > 500 ? 1000 : 700)
    : 800;
  const fixedCosts = Math.round(fixedCostPerHaUSD * exchangeRate * areaHectares);
  // Variable costs: 20% of revenue
  const variableCosts = Math.round(grossRevenue * 0.2);
  const totalCosts = fixedCosts + variableCosts;
  const profit = grossRevenue - totalCosts;

  return {
    yield: finalYield,
    pricePerUnit: finalPrice,
    profit,
    harvestDate,
    growingDays: Math.min(adjustedGrowingDays, growingDays * 3),
    grossRevenue,
    totalCosts,
    areaHectares,
    warnings,
    viabilityScore,
    priceSource,
    referencePricePerUnit,
    mandiTrendPct,
    buyerName: marketOverride?.buyerName,
    buyerDistanceKm: marketOverride?.distanceKm,
  };
}
