import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Navigation } from './Navigation';
import NavAuthControl from './saath/NavAuthControl';
import { MapView, type IfsConnection } from './MapView';
import { FarmSwitcher } from './FarmSwitcher';
import { useTranslation } from '@/lib/i18n/I18nProvider';
import { useAssistantPageContext } from '@/lib/assistant/useAssistantPageContext';
import type { AssistantExtraContext } from '@/lib/assistant/types';
import { useIdentity } from '@/lib/identity/identity';
import { getMapPoints, getIfsLoops, nearbyDemandListings } from '@/lib/saath/queries';
import type { MapPointRow, IfsMatchRow, NearbyDemandRow, Farm } from '@/lib/saath/types';
import { CropSelector } from './CropSelector';
import { DateSelector } from './DateSelector';
import { MetricCard } from './MetricCard';
import { CropSuggestions } from './CropSuggestions';
import { TrendChart } from './TrendChart';
import { EnvironmentalOutlook, type RiskBriefContext } from './EnvironmentalOutlook';
import { AdvisoryCard } from './AdvisoryCard';
import { CropCalendar } from './farm/CropCalendar';
import { AddCycleDialog } from './farm/AddCycleDialog';
import { FarmLog } from './farm/FarmLog';
import { YieldProjectionCard } from './farm/YieldProjectionCard';
import { MyTasksCard } from './farm/MyTasksCard';
import { DailyGuidelinesCard } from './farm/DailyGuidelinesCard';
import { AdvisoryTaskDialog } from './farm/AdvisoryTaskDialog';
import { useFarmSeason } from '@/lib/farm/useFarmSeason';
import type { Advisory } from '@/lib/advisories';
import { buildCropTimeline } from '@/lib/cropCalendar';
import { cropAdvisories } from '@/lib/advisories';
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
  ClipboardList,
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
  type AirQualityData,
  type ClimateTrendsData,
  type MandiPriceSeries,
} from '@/lib/api';
import {
  suggestCropsWithCircular,
  demandRatePerTon,
  CROP_TO_SALE_CATEGORY,
} from '@/lib/cropEnterprise';
import { toast } from 'sonner';

function Home() {
  const navigate = useNavigate();
  const { activeFarmerId: farmerId, primaryFarm } = useIdentity();
  const { t } = useTranslation();

  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [neighbours, setNeighbours] = useState<MapPointRow[]>([]);
  const [ifsRows, setIfsRows] = useState<IfsMatchRow[]>([]);
  const [selectedCrop, setSelectedCrop] = useState('');
  const [plantingDate, setPlantingDate] = useState<Date>();

  // Active farm: seeded from primaryFarm, updated when the user switches via FarmSwitcher
  const [activeFarm, setActiveFarm] = useState<Farm | null>(null);
  const [taskAdvisory, setTaskAdvisory] = useState<Advisory | null>(null);

  const [climateData, setClimateData] = useState<ClimateData | null>(null);
  const [soilData, setSoilData] = useState<SoilData | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);

  const [airQualityData, setAirQualityData] = useState<AirQualityData | null>(null);
  const [climateTrends, setClimateTrends] = useState<ClimateTrendsData | null>(null);
  const [isEnvLoading, setIsEnvLoading] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);
  // When the live-ish readings (weather, AQI) were last refreshed — drives the
  // "updated Xm ago" labels. Soil keeps its own `fetchedAt` on the payload.
  const [liveFetchedAt, setLiveFetchedAt] = useState<{ aq?: number; climate?: number }>({});
  const [isRefreshingLive, setIsRefreshingLive] = useState(false);

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
      setClimateData(null);
      setSoilData(null);
      setLiveFetchedAt({});
      setDemandMatches([]);
      setMandiSeries(null);

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

  // Start the dashboard on the farmer's primary farm (once).
  const seededPinRef = useRef(false);
  useEffect(() => {
    if (seededPinRef.current || position || !primaryFarm) return;
    seededPinRef.current = true;
    handlePositionChange(primaryFarm.lat, primaryFarm.lng);
    setActiveFarm(primaryFarm);
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

  // ── Farm season: crop cycle, events, timeline, projection, advisories ──────
  const activeRole = activeFarm?.member_role ?? 'owner';
  const { activeCycle, events: cycleEvents, reload: reloadSeason } = useFarmSeason(
    activeFarm?.id ?? null,
  );

  const timeline = useMemo(
    () =>
      activeCycle
        ? buildCropTimeline(activeCycle.crop, new Date(activeCycle.sowing_date), {
            harvestDate: activeCycle.actual_harvest_date
              ? new Date(activeCycle.actual_harvest_date)
              : null,
          })
        : null,
    [activeCycle],
  );

  const projection = useMemo(() => {
    if (!activeCycle || !climateData || !soilData || !locationInfo || !position) return null;
    const key = activeCycle.crop.toLowerCase();
    if (!CROP_DATABASE[key]) return null;
    try {
      return calculateYield(
        activeCycle.crop,
        new Date(activeCycle.sowing_date),
        climateData,
        soilData,
        position.lat,
        locationInfo.exchangeRate,
        activeCycle.area_hectares,
      );
    } catch {
      return null;
    }
  }, [activeCycle, climateData, soilData, locationInfo, position]);

  const advisoryList = useMemo(() => {
    if (!activeCycle) return [];
    const crop = CROP_DATABASE[activeCycle.crop.toLowerCase()];
    if (!crop) return [];
    return cropAdvisories({
      cropName: activeCycle.crop,
      crop,
      sowingDate: new Date(activeCycle.sowing_date),
      climate: climateData,
      soil: soilData,
      airQuality: airQualityData,
      yieldWarnings: projection?.warnings ?? [],
    });
  }, [activeCycle, climateData, soilData, airQualityData, projection]);


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
    // Prefer active cycle data; fall back to undefined (assistant handles nulls).
    if (!activeCycle) return null;
    return {
      crop: activeCycle.crop,
      plantingDate: activeCycle.sowing_date,
      yieldEstimate: projection?.yield,
      viabilityScore: projection?.viabilityScore,
      profit: projection?.profit,
    };
  }, [activeCycle, projection]);

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
    if (!activeCycle || !projection || !position) return null;
    return {
      lat: position.lat,
      lng: position.lng,
      crop: activeCycle.crop,
      plantingDate: activeCycle.sowing_date,
      yieldEstimate: projection.yield,
      viabilityScore: projection.viabilityScore,
      profit: projection.profit,
    };
  }, [activeCycle, projection, position]);

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
                {t('dashboard_title_prefix')}<span className="text-primary">{t('dashboard_title_highlight')}</span>
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-xl font-medium leading-relaxed">
                {t('dashboard_subtitle')}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {[
                { on: !!position, icon: MapPin, label: position ? t('status_farm_loaded') : t('status_loading_farm') },
                { on: !!selectedCrop, icon: Leaf, label: selectedCrop || t('status_select_crop') },
                { on: !!plantingDate, icon: Sparkles, label: plantingDate ? t('status_date_set') : t('status_pick_date') },
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
            <FarmSwitcher
              onPick={handlePositionChange}
              onSelect={(f) => setActiveFarm(f)}
              onFarmsChanged={onFarmsChanged}
            />

            {/* Team & tasks (Owner/Manager only) */}
            {activeRole !== 'worker' && (
              <Link
                to="/farm/team"
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 hover:border-primary/40 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <ClipboardList className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">{t('card_team_tasks')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('card_team_tasks_desc')}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )}

            {/* Saath CTA */}
            <Link
              to="/saath/feed"
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 hover:border-primary/40 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{t('card_saath_network')}</p>
                <p className="text-xs text-muted-foreground">
                  {neighbours.length > 0
                    ? `Trade resources, close IFS loops with ${neighbours.length} farmers & buyers nearby`
                    : t('card_saath_network_desc')}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            {!position && (
              <div className="bg-card border border-border/60 rounded-2xl p-8 text-center shadow-sm">
                <MapPin className="w-8 h-8 text-primary mx-auto mb-3 opacity-60" />
                <h3 className="text-lg font-bold text-foreground mb-1">{t('loading_farm_banner_title')}</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {t('loading_farm_banner_desc')}
                </p>
              </div>
            )}

            {position && envError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-destructive shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-destructive">{t('env_failed_title')}</h4>
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
                  <h3 className="text-xl font-bold text-foreground">{t('metric_soil_health')} &amp; {t('metric_weather_climate')}</h3>
                  {locationInfo && (
                    <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded-md ml-auto">
                      {locationInfo.country}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <MetricCard
                    icon={Cloud}
                    label={t('label_temp')}
                    value={climateData?.temperature ?? '—'}
                    unit="°C"
                    isLoading={!climateData}
                    delay={0}
                    caption={climateProvenanceLabel(liveFetchedAt.climate)}
                  />
                  <MetricCard icon={Droplets} label={t('label_rainfall')} value={climateData?.precipitation ?? '—'} unit="mm" isLoading={!climateData} delay={1} />
                  <MetricCard icon={Wind} label={t('label_humidity')} value={climateData?.humidity ?? '—'} unit="%" isLoading={!climateData} delay={2} />
                  <MetricCard
                    icon={Zap}
                    label={t('label_ph')}
                    value={soilData?.pH ?? '—'}
                    isLoading={!soilData}
                    delay={3}
                    caption={soilData ? soilProvenanceLabel(soilData) : undefined}
                  />
                  <MetricCard
                    icon={Leaf}
                    label={t('label_nitrogen')}
                    value={soilData?.nitrogen ?? '—'}
                    unit="ppm"
                    isLoading={!soilData}
                    delay={4}
                    badge={soilData ? regionalEstimateBadge : undefined}
                  />
                  <MetricCard
                    icon={TestTube2}
                    label={t('label_phosphorus')}
                    value={soilData?.phosphorus ?? '—'}
                    unit="ppm"
                    isLoading={!soilData}
                    delay={5}
                    badge={soilData ? regionalEstimateBadge : undefined}
                  />
                  <MetricCard
                    icon={Sparkles}
                    label={t('label_potassium')}
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
                  <h3 className="text-xl font-bold text-foreground">{t('metric_air_quality')}</h3>
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
                    label={t('label_aqi')}
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

          {/* RIGHT — active crop season */}
          <div className="space-y-6">
            <DailyGuidelinesCard
              climate={climateData}
              soil={soilData}
              activeCycle={activeCycle ?? null}
              isLoading={isEnvLoading}
            />
            <MyTasksCard compact={activeRole !== 'worker'} />

            {!activeCycle ? (
              // No active cycle
              activeRole === 'worker' ? (
                <p className="text-sm text-muted-foreground bg-card rounded-2xl p-6 border border-border/60">
                  Your farm manager hasn't started a crop cycle yet.
                </p>
              ) : (
                <>
                  <motion.div
                    className="bg-card rounded-2xl p-6 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.15)] border border-border/60"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                        <Leaf className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="text-lg font-bold text-foreground">Start this season</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-5">
                      Record your crop, sowing date and area once — the dashboard will track the stage
                      calendar, advisories and yield projection automatically.
                    </p>
                    {activeFarm ? (
                      <AddCycleDialog farm={activeFarm} onCreated={reloadSeason} />
                    ) : (
                      <p className="text-xs text-muted-foreground">Loading your farm…</p>
                    )}
                  </motion.div>

                  {/* Crop suggestions while no cycle is active */}
                  <CropSuggestions
                    suggestions={autoSuggestions}
                    season={suggestionSeason}
                    plantingDate={plantingDate}
                    lat={position?.lat}
                    selectedCrop={selectedCrop}
                    onSelectCrop={(crop) => setSelectedCrop(crop)}
                    show={autoSuggestions.length > 0}
                    variant="panel"
                  />
                </>
              )
            ) : (

              // Active cycle — show calendar, log, advisories, projection
              <>
                {timeline && (
                  <CropCalendar
                    timeline={timeline}
                    events={cycleEvents}
                    readOnly={activeRole === 'worker'}
                  />
                )}

                <FarmLog
                  farmId={activeFarm!.id}
                  cycleId={activeCycle.id}
                  events={cycleEvents}
                  onChange={reloadSeason}
                  readOnly={activeRole === 'worker'}
                />

                <AdvisoryCard
                  advisories={advisoryList}
                  onMakeTask={activeRole !== 'worker' ? setTaskAdvisory : undefined}
                />

                {activeRole !== 'worker' && riskBriefContext && <EnvironmentalOutlook context={riskBriefContext} />}

                {activeRole !== 'worker' && projection && (
                  <YieldProjectionCard
                    projection={projection}
                    cycle={activeCycle}
                    onRerun={() => {
                      if (position) loadEnvData(position.lat, position.lng);
                    }}
                    currencySymbol={locationInfo?.currencySymbol ?? '₹'}
                    currencyCode={locationInfo?.currencyCode ?? 'INR'}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {activeFarm && activeCycle && (
          <AdvisoryTaskDialog
            advisory={taskAdvisory}
            farmId={activeFarm.id}
            cycleId={activeCycle.id}
            onClose={() => setTaskAdvisory(null)}
            onCreated={() => {}}
          />
        )}
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
