import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Navigation } from './Navigation';
import NavAuthControl from './saath/NavAuthControl';
import { MapView, type IfsConnection } from './MapView';
import { FarmSwitcher } from './FarmSwitcher';
import { useAssistantPageContext } from '@/lib/assistant/useAssistantPageContext';
import type { AssistantExtraContext } from '@/lib/assistant/types';
import { useIdentity } from '@/lib/identity/identity';
import { getMapPoints, getIfsLoops, nearbyDemandListings } from '@/lib/saath/queries';
import type { MapPointRow, IfsMatchRow, NearbyDemandRow } from '@/lib/saath/types';
import { CropSelector } from './CropSelector';
import { DateSelector } from './DateSelector';
import { MetricCard } from './MetricCard';
import { FinancialResults } from './FinancialResults';
import { CropSuggestions } from './CropSuggestions';
import { MarketSignal } from './MarketSignal';
import { SimulationStatus, type SimulationStep } from './SimulationStatus';
import { TrendChart } from './TrendChart';
import { EnvironmentalOutlook, type RiskBriefContext } from './EnvironmentalOutlook';
import { AdvisoryCard } from './AdvisoryCard';
import { paddyAdvisories } from '@/lib/advisories';
import { Button } from './ui/button';
import { getAqiSeverityBadge } from '@/lib/aqi';
import {
  relativeAge,
  soilProvenanceLabel,
  climateProvenanceLabel,
  SOIL_PK_DISCLAIMER,
} from '@/lib/dataProvenance';
import {
  Cloud,
  Droplets,
  Wind,
  Zap,
  Leaf,
  TestTube2,
  Sparkles,
  Globe,
  Tractor,
  MapPin,
  ArrowRight,
  TrendingUp,
  Activity,
  Gauge,
  AlertTriangle,
  RefreshCw,
  Users,
  Info,
} from 'lucide-react';
import {
  fetchClimateData,
  fetchSoilData,
  fetchLocationInfo,
  fetchAirQualityData,
  fetchClimateTrends,
  calculateYield,
  fetchMandiPrices,
  getSeason,
  CROP_DATABASE,
  type ClimateData,
  type SoilData,
  type LocationInfo,
  type SimulationResult,
  type CropInfo,
  type AirQualityData,
  type ClimateTrendsData,
  type MandiPriceSeries,
} from '@/lib/api';
import {
  suggestCropsWithCircular,
  demandRatePerTon,
  CROP_TO_SALE_CATEGORY,
  type CircularOpportunity,
} from '@/lib/cropEnterprise';
import { toast } from 'sonner';

function Home() {
  const navigate = useNavigate();
  const { activeFarmerId: farmerId, primaryFarm } = useIdentity();

  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [neighbours, setNeighbours] = useState<MapPointRow[]>([]);
  const [ifsRows, setIfsRows] = useState<IfsMatchRow[]>([]);
  const [selectedCrop, setSelectedCrop] = useState('');
  const [plantingDate, setPlantingDate] = useState<Date>();
  const [areaHectares, setAreaHectares] = useState<number>(1);
  const [areaUnit, setAreaUnit] = useState<'hectares' | 'acres'>('hectares');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStep, setSimulationStep] = useState<SimulationStep>('idle');

  const [climateData, setClimateData] = useState<ClimateData | null>(null);
  const [soilData, setSoilData] = useState<SoilData | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [results, setResults] = useState<SimulationResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  const [airQualityData, setAirQualityData] = useState<AirQualityData | null>(null);
  const [climateTrends, setClimateTrends] = useState<ClimateTrendsData | null>(null);
  const [isEnvLoading, setIsEnvLoading] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);
  // When the live-ish readings (weather, AQI) were last refreshed — drives the
  // "updated Xm ago" labels. Soil keeps its own `fetchedAt` on the payload.
  const [liveFetchedAt, setLiveFetchedAt] = useState<{ aq?: number; climate?: number }>({});
  const [isRefreshingLive, setIsRefreshingLive] = useState(false);

  const [cropSuggestions, setCropSuggestions] = useState<
    { crop: CropInfo; score: number; reasons: string[]; circular?: CircularOpportunity }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentSeason, setCurrentSeason] = useState('');
  const [demandMatches, setDemandMatches] = useState<NearbyDemandRow[]>([]);
  const [mandiSeries, setMandiSeries] = useState<MandiPriceSeries | null>(null);

  // Location snapshot: air quality + 5yr trends + current climate + soil.
  const loadEnvData = useCallback(async (lat: number, lng: number) => {
    setIsEnvLoading(true);
    setEnvError(null);
    const [aq, trends, climate, soil] = await Promise.allSettled([
      fetchAirQualityData(lat, lng),
      fetchClimateTrends(lat, lng),
      fetchClimateData(lat, lng),
      fetchSoilData(lat, lng),
    ]);
    const now = Date.now();
    if (aq.status === 'fulfilled') {
      setAirQualityData(aq.value);
      setLiveFetchedAt((s) => ({ ...s, aq: now }));
    }
    if (trends.status === 'fulfilled') setClimateTrends(trends.value);
    if (climate.status === 'fulfilled') {
      setClimateData(climate.value);
      setLiveFetchedAt((s) => ({ ...s, climate: now }));
    }
    if (soil.status === 'fulfilled') setSoilData(soil.value);
    if (aq.status === 'rejected' && trends.status === 'rejected') {
      setEnvError('Unable to fetch environmental data for this location.');
    }
    setIsEnvLoading(false);
  }, []);

  // Explicit / scheduled refresh of just the live-ish readings (weather + AQI).
  // Soil, 5-year trends and location keep their long cache TTLs and are not
  // re-fetched here.
  const refreshLiveEnv = useCallback(async () => {
    if (!position) return;
    const { lat, lng } = position;
    setIsRefreshingLive(true);
    const [aq, climate] = await Promise.allSettled([
      fetchAirQualityData(lat, lng, { force: true }),
      fetchClimateData(lat, lng, undefined, undefined, { force: true }),
    ]);
    const now = Date.now();
    if (aq.status === 'fulfilled') {
      setAirQualityData(aq.value);
      setLiveFetchedAt((s) => ({ ...s, aq: now }));
    }
    if (climate.status === 'fulfilled') {
      setClimateData(climate.value);
      setLiveFetchedAt((s) => ({ ...s, climate: now }));
    }
    setIsRefreshingLive(false);
  }, [position]);

  // Light background refresh while the tab is visible. Weather / AQI only.
  useEffect(() => {
    if (!position) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refreshLiveEnv();
    }, 15 * 60_000);
    return () => clearInterval(id);
  }, [position, refreshLiveEnv]);

  // Re-render once a minute so the "updated Xm ago" labels stay honest between
  // refreshes.
  const [, tickAgeLabels] = useState(0);
  useEffect(() => {
    if (!position) return;
    const id = setInterval(() => tickAgeLabels((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [position]);

  const handlePositionChange = useCallback(
    (lat: number, lng: number) => {
      setPosition({ lat, lng });
      setShowResults(false);
      setResults(null);
      setClimateData(null);
      setSoilData(null);
      setLiveFetchedAt({});
      setShowSuggestions(false);
      setCropSuggestions([]);
      setDemandMatches([]);
      setMandiSeries(null);
      setSimulationStep('idle');

      fetchLocationInfo(lat, lng)
        .then((info) => {
          setLocationInfo(info);
          toast.success(`Location: ${info.country} (${info.currencyCode})`);
        })
        .catch(() => setLocationInfo(null));

      loadEnvData(lat, lng);
    },
    [loadEnvData],
  );

  const refetchNeighbours = useCallback(() => {
    if (!farmerId) {
      setNeighbours([]);
      return;
    }
    getMapPoints(farmerId)
      .then(setNeighbours)
      .catch(() => setNeighbours([]));
  }, [farmerId]);

  const refetchIfs = useCallback(() => {
    if (!farmerId) {
      setIfsRows([]);
      return;
    }
    getIfsLoops(farmerId)
      .then(setIfsRows)
      .catch(() => setIfsRows([]));
  }, [farmerId]);

  useEffect(() => {
    refetchNeighbours();
    refetchIfs();
  }, [refetchNeighbours, refetchIfs]);

  const onFarmsChanged = useCallback(() => {
    refetchNeighbours();
    refetchIfs();
  }, [refetchNeighbours, refetchIfs]);

  // Start the dashboard on the farmer's primary farm (once), and pre-fill the
  // simulator with that farm's primary crop.
  const seededPinRef = useRef(false);
  useEffect(() => {
    if (seededPinRef.current || position || !primaryFarm) return;
    seededPinRef.current = true;
    handlePositionChange(primaryFarm.lat, primaryFarm.lng);
    const primaryCrop = primaryFarm.crops?.[0] ?? primaryFarm.primary_crop;
    if (primaryCrop) setSelectedCrop(primaryCrop);
  }, [primaryFarm, position, handlePositionChange]);

  const mapInitialView = useMemo(
    () =>
      primaryFarm
        ? { center: [primaryFarm.lat, primaryFarm.lng] as [number, number], zoom: 11 }
        : undefined,
    [primaryFarm],
  );

  // IFS circular-agriculture connections for the map (one line per neighbour + direction).
  const connections = useMemo<IfsConnection[]>(() => {
    if (!primaryFarm || ifsRows.length === 0) return [];
    const byKey = new Map<string, IfsConnection>();
    for (const r of ifsRows) {
      if (r.their_lat == null || r.their_lng == null) continue;
      const key = `${r.their_farmer_id}|${r.direction}`;
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.resources.includes(r.resource)) existing.resources.push(r.resource);
      } else {
        byKey.set(key, {
          fromLat: primaryFarm.lat,
          fromLng: primaryFarm.lng,
          toLat: r.their_lat,
          toLng: r.their_lng,
          direction: r.direction,
          theirName: r.their_farmer_name,
          resources: [r.resource],
        });
      }
    }
    return [...byKey.values()];
  }, [primaryFarm, ifsRows]);

  // Suggestion-first flow: once a pin has soil + climate AND a planting date is
  // picked, surface ranked crop suggestions (with circular-agriculture weighting)
  // before the user has chosen a crop or run a simulation.
  const autoSuggestions = useMemo(() => {
    if (!position || !climateData || !soilData || !plantingDate) return [];
    return suggestCropsWithCircular(
      climateData,
      soilData,
      plantingDate,
      position.lat,
      neighbours,
    );
  }, [position, climateData, soilData, plantingDate, neighbours]);

  const suggestionSeason = useMemo(
    () => (position && plantingDate ? getSeason(plantingDate, position.lat) : ''),
    [position, plantingDate],
  );

  const handleSimulate = async () => {
    if (!position || !selectedCrop || !plantingDate) {
      toast.error('Please complete all fields before simulating');
      return;
    }

    setIsSimulating(true);
    setShowResults(false);
    setResults(null);
    setShowSuggestions(false);
    setSimulationStep('locating');

    try {
      setSimulationStep('climate');
      const cropKey = selectedCrop.toLowerCase();
      const cropGrowingDays = CROP_DATABASE[cropKey]?.growingDays || 100;

      const [locInfo, climate, soil] = await Promise.all([
        locationInfo
          ? Promise.resolve(locationInfo)
          : fetchLocationInfo(position.lat, position.lng),
        fetchClimateData(position.lat, position.lng, plantingDate, cropGrowingDays),
        fetchSoilData(position.lat, position.lng),
      ]);

      if (!locationInfo) setLocationInfo(locInfo);
      setClimateData(climate);
      setSoilData(soil);

      // Market signals (India pins only — rates are INR, matching exchangeRate).
      let marketOverride:
        | { pricePerTon: number; buyerName: string; distanceKm: number }
        | undefined;
      let mandiRef: { pricePerTon: number; trendPct: number } | undefined;
      let demandRows: NearbyDemandRow[] = [];
      let series: MandiPriceSeries | null = null;
      if (locInfo.countryCode === 'IN') {
        series = await fetchMandiPrices(selectedCrop, { state: 'Karnataka' });
        if (series) mandiRef = { pricePerTon: series.latestPerTon, trendPct: series.trendPct };

        const saleCategory = CROP_TO_SALE_CATEGORY[selectedCrop.toLowerCase()];
        if (saleCategory) {
          try {
            demandRows = await nearbyDemandListings(
              position.lat,
              position.lng,
              saleCategory,
              100000,
            );
            for (const d of demandRows) {
              const perTon = demandRatePerTon(d.rate, d.unit);
              if (perTon) {
                marketOverride = {
                  pricePerTon: perTon,
                  buyerName: d.buyer_name,
                  distanceKm: Math.round(((d.distance_m ?? 0) / 1000) * 10) / 10,
                };
                break;
              }
            }
          } catch {
            /* silent — fall back to reference/mandi price */
          }
        }
      }
      setDemandMatches(demandRows);
      setMandiSeries(series);

      setSimulationStep('calculating');
      const hectares = areaUnit === 'acres' ? areaHectares * 0.404686 : areaHectares;
      const calculatedResults = calculateYield(
        selectedCrop,
        plantingDate,
        climate,
        soil,
        position.lat,
        locInfo.exchangeRate,
        hectares,
        marketOverride,
        mandiRef,
      );
      setResults(calculatedResults);

      const season = getSeason(plantingDate, position.lat);
      setCurrentSeason(season);
      const suggestions = suggestCropsWithCircular(
        climate,
        soil,
        plantingDate,
        position.lat,
        neighbours,
      );
      setCropSuggestions(suggestions);

      setSimulationStep('complete');

      setTimeout(() => {
        setShowResults(true);
        setShowSuggestions(true);
      }, 400);

      toast.success('Simulation completed successfully!');
    } catch (error) {
      setSimulationStep('error');
      toast.error('Failed to complete simulation. Please try again.');
      console.error('Simulation error:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSuggestionSelect = (cropName: string) => {
    setSelectedCrop(cropName);
    toast.success(`Selected ${cropName} — click Simulate to see results`);
  };

  const tempChartData = useMemo(() => {
    if (!climateTrends?.daily?.time) return [];
    return climateTrends.daily.time.map((time, i) => ({
      date: time,
      temperature: climateTrends.daily.temperature2mMean[i],
    }));
  }, [climateTrends]);

  const precipChartData = useMemo(() => {
    if (!climateTrends?.daily?.time) return [];
    return climateTrends.daily.time.map((time, i) => ({
      date: time,
      precipitation: climateTrends.daily.precipitationSum[i],
    }));
  }, [climateTrends]);

  const aqiChartData = useMemo(() => {
    if (!airQualityData?.hourly?.time) return [];
    return airQualityData.hourly.time.map((time, i) => ({
      time: time,
      pm2_5: airQualityData.hourly.pm2_5[i],
    }));
  }, [airQualityData]);

  const cropContext = useMemo(() => {
    if (!results || !selectedCrop || !plantingDate) return null;
    return {
      crop: selectedCrop,
      plantingDate: plantingDate.toISOString().split('T')[0],
      yieldEstimate: results.yield,
      viabilityScore: results.viabilityScore,
      profit: results.profit,
    };
  }, [results, selectedCrop, plantingDate]);

  // Always-present, refreshed context for the chat assistant — the current pin's
  // environment snapshot, the ranked suggestions, and nearby buyer demand.
  const assistantContext = useMemo<AssistantExtraContext>(
    () => ({
      locationName: locationInfo?.country,
      env: {
        temperature: climateData?.temperature,
        precipitation: climateData?.precipitation,
        humidity: climateData?.humidity,
        soilPH: soilData?.pH,
        soilNitrogen: soilData?.nitrogen,
        soilPhosphorus: soilData?.phosphorus,
        usAqi: airQualityData?.current?.usAqi,
        pm2_5: airQualityData?.current?.pm2_5,
        pm10: airQualityData?.current?.pm10,
        ozone: airQualityData?.current?.ozone,
      },
      suggestedCrops: autoSuggestions.slice(0, 5).map((s) => s.crop.name),
      mandiTrendPct: mandiSeries?.trendPct,
      buyerDemand: demandMatches.map((d) => ({
        buyerName: d.buyer_name,
        category: d.category ?? '',
        rate: d.rate ?? undefined,
        unit: d.unit ?? undefined,
        distanceKm:
          d.distance_m != null ? Math.round((d.distance_m / 1000) * 10) / 10 : undefined,
      })),
    }),
    [locationInfo, climateData, soilData, airQualityData, autoSuggestions, mandiSeries, demandMatches],
  );

  const riskBriefContext: RiskBriefContext | null = useMemo(() => {
    if (!results || !selectedCrop || !plantingDate || !position || !showResults) return null;
    return {
      lat: position.lat,
      lng: position.lng,
      crop: selectedCrop,
      plantingDate: plantingDate.toISOString().split('T')[0],
      yieldEstimate: results.yield,
      viabilityScore: results.viabilityScore,
      profit: results.profit,
    };
  }, [results, selectedCrop, plantingDate, position, showResults]);

  // Time-sensitive paddy advisories (v1 scope: paddy only). Derived from data
  // already fetched — no new endpoints.
  const paddyAdvisoryList = useMemo(() => {
    if (selectedCrop !== 'Rice' || !plantingDate) return [];
    const crop = CROP_DATABASE.rice;
    return paddyAdvisories({
      plantingDate,
      crop,
      climate: climateData,
      soil: soilData,
      airQuality: airQualityData,
      yieldWarnings: results?.warnings ?? [],
    });
  }, [selectedCrop, plantingDate, climateData, soilData, airQualityData, results]);

  // Feed the current pin / crop result / environment snapshot to the global assistant.
  useAssistantPageContext({ position, cropContext, assistantContext });

  const aqAge = liveFetchedAt.aq ? relativeAge(new Date(liveFetchedAt.aq).toISOString()) : '';

  const regionalEstimateBadge = (
    <span className="text-[10px] font-semibold text-muted-foreground border border-border/60 rounded-full px-1.5 py-0.5 whitespace-nowrap">
      regional estimate
    </span>
  );

  const canSimulate = position && selectedCrop && plantingDate;
  const completedCount = [!!position, !!selectedCrop, !!plantingDate].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background relative">
      <Navigation authSlot={<NavAuthControl />} />

      <main className="pt-24 pb-24 px-4 sm:px-6 max-w-[1800px] mx-auto">
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-foreground mb-2 leading-[1.1] tracking-tight">
                Your farm, <span className="text-primary">at a glance</span>
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-xl font-medium leading-relaxed">
                Soil, air quality and 5-year climate trends for your land, plus the farmers around
                you — powered by Open-Meteo, SoilGrids &amp; the Saath network.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {[
                { on: !!position, icon: MapPin, label: position ? 'Farm loaded' : 'Loading farm…' },
                { on: !!selectedCrop, icon: Leaf, label: selectedCrop || 'Select crop' },
                { on: !!plantingDate, icon: Sparkles, label: plantingDate ? 'Date set' : 'Pick date' },
              ].map((p, i) => (
                <div
                  key={i}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    p.on ? 'bg-accent/10 text-accent dark:bg-accent/15' : 'bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <p.icon className="w-3 h-3" />
                  {p.label}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr,1fr] gap-6 lg:gap-8">
          {/* LEFT — map + environmental snapshot */}
          <div className="space-y-6">
            <MapView
              value={position}
              locationLabel={locationInfo?.country}
              neighbours={neighbours}
              onNeighbourClick={(id) => navigate(`/saath/profile/${id}`)}
              connections={connections}
              initialView={mapInitialView}
              heightClass="h-[460px]"
            />
            <FarmSwitcher onPick={handlePositionChange} onFarmsChanged={onFarmsChanged} />

            {/* Saath CTA */}
            <Link
              to="/saath/feed"
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 hover:border-primary/40 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">Saath network</p>
                <p className="text-xs text-muted-foreground">
                  {neighbours.length > 0
                    ? `Trade resources, close IFS loops with ${neighbours.length} farmers & buyers nearby`
                    : 'Trade resources and close circular-agriculture loops with nearby farmers'}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            {!position && (
              <div className="bg-card border border-border/60 rounded-2xl p-8 text-center shadow-sm">
                <MapPin className="w-8 h-8 text-primary mx-auto mb-3 opacity-60" />
                <h3 className="text-lg font-bold text-foreground mb-1">Loading your farm…</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Fetching soil, air quality and 5-year climate trends for your registered
                  farm. Switch farms or add a new one from the selector above.
                </p>
              </div>
            )}

            {position && envError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-destructive shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-destructive">Failed to load environmental data</h4>
                    <p className="text-xs text-muted-foreground">{envError}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => position && loadEnvData(position.lat, position.lng)}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-2" />
                  Retry
                </Button>
              </div>
            )}

            {position && (
              <motion.div
                className="space-y-4"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Soil &amp; climate</h3>
                  {locationInfo && (
                    <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded-md ml-auto">
                      {locationInfo.country}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <MetricCard
                    icon={Cloud}
                    label="Temp"
                    value={climateData?.temperature ?? '—'}
                    unit="°C"
                    isLoading={!climateData}
                    delay={0}
                    caption={climateProvenanceLabel(liveFetchedAt.climate)}
                  />
                  <MetricCard icon={Droplets} label="Rain" value={climateData?.precipitation ?? '—'} unit="mm" isLoading={!climateData} delay={1} />
                  <MetricCard icon={Wind} label="Humidity" value={climateData?.humidity ?? '—'} unit="%" isLoading={!climateData} delay={2} />
                  <MetricCard
                    icon={Zap}
                    label="Soil pH"
                    value={soilData?.pH ?? '—'}
                    isLoading={!soilData}
                    delay={3}
                    caption={soilData ? soilProvenanceLabel(soilData) : undefined}
                  />
                  <MetricCard
                    icon={Leaf}
                    label="Nitrogen"
                    value={soilData?.nitrogen ?? '—'}
                    unit="ppm"
                    isLoading={!soilData}
                    delay={4}
                    badge={soilData ? regionalEstimateBadge : undefined}
                  />
                  <MetricCard
                    icon={TestTube2}
                    label="Phosphorus"
                    value={soilData?.phosphorus ?? '—'}
                    unit="ppm"
                    isLoading={!soilData}
                    delay={5}
                    badge={soilData ? regionalEstimateBadge : undefined}
                  />
                  <MetricCard
                    icon={Sparkles}
                    label="Potassium"
                    value={soilData?.potassium ?? '—'}
                    unit="ppm"
                    isLoading={!soilData}
                    delay={6}
                    badge={soilData ? regionalEstimateBadge : undefined}
                  />
                </div>
                {soilData && (
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                    <Info className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{SOIL_PK_DISCLAIMER}</span>
                  </p>
                )}
              </motion.div>
            )}

            {position && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Air quality</h3>
                  <div className="ml-auto flex items-center gap-2">
                    {aqAge && (
                      <span className="text-[11px] text-muted-foreground">updated {aqAge}</span>
                    )}
                    <button
                      type="button"
                      onClick={refreshLiveEnv}
                      disabled={isRefreshingLive}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                      aria-label="Refresh weather and air quality"
                    >
                      <RefreshCw className={`w-3 h-3 ${isRefreshingLive ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <MetricCard
                    icon={Activity}
                    label="US AQI"
                    value={airQualityData?.current?.usAqi ?? '—'}
                    isLoading={isEnvLoading && !airQualityData}
                    badge={airQualityData?.current?.usAqi != null ? getAqiSeverityBadge('us_aqi', airQualityData.current.usAqi) : undefined}
                    delay={0}
                  />
                  <MetricCard
                    icon={Wind}
                    label="PM 2.5"
                    value={airQualityData?.current?.pm2_5 ?? '—'}
                    unit="µg/m³"
                    isLoading={isEnvLoading && !airQualityData}
                    badge={airQualityData?.current?.pm2_5 != null ? getAqiSeverityBadge('pm2_5', airQualityData.current.pm2_5) : undefined}
                    delay={1}
                  />
                  <MetricCard
                    icon={Gauge}
                    label="PM 10"
                    value={airQualityData?.current?.pm10 ?? '—'}
                    unit="µg/m³"
                    isLoading={isEnvLoading && !airQualityData}
                    badge={airQualityData?.current?.pm10 != null ? getAqiSeverityBadge('pm10', airQualityData.current.pm10) : undefined}
                    delay={2}
                  />
                  <MetricCard
                    icon={Cloud}
                    label="Ozone"
                    value={airQualityData?.current?.ozone ?? '—'}
                    unit="µg/m³"
                    isLoading={isEnvLoading && !airQualityData}
                    badge={airQualityData?.current?.ozone != null ? getAqiSeverityBadge('ozone', airQualityData.current.ozone) : undefined}
                    delay={3}
                  />
                </div>
              </div>
            )}

            {position && (
              <div className="space-y-6 pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Climate &amp; air trends</h3>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <TrendChart
                    title="5-Year Mean Temperature"
                    description="Historical daily mean 2m air temperature (°C)"
                    badgeText="5-Year Archive"
                    badgeVariant="outline"
                    data={tempChartData}
                    xAxisKey="date"
                    seriesKey="temperature"
                    seriesConfig={{ label: 'Mean Temp', color: '#f59e0b', unit: '°C' }}
                    chartType="area"
                    isLoading={isEnvLoading}
                    error={envError}
                  />
                  <TrendChart
                    title="5-Year Rainfall & Precipitation"
                    description="Historical daily sum of precipitation (mm)"
                    badgeText="5-Year Archive"
                    badgeVariant="outline"
                    data={precipChartData}
                    xAxisKey="date"
                    seriesKey="precipitation"
                    seriesConfig={{ label: 'Precipitation', color: '#3b82f6', unit: 'mm' }}
                    chartType="area"
                    isLoading={isEnvLoading}
                    error={envError}
                  />
                </div>
                <TrendChart
                  title="PM2.5 — recent hourly"
                  description="Hourly PM2.5 particulate concentration (µg/m³)"
                  badgeText="Recent"
                  badgeVariant="secondary"
                  data={aqiChartData}
                  xAxisKey="time"
                  seriesKey="pm2_5"
                  seriesConfig={{ label: 'PM2.5 Level', color: '#10b981', unit: 'µg/m³' }}
                  chartType="line"
                  isLoading={isEnvLoading}
                  error={envError}
                />
              </div>
            )}
          </div>

          {/* RIGHT — crop yield simulator */}
          <div className="space-y-6">
            <motion.div
              className="bg-card rounded-2xl p-6 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.15)] border border-border/60"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold text-foreground">Crop yield simulator</h3>
                <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded-md">
                  {completedCount}/3
                </span>
              </div>

              <div className="w-full h-1 bg-muted/50 rounded-full mb-5 overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  animate={{ width: `${(completedCount / 3) * 100}%` }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>

              {locationInfo && (
                <div className="mb-4 flex items-center gap-2 px-3 py-2.5 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/10">
                  <Globe className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{locationInfo.country}</span>
                  <span className="text-xs text-muted-foreground ml-auto font-mono bg-muted/30 px-2 py-0.5 rounded">
                    {locationInfo.currencySymbol} {locationInfo.currencyCode}
                  </span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Planting Date
                  </label>
                  <DateSelector date={plantingDate} onDateChange={setPlantingDate} />
                  {position && climateData && soilData && !plantingDate && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Pick a planting date to see crop suggestions for this spot.
                    </p>
                  )}
                </div>

                <CropSuggestions
                  suggestions={autoSuggestions}
                  season={suggestionSeason}
                  plantingDate={plantingDate}
                  lat={position?.lat}
                  selectedCrop={selectedCrop}
                  onSelectCrop={handleSuggestionSelect}
                  show={autoSuggestions.length > 0}
                  variant="panel"
                />

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Crop Type
                  </label>
                  <CropSelector selectedCrop={selectedCrop} onCropChange={setSelectedCrop} />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Tractor className="w-3.5 h-3.5 text-primary" />
                    Planting Area
                  </label>
                  <div className="flex gap-2 mt-2">
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={areaHectares}
                      onChange={(e) => setAreaHectares(Math.max(0.1, parseFloat(e.target.value) || 1))}
                      className="flex-1 h-12 rounded-xl border border-border/60 bg-card px-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                    <div className="flex rounded-xl border border-border/60 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setAreaUnit('hectares')}
                        className={`px-3.5 text-sm font-semibold transition-all ${
                          areaUnit === 'hectares'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card text-muted-foreground hover:bg-muted/30'
                        }`}
                      >
                        ha
                      </button>
                      <button
                        type="button"
                        onClick={() => setAreaUnit('acres')}
                        className={`px-3.5 text-sm font-semibold transition-all ${
                          areaUnit === 'acres'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card text-muted-foreground hover:bg-muted/30'
                        }`}
                      >
                        ac
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 font-mono">
                    {areaUnit === 'acres'
                      ? `≈ ${(areaHectares * 0.404686).toFixed(2)} hectares`
                      : `≈ ${(areaHectares * 2.47105).toFixed(2)} acres`}
                  </p>
                </div>

                <Button
                  onClick={handleSimulate}
                  disabled={!canSimulate || isSimulating}
                  className="w-full h-14 text-base font-bold mt-4 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all active:scale-[0.98] rounded-xl group disabled:opacity-40"
                  size="lg"
                >
                  {isSimulating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-3" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Run Simulation
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </Button>

                {!canSimulate && !isSimulating && (
                  <p className="text-xs text-muted-foreground text-center">
                    {!position ? 'Loading your farm…' : !selectedCrop ? 'Select a crop type above' : 'Pick a planting date'}
                  </p>
                )}
              </div>
            </motion.div>

            <SimulationStatus currentStep={simulationStep} isVisible={simulationStep !== 'idle'} />

            {results && (
              <>
                <FinancialResults
                  yield={results.yield}
                  pricePerUnit={results.pricePerUnit}
                  profit={results.profit}
                  show={showResults}
                  currencySymbol={locationInfo?.currencySymbol || '$'}
                  currencyCode={locationInfo?.currencyCode || 'USD'}
                  harvestDate={results.harvestDate}
                  growingDays={results.growingDays}
                  grossRevenue={results.grossRevenue}
                  totalCosts={results.totalCosts}
                  areaHectares={results.areaHectares}
                  warnings={results.warnings}
                  viabilityScore={results.viabilityScore}
                  priceSource={results.priceSource}
                  buyerName={results.buyerName}
                  buyerDistanceKm={results.buyerDistanceKm}
                  mandiTrendPct={results.mandiTrendPct}
                />
                {showResults && <EnvironmentalOutlook context={riskBriefContext} />}
                {showResults && selectedCrop === 'Rice' && plantingDate && (
                  <AdvisoryCard advisories={paddyAdvisoryList} />
                )}
              </>
            )}

            <CropSuggestions
              suggestions={cropSuggestions}
              season={currentSeason}
              plantingDate={plantingDate}
              lat={position?.lat}
              selectedCrop={selectedCrop}
              onSelectCrop={handleSuggestionSelect}
              show={showSuggestions}
              variant="results"
            />

            {results && showResults && position && (
              <MarketSignal
                crop={selectedCrop}
                harvestDate={results.harvestDate}
                lat={position.lat}
                priceSource={results.priceSource}
                pricePerUnit={results.pricePerUnit}
                referencePricePerUnit={results.referencePricePerUnit}
                mandiTrendPct={results.mandiTrendPct}
                mandiSeries={mandiSeries}
                currencySymbol={locationInfo?.currencySymbol || '$'}
                show
              />
            )}
          </div>
        </div>

      </main>

      <footer className="border-t border-border/30 py-6 px-6">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <p className="text-xs text-muted-foreground">TerraLearn · Precision Agriculture &amp; the Saath network</p>
          <p className="text-xs text-muted-foreground/60">Educational tool · Data from Open-Meteo, ISRIC &amp; Esri</p>
        </div>
      </footer>
    </div>
  );
}

export default Home;
