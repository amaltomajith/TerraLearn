import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Navigation } from './Navigation';
import { MapCard } from './MapCard';
import { CropSelector } from './CropSelector';
import { DateSelector } from './DateSelector';
import { MetricCard } from './MetricCard';
import { FinancialResults } from './FinancialResults';
import { CropSuggestions } from './CropSuggestions';
import { SimulationStatus, type SimulationStep } from './SimulationStatus';
import { TrendChart } from './TrendChart';
import { AskTerraLearn } from './AskTerraLearn';
import { EnvironmentalOutlook, type RiskBriefContext } from './EnvironmentalOutlook';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
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
  Sprout,
  Thermometer,
} from 'lucide-react';
import {
  fetchClimateData,
  fetchSoilData,
  fetchLocationInfo,
  fetchAirQualityData,
  fetchClimateTrends,
  calculateYield,
  suggestCrops,
  getSeason,
  CROP_DATABASE,
  type ClimateData,
  type SoilData,
  type LocationInfo,
  type SimulationResult,
  type CropInfo,
  type AirQualityData,
  type ClimateTrendsData,
} from '@/lib/api';
import { toast } from 'sonner';

function Home() {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedCrop, setSelectedCrop] = useState('');
  const [plantingDate, setPlantingDate] = useState<Date>();
  const [areaHectares, setAreaHectares] = useState<number>(1);
  const [areaUnit, setAreaUnit] = useState<'hectares' | 'acres'>('hectares');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [simulationStep, setSimulationStep] = useState<SimulationStep>('idle');

  const [activeTab, setActiveTab] = useState<'simulator' | 'trends'>('simulator');

  const [climateData, setClimateData] = useState<ClimateData | null>(null);
  const [soilData, setSoilData] = useState<SoilData | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [results, setResults] = useState<SimulationResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Environment & Trends state
  const [airQualityData, setAirQualityData] = useState<AirQualityData | null>(null);
  const [climateTrends, setClimateTrends] = useState<ClimateTrendsData | null>(null);
  const [isTrendsLoading, setIsTrendsLoading] = useState(false);
  const [trendsError, setTrendsError] = useState<string | null>(null);

  // Crop suggestions state
  const [cropSuggestions, setCropSuggestions] = useState<
    { crop: CropInfo; score: number; reasons: string[] }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentSeason, setCurrentSeason] = useState('');

  const loadTrendsData = useCallback(async (lat: number, lng: number) => {
    setIsTrendsLoading(true);
    setTrendsError(null);
    try {
      const [aqData, trendsData] = await Promise.all([
        fetchAirQualityData(lat, lng),
        fetchClimateTrends(lat, lng),
      ]);
      setAirQualityData(aqData);
      setClimateTrends(trendsData);
    } catch (error) {
      console.error('Error fetching trend data:', error);
      setTrendsError('Unable to fetch environmental & trend data for this location.');
    } finally {
      setIsTrendsLoading(false);
    }
  }, []);

  const handlePositionChange = useCallback(
    (lat: number, lng: number) => {
      setPosition({ lat, lng });
      setShowResults(false);
      setResults(null);
      setClimateData(null);
      setSoilData(null);
      setShowSuggestions(false);
      setCropSuggestions([]);
      setSimulationStep('idle');

      fetchLocationInfo(lat, lng)
        .then((info) => {
          setLocationInfo(info);
          toast.success(`Location: ${info.country} (${info.currencyCode})`);
        })
        .catch(() => {
          setLocationInfo(null);
        });

      loadTrendsData(lat, lng);
    },
    [loadTrendsData]
  );

  const handleGeolocation = () => {
    setIsGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        handlePositionChange(latitude, longitude);
        setIsGeolocating(false);
        toast.success('Location detected successfully!');
      },
      (error) => {
        setIsGeolocating(false);
        toast.error('Unable to get your location. Please enable location permissions.');
        console.error('Geolocation error:', error);
      }
    );
  };

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

      setSimulationStep('calculating');
      const hectares = areaUnit === 'acres' ? areaHectares * 0.404686 : areaHectares;
      const calculatedResults = calculateYield(
        selectedCrop,
        plantingDate,
        climate,
        soil,
        position.lat,
        locInfo.exchangeRate,
        hectares
      );
      setResults(calculatedResults);

      const season = getSeason(plantingDate, position.lat);
      setCurrentSeason(season);
      const suggestions = suggestCrops(climate, soil, plantingDate, position.lat);
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

  // Trend Chart Data Mappings
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

  // AQI Severity Badge helper
  const getAqiSeverityBadge = (type: 'us_aqi' | 'pm2_5' | 'pm10' | 'ozone', value: number) => {
    let label = 'Good';
    let styleClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';

    if (type === 'us_aqi') {
      if (value > 100) {
        label = 'Unhealthy';
        styleClass = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      } else if (value > 50) {
        label = 'Moderate';
        styleClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      }
    } else if (type === 'pm2_5') {
      if (value > 35.4) {
        label = 'Unhealthy';
        styleClass = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      } else if (value > 12.0) {
        label = 'Moderate';
        styleClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      }
    } else if (type === 'pm10') {
      if (value > 154) {
        label = 'Unhealthy';
        styleClass = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      } else if (value > 54) {
        label = 'Moderate';
        styleClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      }
    } else if (type === 'ozone') {
      if (value > 180) {
        label = 'Unhealthy';
        styleClass = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      } else if (value > 100) {
        label = 'Moderate';
        styleClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      }
    }

    return (
      <Badge variant="outline" className={`text-[10px] font-semibold border ${styleClass}`}>
        {label}
      </Badge>
    );
  };

  const canSimulate = position && selectedCrop && plantingDate;
  const completedSteps = [!!position, !!selectedCrop, !!plantingDate];
  const completedCount = completedSteps.filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background relative">
      <Navigation />

      <main className="pt-24 pb-20 px-4 sm:px-6 max-w-[1600px] mx-auto">
        {/* Hero Section */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-foreground mb-3 leading-[1.1] tracking-tight">
                Precision Agriculture
                <br />
                <span className="text-primary">Analytics & Simulator</span>
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground max-w-xl font-medium leading-relaxed">
                Predict crop yields, analyze air quality metrics, and evaluate 5-year climate trends with real-world Open-Meteo & SoilGrids data.
              </p>
            </div>

            {/* Quick status pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                  position ? 'bg-accent/10 text-accent dark:bg-accent/15' : 'bg-muted/50 text-muted-foreground'
                }`}
              >
                <MapPin className="w-3 h-3" />
                {position ? 'Pin dropped' : 'Drop a pin'}
              </div>
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                  selectedCrop ? 'bg-accent/10 text-accent dark:bg-accent/15' : 'bg-muted/50 text-muted-foreground'
                }`}
              >
                <Leaf className="w-3 h-3" />
                {selectedCrop || 'Select crop'}
              </div>
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                  plantingDate ? 'bg-accent/10 text-accent dark:bg-accent/15' : 'bg-muted/50 text-muted-foreground'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                {plantingDate ? 'Date set' : 'Pick date'}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'simulator' | 'trends')} className="w-full">
          <TabsList className="bg-card border border-border/60 p-1 rounded-xl h-12 inline-flex gap-1 shadow-sm mb-6">
            <TabsTrigger
              value="simulator"
              className="px-5 py-2 rounded-lg font-bold text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 flex items-center gap-2"
            >
              <Sprout className="w-4 h-4" />
              Crop Yield Simulator
            </TabsTrigger>
            <TabsTrigger
              value="trends"
              className="px-5 py-2 rounded-lg font-bold text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              Environment & Trends
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: SIMULATOR */}
          <TabsContent value="simulator" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr,1fr] gap-6 lg:gap-8">
              {/* Left Column */}
              <div className="space-y-6">
                <MapCard
                  position={position}
                  onPositionChange={handlePositionChange}
                  onGeolocation={handleGeolocation}
                  isGeolocating={isGeolocating}
                  locationLabel={locationInfo?.country}
                />

                {/* Climate & Soil Metrics */}
                {(climateData || soilData) && (
                  <motion.div
                    className="space-y-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground">Environmental Data</h3>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <MetricCard
                        icon={Cloud}
                        label="Temp"
                        value={climateData?.temperature || '—'}
                        unit="°C"
                        isLoading={!climateData}
                        delay={0}
                      />
                      <MetricCard
                        icon={Droplets}
                        label="Rain"
                        value={climateData?.precipitation || '—'}
                        unit="mm"
                        isLoading={!climateData}
                        delay={1}
                      />
                      <MetricCard
                        icon={Wind}
                        label="Humidity"
                        value={climateData?.humidity || '—'}
                        unit="%"
                        isLoading={!climateData}
                        delay={2}
                      />
                      <MetricCard
                        icon={Zap}
                        label="Soil pH"
                        value={soilData?.pH || '—'}
                        isLoading={!soilData}
                        delay={3}
                      />
                      <MetricCard
                        icon={Leaf}
                        label="Nitrogen"
                        value={soilData?.nitrogen || '—'}
                        unit="ppm"
                        isLoading={!soilData}
                        delay={4}
                      />
                      <MetricCard
                        icon={TestTube2}
                        label="Phosphorus"
                        value={soilData?.phosphorus || '—'}
                        unit="ppm"
                        isLoading={!soilData}
                        delay={5}
                      />
                    </div>
                  </motion.div>
                )}

                {/* Crop Suggestions */}
                <CropSuggestions
                  suggestions={cropSuggestions}
                  season={currentSeason}
                  onSelectCrop={handleSuggestionSelect}
                  show={showSuggestions}
                />
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <motion.div
                  className="bg-card rounded-2xl p-6 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.15)] border border-border/60"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-xl font-bold text-foreground">Configuration</h3>
                    <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded-md">
                      {completedCount}/3
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1 bg-muted/50 rounded-full mb-5 overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      animate={{ width: `${(completedCount / 3) * 100}%` }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>

                  {/* Location currency badge */}
                  {locationInfo && (
                    <motion.div
                      className="mb-4 flex items-center gap-2 px-3 py-2.5 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/10"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <Globe className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">{locationInfo.country}</span>
                      <span className="text-xs text-muted-foreground ml-auto font-mono bg-muted/30 px-2 py-0.5 rounded">
                        {locationInfo.currencySymbol} {locationInfo.currencyCode}
                      </span>
                    </motion.div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Crop Type
                      </label>
                      <CropSelector selectedCrop={selectedCrop} onCropChange={setSelectedCrop} />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Planting Date
                      </label>
                      <DateSelector date={plantingDate} onDateChange={setPlantingDate} />
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
                            className={`px-3.5 text-sm font-semibold transition-all duration-200 ${
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
                            className={`px-3.5 text-sm font-semibold transition-all duration-200 ${
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
                      className="w-full h-14 text-base font-bold mt-4 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 active:scale-[0.98] rounded-xl group disabled:opacity-40"
                      size="lg"
                    >
                      {isSimulating ? (
                        <>
                          <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-3" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4.5 h-4.5 mr-2" />
                          Run Simulation
                          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </Button>

                    {!canSimulate && !isSimulating && (
                      <p className="text-xs text-muted-foreground text-center">
                        {!position
                          ? 'Drop a pin on the map to start'
                          : !selectedCrop
                          ? 'Select a crop type above'
                          : 'Pick a planting date'}
                      </p>
                    )}
                  </div>
                </motion.div>

                {/* Simulation Status Card */}
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
                    />

                    {showResults && <EnvironmentalOutlook context={riskBriefContext} />}
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: ENVIRONMENT & TRENDS */}
          <TabsContent value="trends" className="mt-0 space-y-8">
            {/* Map location picker for trends tab */}
            <div className="space-y-6">
              <MapCard
                position={position}
                onPositionChange={handlePositionChange}
                onGeolocation={handleGeolocation}
                isGeolocating={isGeolocating}
                locationLabel={locationInfo?.country}
              />

              {/* No position state notice */}
              {!position && (
                <div className="bg-card border border-border/60 rounded-2xl p-8 text-center shadow-sm">
                  <MapPin className="w-8 h-8 text-primary mx-auto mb-3 opacity-60" />
                  <h3 className="text-lg font-bold text-foreground mb-1">Select a Location</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Click anywhere on the map above or use "My Location" to load air quality tiles and historical 5-year climate trends.
                  </p>
                </div>
              )}

              {/* API Error state notice */}
              {position && trendsError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-destructive shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-destructive">Failed to Load Environmental Trends</h4>
                      <p className="text-xs text-muted-foreground">{trendsError}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => position && loadTrendsData(position.lat, position.lng)}
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-2" />
                    Retry
                  </Button>
                </div>
              )}

              {/* AQI Tiles */}
              {position && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground">Current Air Quality Index</h3>
                    </div>
                    {locationInfo && (
                      <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md">
                        {locationInfo.country}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                      icon={Activity}
                      label="US AQI Index"
                      value={airQualityData?.current?.usAqi ?? '—'}
                      isLoading={isTrendsLoading && !airQualityData}
                      badge={
                        airQualityData?.current?.usAqi != null
                          ? getAqiSeverityBadge('us_aqi', airQualityData.current.usAqi)
                          : undefined
                      }
                      delay={0}
                    />
                    <MetricCard
                      icon={Wind}
                      label="PM 2.5"
                      value={airQualityData?.current?.pm2_5 ?? '—'}
                      unit="µg/m³"
                      isLoading={isTrendsLoading && !airQualityData}
                      badge={
                        airQualityData?.current?.pm2_5 != null
                          ? getAqiSeverityBadge('pm2_5', airQualityData.current.pm2_5)
                          : undefined
                      }
                      delay={1}
                    />
                    <MetricCard
                      icon={Gauge}
                      label="PM 10"
                      value={airQualityData?.current?.pm10 ?? '—'}
                      unit="µg/m³"
                      isLoading={isTrendsLoading && !airQualityData}
                      badge={
                        airQualityData?.current?.pm10 != null
                          ? getAqiSeverityBadge('pm10', airQualityData.current.pm10)
                          : undefined
                      }
                      delay={2}
                    />
                    <MetricCard
                      icon={Cloud}
                      label="Ozone (O₃)"
                      value={airQualityData?.current?.ozone ?? '—'}
                      unit="µg/m³"
                      isLoading={isTrendsLoading && !airQualityData}
                      badge={
                        airQualityData?.current?.ozone != null
                          ? getAqiSeverityBadge('ozone', airQualityData.current.ozone)
                          : undefined
                      }
                      delay={3}
                    />
                  </div>
                </div>
              )}

              {/* 3 Trend Charts */}
              {position && (
                <div className="space-y-6 pt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">Climate & Air Quality Trends</h3>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Temperature Trend */}
                    <TrendChart
                      title="5-Year Mean Temperature"
                      description="Historical daily mean 2m air temperature (°C)"
                      badgeText="5-Year Archive"
                      badgeVariant="outline"
                      data={tempChartData}
                      xAxisKey="date"
                      seriesKey="temperature"
                      seriesConfig={{
                        label: 'Mean Temp',
                        color: '#f59e0b',
                        unit: '°C',
                      }}
                      chartType="area"
                      isLoading={isTrendsLoading}
                      error={trendsError}
                    />

                    {/* Precipitation Trend */}
                    <TrendChart
                      title="5-Year Rainfall & Precipitation"
                      description="Historical daily sum of precipitation (mm)"
                      badgeText="5-Year Archive"
                      badgeVariant="outline"
                      data={precipChartData}
                      xAxisKey="date"
                      seriesKey="precipitation"
                      seriesConfig={{
                        label: 'Precipitation',
                        color: '#3b82f6',
                        unit: 'mm',
                      }}
                      chartType="area"
                      isLoading={isTrendsLoading}
                      error={trendsError}
                    />
                  </div>

                  {/* AQI / PM2.5 Trend (Full width) */}
                  <TrendChart
                    title="PM2.5 Air Quality Forecast"
                    description="Hourly PM2.5 particulate concentration (µg/m³)"
                    badgeText="Recent"
                    badgeVariant="secondary"
                    data={aqiChartData}
                    xAxisKey="time"
                    seriesKey="pm2_5"
                    seriesConfig={{
                      label: 'PM2.5 Level',
                      color: '#10b981',
                      unit: 'µg/m³',
                    }}
                    chartType="line"
                    isLoading={isTrendsLoading}
                    error={trendsError}
                  />

                  {/* Ask TerraLearn AI Chat Assistant */}
                  <div className="pt-4">
                    <AskTerraLearn position={position} cropContext={cropContext} />
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-6 px-6">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <p className="text-xs text-muted-foreground">TerraLearn · Precision Agriculture Simulator & Analytics</p>
          <p className="text-xs text-muted-foreground/60">Educational tool · Data from Open-Meteo & ISRIC</p>
        </div>
      </footer>
    </div>
  );
}

export default Home;
