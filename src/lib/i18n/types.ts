export type LanguageCode = 'en' | 'kn' | 'hi' | 'ta' | 'te' | 'mr' | 'ml';

export interface LanguageInfo {
  code: LanguageCode;
  name: string;          // Native name: e.g. "ಕನ್ನಡ"
  englishName: string;   // e.g. "Kannada"
  flag: string;          // Flag or indicator emoji
  speechLocale: string;  // e.g. "kn-IN"
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'kn', name: 'ಕನ್ನಡ', englishName: 'Kannada', flag: '🌾', speechLocale: 'kn-IN' },
  { code: 'hi', name: 'हिन्दी', englishName: 'Hindi', flag: '🇮🇳', speechLocale: 'hi-IN' },
  { code: 'en', name: 'English', englishName: 'English', flag: '🌐', speechLocale: 'en-IN' },
  { code: 'ta', name: 'தமிழ்', englishName: 'Tamil', flag: '🌾', speechLocale: 'ta-IN' },
  { code: 'te', name: 'తెలుగు', englishName: 'Telugu', flag: '🌾', speechLocale: 'te-IN' },
  { code: 'mr', name: 'मराठी', englishName: 'Marathi', flag: '🌾', speechLocale: 'mr-IN' },
  { code: 'ml', name: 'മലയാളം', englishName: 'Malayalam', flag: '🌴', speechLocale: 'ml-IN' },
];

export interface TranslationSchema {
  // Navigation
  nav_home: string;
  nav_cascade: string;
  nav_saath: string;
  nav_theme_toggle: string;
  nav_language: string;

  // Dashboard Header & Status
  dashboard_title_prefix: string;
  dashboard_title_highlight: string;
  dashboard_subtitle: string;
  status_farm_loaded: string;
  status_loading_farm: string;
  status_select_crop: string;
  status_date_set: string;
  status_pick_date: string;

  // Quick Action Cards
  card_team_tasks: string;
  card_team_tasks_desc: string;
  card_saath_network: string;
  card_saath_network_desc: string;
  loading_farm_banner_title: string;
  loading_farm_banner_desc: string;
  env_failed_title: string;

  // Environmental Metrics
  metric_soil_health: string;
  metric_air_quality: string;
  metric_weather_climate: string;
  metric_market_mandi: string;
  label_nitrogen: string;
  label_phosphorus: string;
  label_potassium: string;
  label_ph: string;
  label_organic_carbon: string;
  label_temp: string;
  label_humidity: string;
  label_rainfall: string;
  label_wind: string;
  label_aqi: string;
  status_safe: string;
  status_moderate: string;
  status_unhealthy: string;

  // Crop Viability Simulator
  sim_title: string;
  sim_subtitle: string;
  sim_select_crop_prompt: string;
  sim_pick_date_prompt: string;
  sim_run_btn: string;
  sim_estimated_yield: string;
  sim_projected_revenue: string;
  sim_viability_score: string;
  sim_favorable: string;
  sim_elevated_risk: string;

  // AI Assistant
  ai_assistant_title: string;
  ai_assistant_sub: string;
  ai_greeting_prefix: string;
  ai_greeting_body: string;
  ai_input_placeholder: string;
  ai_thinking: string;
  ai_voice_listening: string;
  ai_voice_speak: string;
  ai_voice_stop: string;
  ai_voice_unsupported: string;
  ai_suggestions: string[];
}
