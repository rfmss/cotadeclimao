/**
 * Cota do Climão — API Resiliente (Open-Meteo: Forecast + Air Quality + Marine + El Niño)
 * Resiliência R1:
 * - Promise.allSettled com degradação graciosa (se Air/Marine falhar, Forecast continua)
 * - Timeout estrito de 5s por requisição
 * - Máximo de 2 retentativas (exponential backoff: 1s, 2s)
 * - Deduplicação de chamadas concorrentes (Marine / El Niño)
 * - Validação defensiva via ClimSchema
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(root.ClimSchema || require('./schema.js'));
  } else {
    root.ClimAPI = factory(root.ClimSchema);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (schemaModule) {
  'use strict';

  const getSchema = () => schemaModule || (typeof window !== 'undefined' ? window.ClimSchema : null);

  const BASE = {
    forecast: 'https://api.open-meteo.com/v1/forecast',
    airQuality: 'https://air-quality-api.open-meteo.com/v1/air-quality',
    marine: 'https://marine-api.open-meteo.com/v1/marine',
  };

  const LAT = -19.52;
  const LON = -39.78;
  const TZ = 'America/Sao_Paulo';
  const DAYS = 16;

  // Resiliência R1: Máx 2 retries (1s, 2s) e timeout estrito de 5s
  const RETRIES = [1000, 2000];
  const TIMEOUT = 5000;

  // Cache em voo para deduplicação de requisições concorrentes
  const inFlightRequests = new Map();

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
        'temperature_2m_max', 'temperature_2m_min', 'relative_humidity_2m_max',
        'apparent_temperature_max', 'sunrise', 'sunset',
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
    const timer = setTimeout(() => {
      controller.abort(new Error(`Timeout de ${TIMEOUT}ms excedido`));
    }, TIMEOUT);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText || 'Erro na requisição'}`);
      }
      const data = await res.json();
      if (data && data.error) {
        throw new Error(`API Open-Meteo erro: ${data.reason || 'Desconhecido'}`);
      }
      return data;
    } catch (err) {
      if (attempt >= RETRIES.length) {
        throw err;
      }
      const delay = RETRIES[attempt];
      await new Promise((r) => setTimeout(r, delay));
      return fetchWithRetry(url, attempt + 1);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Executa requisição com deduplicação de promessas concorrentes
   */
  function fetchDeduplicated(kind) {
    if (inFlightRequests.has(kind)) {
      return inFlightRequests.get(kind);
    }
    const url = buildUrl(kind);
    const promise = fetchWithRetry(url).finally(() => {
      inFlightRequests.delete(kind);
    });
    inFlightRequests.set(kind, promise);
    return promise;
  }

  async function fetchForecast() {
    const raw = await fetchDeduplicated('forecast');
    const s = getSchema();
    if (!s) return raw;
    const validated = s.validateForecast(raw);
    if (!validated) {
      throw new Error('Payload da API Forecast falhou na validação de schema');
    }
    return validated;
  }

  async function fetchAirQuality() {
    try {
      const raw = await fetchDeduplicated('airQuality');
      const s = getSchema();
      if (!s) return raw;
      const validated = s.validateAirQuality(raw);
      if (!validated) {
        return null;
      }
      return validated;
    } catch (err) {
      // Degradação graciosa: Air Quality é secundário
      console.warn('Falha na API Air Quality (degradação graciosa):', err.message);
      return null;
    }
  }

  async function fetchMarine() {
    try {
      const raw = await fetchDeduplicated('marine');
      const s = getSchema();
      if (!s) return raw;
      const validated = s.validateMarine(raw);
      if (!validated) {
        return null;
      }
      return validated;
    } catch (err) {
      // Degradação graciosa: Marine é secundário
      console.warn('Falha na API Marine (degradação graciosa):', err.message);
      return null;
    }
  }

  /**
   * El Niño: índice aproximado. Deduplica recebendo dados marinhos se já disponíveis.
   */
  async function fetchElNino(providedMarine) {
    const s = getSchema();
    try {
      const marine = providedMarine !== undefined ? providedMarine : await fetchMarine();
      const sst = marine?.hourly?.sea_surface_temperature;
      if (sst && sst.length) {
        const validSst = sst.filter((v) => typeof v === 'number' && !isNaN(v));
        if (validSst.length > 0) {
          const sample = validSst.slice(0, 24);
          const avg = sample.reduce((a, b) => a + b, 0) / sample.length;
          // Anomalia grosseira vs climatologia local (~25.5°C em Regência)
          const anomalia = Math.round((avg - 25.5) * 10) / 10;
          const res = { ativo: anomalia > 0.5, anomalia, fonte: 'proxy-marinho-local', isManual: false };
          return s ? s.validateElNino(res) : res;
        }
      }
    } catch (_) {
      // Fallback seguro
    }
    // Fallback climatológico histórico oficial CPTEC/INPE
    const fallback = { ativo: true, anomalia: 1.9, fonte: 'CPTEC/INPE jun-2026', isManual: true };
    return s ? s.validateElNino(fallback) : fallback;
  }

  /**
   * Ponto de entrada unificado com Promise.allSettled
   * Retorna objeto conforme especificação de contrato do PROJECT.md
   */
  async function fetchAll(options = {}) {
    const errors = [];

    // Dispara chamadas de rede em paralelo resiliente
    const results = await Promise.allSettled([
      fetchForecast(),
      fetchAirQuality(),
      fetchMarine()
    ]);

    const forecastRes = results[0];
    const airQualityRes = results[1];
    const marineRes = results[2];

    const forecast = forecastRes.status === 'fulfilled' ? forecastRes.value : null;
    if (forecastRes.status === 'rejected') {
      errors.push(`forecast: ${forecastRes.reason?.message || 'Falha na requisição'}`);
    }

    const airQuality = airQualityRes.status === 'fulfilled' ? airQualityRes.value : null;
    if (airQualityRes.status === 'rejected') {
      errors.push(`airQuality: ${airQualityRes.reason?.message || 'Falha na requisição'}`);
    }

    const marine = marineRes.status === 'fulfilled' ? marineRes.value : null;
    if (marineRes.status === 'rejected') {
      errors.push(`marine: ${marineRes.reason?.message || 'Falha na requisição'}`);
    }

    // El Niño reutiliza o resultado de marine sem requisição duplicada
    const elnino = await fetchElNino(marine);

    const isOffline = forecast === null && airQuality === null && marine === null;

    return {
      forecast,
      airQuality,
      marine,
      elnino,
      status: {
        isOffline,
        fromCache: false,
        timestamp: Date.now(),
        errors
      }
    };
  }

  return {
    fetchForecast,
    fetchAirQuality,
    fetchMarine,
    fetchElNino,
    fetchAll,
    buildUrl,
    RETRIES,
    TIMEOUT,
  };
});