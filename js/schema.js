/**
 * Cota do Climão — Schema & Validação Defensiva (Camada de Tipos R1)
 * Garante fidelidade de tipos, limites físicos e coerção defensiva.
 * Valores ausentes recebem estado explícito 'indisponivel' (evita mascarar risco como 'bom').
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.ClimSchema = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Limites biofísicos para validação defensiva
   */
  const BOUNDS = {
    temperature: { min: -20, max: 55, unit: '°C' },
    humidity: { min: 0, max: 100, unit: '%' },
    windSpeed: { min: 0, max: 250, unit: 'km/h' },
    windGust: { min: 0, max: 300, unit: 'km/h' },
    rainProbability: { min: 0, max: 100, unit: '%' },
    precipitation: { min: 0, max: 500, unit: 'mm' },
    uv: { min: 0, max: 20, unit: 'UV' },
    aqi: { min: 0, max: 500, unit: 'IDX' },
    wbgt: { min: -10, max: 50, unit: '°C' },
    solarRadiation: { min: 0, max: 1500, unit: 'W/m²' },
    cloudCover: { min: 0, max: 100, unit: '%' },
    waveHeight: { min: 0, max: 30, unit: 'm' },
    wavePeriod: { min: 0, max: 35, unit: 's' },
    seaSurfaceTemp: { min: -2, max: 40, unit: '°C' },
    soilMoisture: { min: 0, max: 1, unit: 'm³/m³' }
  };

  /**
   * Verifica se o valor é numérico válido e finito
   */
  function isValidNumber(val) {
    return typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val);
  }

  /**
   * Coerção segura para número dentro de limites
   */
  function sanitizeBound(val, boundKey) {
    if (!isValidNumber(val)) return null;
    const b = BOUNDS[boundKey];
    if (!b) return val;
    return Math.max(b.min, Math.min(b.max, val));
  }

  /**
   * Validação de estrutura do Forecast Open-Meteo
   */
  function validateForecast(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!raw.daily || typeof raw.daily !== 'object') return null;
    if (!Array.isArray(raw.daily.time) || raw.daily.time.length === 0) return null;
    if (!Array.isArray(raw.daily.temperature_2m_max)) return null;

    return {
      latitude: isValidNumber(raw.latitude) ? raw.latitude : null,
      longitude: isValidNumber(raw.longitude) ? raw.longitude : null,
      timezone: typeof raw.timezone === 'string' ? raw.timezone : 'America/Sao_Paulo',
      daily: {
        time: raw.daily.time.map(String),
        temperature_2m_max: raw.daily.temperature_2m_max.map((v) => sanitizeBound(v, 'temperature')),
        temperature_2m_min: Array.isArray(raw.daily.temperature_2m_min)
          ? raw.daily.temperature_2m_min.map((v) => sanitizeBound(v, 'temperature'))
          : [],
        relative_humidity_2m_max: Array.isArray(raw.daily.relative_humidity_2m_max)
          ? raw.daily.relative_humidity_2m_max.map((v) => sanitizeBound(v, 'humidity'))
          : [],
        apparent_temperature_max: Array.isArray(raw.daily.apparent_temperature_max)
          ? raw.daily.apparent_temperature_max.map((v) => sanitizeBound(v, 'temperature'))
          : [],
        uv_index_max: Array.isArray(raw.daily.uv_index_max)
          ? raw.daily.uv_index_max.map((v) => sanitizeBound(v, 'uv'))
          : [],
        wind_speed_10m_max: Array.isArray(raw.daily.wind_speed_10m_max)
          ? raw.daily.wind_speed_10m_max.map((v) => sanitizeBound(v, 'windSpeed'))
          : [],
        wind_gusts_10m_max: Array.isArray(raw.daily.wind_gusts_10m_max)
          ? raw.daily.wind_gusts_10m_max.map((v) => sanitizeBound(v, 'windGust'))
          : [],
        precipitation_probability_max: Array.isArray(raw.daily.precipitation_probability_max)
          ? raw.daily.precipitation_probability_max.map((v) => sanitizeBound(v, 'rainProbability'))
          : [],
        precipitation_sum: Array.isArray(raw.daily.precipitation_sum)
          ? raw.daily.precipitation_sum.map((v) => sanitizeBound(v, 'precipitation'))
          : [],
        sunrise: Array.isArray(raw.daily.sunrise) ? raw.daily.sunrise : [],
        sunset: Array.isArray(raw.daily.sunset) ? raw.daily.sunset : [],
      },
      hourly: raw.hourly && typeof raw.hourly === 'object' ? {
        time: Array.isArray(raw.hourly.time) ? raw.hourly.time : [],
        temperature_2m: Array.isArray(raw.hourly.temperature_2m) ? raw.hourly.temperature_2m : [],
        relative_humidity_2m: Array.isArray(raw.hourly.relative_humidity_2m) ? raw.hourly.relative_humidity_2m : [],
        apparent_temperature: Array.isArray(raw.hourly.apparent_temperature) ? raw.hourly.apparent_temperature : [],
        wet_bulb_temperature_2m: Array.isArray(raw.hourly.wet_bulb_temperature_2m) ? raw.hourly.wet_bulb_temperature_2m : [],
        wind_speed_10m: Array.isArray(raw.hourly.wind_speed_10m) ? raw.hourly.wind_speed_10m : [],
        shortwave_radiation: Array.isArray(raw.hourly.shortwave_radiation) ? raw.hourly.shortwave_radiation : [],
        cloud_cover: Array.isArray(raw.hourly.cloud_cover) ? raw.hourly.cloud_cover : [],
        soil_moisture_0_to_10cm: Array.isArray(raw.hourly.soil_moisture_0_to_10cm) ? raw.hourly.soil_moisture_0_to_10cm : [],
        uv_index: Array.isArray(raw.hourly.uv_index) ? raw.hourly.uv_index : [],
      } : null,
      _validated: true,
      _source: 'open-meteo-forecast'
    };
  }

  /**
   * Validação de Air Quality
   */
  function validateAirQuality(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!raw.hourly || typeof raw.hourly !== 'object') return null;

    const hourly = raw.hourly;
    const hasAnyPollutant = ['pm2_5', 'pm10', 'ozone', 'nitrogen_dioxide', 'european_aqi', 'us_aqi']
      .some((k) => Array.isArray(hourly[k]) && hourly[k].length > 0);

    if (!hasAnyPollutant) return null;

    return {
      hourly: {
        time: Array.isArray(hourly.time) ? hourly.time : [],
        pm2_5: Array.isArray(hourly.pm2_5) ? hourly.pm2_5 : [],
        pm10: Array.isArray(hourly.pm10) ? hourly.pm10 : [],
        ozone: Array.isArray(hourly.ozone) ? hourly.ozone : (Array.isArray(hourly.o3) ? hourly.o3 : []),
        nitrogen_dioxide: Array.isArray(hourly.nitrogen_dioxide) ? hourly.nitrogen_dioxide : (Array.isArray(hourly.no2) ? hourly.no2 : []),
        european_aqi: Array.isArray(hourly.european_aqi) ? hourly.european_aqi : [],
        us_aqi: Array.isArray(hourly.us_aqi) ? hourly.us_aqi : [],
      },
      _validated: true,
      _source: 'open-meteo-air-quality'
    };
  }

  /**
   * Validação de dados Marinhos
   */
  function validateMarine(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!raw.hourly || typeof raw.hourly !== 'object') return null;

    const hourly = raw.hourly;
    const hasMarine = Array.isArray(hourly.wave_height) || Array.isArray(hourly.sea_surface_temperature);
    if (!hasMarine) return null;

    return {
      hourly: {
        time: Array.isArray(hourly.time) ? hourly.time : [],
        wave_height: Array.isArray(hourly.wave_height) ? hourly.wave_height.map((v) => sanitizeBound(v, 'waveHeight')) : [],
        wave_period: Array.isArray(hourly.wave_period) ? hourly.wave_period.map((v) => sanitizeBound(v, 'wavePeriod')) : [],
        wave_direction: Array.isArray(hourly.wave_direction) ? hourly.wave_direction : [],
        ocean_current_velocity: Array.isArray(hourly.ocean_current_velocity) ? hourly.ocean_current_velocity : [],
        sea_surface_temperature: Array.isArray(hourly.sea_surface_temperature) ? hourly.sea_surface_temperature.map((v) => sanitizeBound(v, 'seaSurfaceTemp')) : []
      },
      daily: raw.daily && typeof raw.daily === 'object' ? raw.daily : null,
      _validated: true,
      _source: 'open-meteo-marine'
    };
  }

  /**
   * Validação de El Niño
   */
  function validateElNino(raw) {
    if (!raw || typeof raw !== 'object') {
      return { ativo: false, anomalia: 0, fonte: 'default-neutro', isManual: false };
    }
    return {
      ativo: Boolean(raw.ativo),
      anomalia: isValidNumber(raw.anomalia) ? Math.round(raw.anomalia * 10) / 10 : 0,
      fonte: typeof raw.fonte === 'string' ? raw.fonte : 'desconhecida',
      isManual: Boolean(raw.isManual)
    };
  }

  /**
   * Cria fator com status explícito 'indisponivel'
   * Evita a armadilha de classificar dados ausentes como 'bom' (10 pontos no risco).
   */
  function createIndisponivelFactor(factorDef) {
    return {
      ...factorDef,
      valor: null,
      nivel: {
        nivel: 'indisponivel',
        rotulo: 'Indisponível'
      },
      indisponivel: true
    };
  }

  return {
    BOUNDS,
    isValidNumber,
    sanitizeBound,
    validateForecast,
    validateAirQuality,
    validateMarine,
    validateElNino,
    createIndisponivelFactor
  };
});
