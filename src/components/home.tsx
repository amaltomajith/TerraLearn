import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Navigation } from './Navigation';
import { MapCard } from './MapCard';
import { CropSelector } from './CropSelector';
import { DateSelector } from './DateSelector';
import { MetricCard } from './MetricCard';
import { FinancialResults } from './FinancialResults';
import { CropSuggestions } from './CropSuggestions';
import { SimulationStatus, type SimulationStep } from './SimulationStatus';
import { Button } from './ui/button';
import { Cloud, Droplets, Wind, Zap, Leaf, TestTube2, Sparkles, Globe, Tractor, MapPin, ArrowRight } from 'lucide-react';
import {
  fetchClimateData,
  fetchSoilData,
  fetchLocationInfo,
  calculateYield,
  suggestCrops,
  getSeason,
  CROP_DATABASE,
  type ClimateData,
  type SoilData,
  type LocationInfo,
  type SimulationResult,
  type CropInfo,
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

  const [climateData, setClimateData] = useState<ClimateData | null>(null);
  const [soilData, setSoilData] = useState<SoilData | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [results, setResults] = useState<SimulationResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Crop suggestions state
  const [cropSuggestions, setCropSuggestions] = useState<
    { crop: CropInfo; score: number; reasons: string[] }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentSeason, setCurrentSeason] = useState('');

  const handlePositionChange = useCallback((lat: number, lng: number) => {
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
  }, []);

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
      // Run location + climate + soil in parallel for maximum speed
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

      // Step 4: Calculate
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

      // Generate crop suggestions
      const season = getSeason(plantingDate, position.lat);
      setCurrentSeason(season);
      const suggestions = suggestCrops(climate, soil, plantingDate, position.lat);
      setCropSuggestions(suggestions);

      // Step 5: Complete
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

  const canSimulate = position && selectedCrop && plantingDate;

  // Completeness indicator
  const completedSteps = [!!position, !!selectedCrop, !!plantingDate];
  const completedCount = completedSteps.filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background relative">
      <Navigation />

      <main className="pt-24 pb-20 px-4 sm:px-6 max-w-[1600px] mx-auto">
        {/* Hero Section */}
        <motion.div 
          className="mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-foreground mb-3 leading-[1.1] tracking-tight">
                Precision Agriculture
                <br />
                <span className="text-primary">Crop Simulator</span>
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground max-w-xl font-medium leading-relaxed">
                Predict crop yields with real-world climate and soil data.
                Drop a pin, configure your crop, and simulate.
              </p>
            </div>
            
            {/* Quick status pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                position ? 'bg-accent/10 text-accent dark:bg-accent/15' : 'bg-muted/50 text-muted-foreground'
              }`}>
                <MapPin className="w-3 h-3" />
                {position ? 'Pin dropped' : 'Drop a pin'}
              </div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                selectedCrop ? 'bg-accent/10 text-accent dark:bg-accent/15' : 'bg-muted/50 text-muted-foreground'
              }`}>
                <Leaf className="w-3 h-3" />
                {selectedCrop || 'Select crop'}
              </div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                plantingDate ? 'bg-accent/10 text-accent dark:bg-accent/15' : 'bg-muted/50 text-muted-foreground'
              }`}>
                <Sparkles className="w-3 h-3" />
                {plantingDate ? 'Date set' : 'Pick date'}
              </div>
            </div>
          </div>
        </motion.div>

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
                  <span className="text-sm font-semibold text-foreground">
                    {locationInfo.country}
                  </span>
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
                  <CropSelector
                    selectedCrop={selectedCrop}
                    onCropChange={setSelectedCrop}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Planting Date
                  </label>
                  <DateSelector
                    date={plantingDate}
                    onDateChange={setPlantingDate}
                  />
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
                    {!position ? 'Drop a pin on the map to start' : 
                     !selectedCrop ? 'Select a crop type above' : 
                     'Pick a planting date'}
                  </p>
                )}
              </div>
            </motion.div>

            {/* Simulation Status Card */}
            <SimulationStatus 
              currentStep={simulationStep} 
              isVisible={simulationStep !== 'idle'} 
            />

            {results && (
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
            )}
          </div>
        </div>
      </main>

      {/* Subtle footer */}
      <footer className="border-t border-border/30 py-6 px-6">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            TerraLearn · Precision Agriculture Simulator
          </p>
          <p className="text-xs text-muted-foreground/60">
            Educational tool · Data from Open-Meteo & ISRIC
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Home;
