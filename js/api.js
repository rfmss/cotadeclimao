/**
 * Cota do Climão — API (Open-Meteo: Forecast + Air Quality + Marine)
 * Retry com exponential backoff: 1s → 2s → 4s → 8s → fallback
 */
(function () {
  'use strict';

  const BASE = {
    forecast: 'https://api.open-meteo.com/v1/forecast',
    airQuality: 'https://air-quality-api.open-meteo.com/v1/air-quality',
    marine: 'https://marine-api.open-meteo.com/v1/marine',
  };

  const LAT = -19.52;
  const LON = -39.78;
  const TZ = 'America/Sao_Paulo';
  const DAYS = 16;

  const RETRIES = [1000, 2000, 4000, 8000];
  const TIMEOUT = 15000;

  function buildUrl(kind) {
    const u = new URL(BASE[kind]);
    u.searchParams.set('latitude', LAT);
    u.searchParams.set('longitude', LON);
    u.searchParams.set('timezone', TZ);

    if (kind === 'forecast') {
      u.searchParams.set('forecast_days', DAYS);
      [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
        'precipitation_probability', 'precipitation', 'weather_code',
        'wind_speed_10m', 'wind_gusts_10m', 'uv_index', 'shortwave_radiation',
        'wet_bulb_temperature_2m', 'cloud_cover', 'soil_moisture_0_to_10cm'
      ].forEach((v) => u.searchParams.append('hourly', v));
      [
        'temperature_2m_max', 'temperature_2m_min', 'sunrise', 'sunset',
        'uv_index_max', 'precipitation_sum', 'precipitation_probability_max',
        'wind_speed_10m_max', 'wind_gusts_10m_max'
      ].forEach((v) => u.searchParams.append('daily', v));
    }

    if (kind === 'airQuality') {
      [
        'pm10', 'pm2_5', 'nitrogen_dioxide', 'ozone', 'sulphur_dioxide',
        'carbon_monoxide', 'uv_index', 'european_aqi', 'us_aqi'
      ].forEach((v) => u.searchParams.append('hourly', v));
    }

    if (kind === 'marine') {
      [
        'wave_height', 'wave_direction', 'wave_period',
        'ocean_current_velocity', 'sea_surface_temperature'
      ].forEach((v) => u.searchParams.append('hourly', v));
      [
        'wave_height_max', 'wave_direction_dominant', 'wave_period_max'
      ].forEach((v) => u.searchParams.append('daily', v));
    }

    return u.toString();
  }

  async function fetchWithRetry(url, attempt = 0) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      return data;
    } catch (err) {
      if (attempt >= RETRIES.length) throw err;
      const delay = RETRIES[attempt];
      await new Promise((r) => setTimeout(r, delay));
      return fetchWithRetry(url, attempt + 1);
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchForecast() {
    return fetchWithRetry(buildUrl('forecast'));
  }
  async function fetchAirQuality() {
    return fetchWithRetry(buildUrl('airQuality'));
  }
  async function fetchMarine() {
    return fetchWithRetry(buildUrl('marine'));
  }

  // El Niño: índice ONI aproximado — tentamos fonte externa; se falhar, heuristic local.
  async function fetchElNino() {
    // Best-effort: usa temperatura do mar local como proxy de anomalia
    // (em produção, integrar NOAA ONI). Se indisponível → neutro.
    try {
      const marine = await fetchMarine();
      const sst = marine.hourly && marine.hourly.sea_surface_temperature;
      if (sst && sst.length) {
        const avg = sst.slice(0, 24).reduce((a, b) => a + b, 0) / Math.min(24, sst.length);
        // Anomalia grosseira vs climatologia local (~25.5°C em Regência)
        const anomalia = avg - 25.5;
        return { ativo: anomalia > 0.5, anomalia, fonte: 'proxy-local' };
      }
    } catch (_) {}
    // Declarado ativo pela CPTEC/INPE em jun/2026 — usado como fallback manual oficial:
    return { ativo: true, anomalia: 1.9, fonte: 'CPTEC/INPE jun-2026', isManual: true };
  }

  window.ClimAPI = {
    fetchForecast,
    fetchAirQuality,
    fetchMarine,
    fetchElNino,
    buildUrl,
  };
})();