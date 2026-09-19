/**
 * Cota do Climão — Storage Resiliente Multi-Tier (IndexedDB + LocalStorage + Memória)
 * Resiliência R1:
 * - Ponteiro persistente de snapshot 'latest'
 * - Resolvedor de projeção de 16 dias para dias subsequentes sem internet
 * - Fallback transparente para localStorage quando IndexedDB estiver inacessível
 * - Memória volátil para ambientes restritos (Node.js / iframe sandboxed)
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.ClimStorage = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DB_NAME = 'cota-do-climao';
  const DB_VERSION = 1;

  const STORES = {
    weather: 'weather', // chave: 'regencia-YYYY-MM-DD' ou 'YYYY-MM-DD' ou 'latest'
    meta: 'meta',       // chave: 'last-update', 'schema', 'latest_snapshot'
  };

  // Fallback in-memory quando IndexedDB e localStorage forem restritos
  const memoryStore = {
    [STORES.weather]: new Map(),
    [STORES.meta]: new Map(),
  };

  function hasIndexedDB() {
    return typeof indexedDB !== 'undefined';
  }

  function hasLocalStorage() {
    try {
      return typeof localStorage !== 'undefined' && localStorage !== null;
    } catch (_) {
      return false;
    }
  }

  function lsGet(key) {
    if (!hasLocalStorage()) return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function lsSet(key, val) {
    if (!hasLocalStorage()) return;
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {
      // quota excedida ou storage bloqueado
    }
  }

  let dbPromise = null;
  function openDB() {
    if (!hasIndexedDB()) return Promise.reject(new Error('IndexedDB indisponível'));
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (ev) => {
          const db = ev.target.result;
          if (!db.objectStoreNames.contains(STORES.weather)) {
            db.createObjectStore(STORES.weather, { keyPath: 'date' });
          }
          if (!db.objectStoreNames.contains(STORES.meta)) {
            db.createObjectStore(STORES.meta, { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          dbPromise = null;
          reject(req.error || new Error('Erro ao abrir IndexedDB'));
        };
      } catch (err) {
        dbPromise = null;
        reject(err);
      }
    });

    return dbPromise;
  }

  async function put(storeName, obj) {
    // 1. Grava no cache de memória imediato
    const key = obj.date || obj.key;
    if (key && memoryStore[storeName]) {
      memoryStore[storeName].set(key, obj);
    }

    // 2. Grava no LocalStorage como espelho de segurança
    if (storeName === STORES.weather && key) {
      lsSet(`cota_weather_${key}`, obj);
      if (key === 'latest') {
        lsSet('cota_latest_weather', obj);
      }
    } else if (storeName === STORES.meta && key) {
      lsSet(`cota_meta_${key}`, obj);
    }

    // 3. Tenta persistência em IndexedDB
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(obj);
        tx.oncomplete = () => resolve(obj);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      // IndexedDB indisponível: localStorage já garantiu a persistência
      return obj;
    }
  }

  async function get(storeName, key) {
    // 1. Tenta IndexedDB
    try {
      const db = await openDB();
      const res = await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      if (res) return res;
    } catch (_) {
      // Fallback transparente
    }

    // 2. Tenta LocalStorage
    if (storeName === STORES.weather) {
      const lsObj = lsGet(`cota_weather_${key}`);
      if (lsObj) return lsObj;
      if (key === 'latest') {
        const lsLatest = lsGet('cota_latest_weather');
        if (lsLatest) return lsLatest;
      }
    } else if (storeName === STORES.meta) {
      const lsMeta = lsGet(`cota_meta_${key}`);
      if (lsMeta) return lsMeta;
    }

    // 3. Tenta Memória
    if (memoryStore[storeName] && memoryStore[storeName].has(key)) {
      return memoryStore[storeName].get(key);
    }

    return null;
  }

  async function getAll(storeName) {
    try {
      const db = await openDB();
      const res = await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      if (res && res.length) return res;
    } catch (_) {
      // Fallback
    }

    // Fallback memória
    if (memoryStore[storeName]) {
      return Array.from(memoryStore[storeName].values());
    }
    return [];
  }

  /**
   * Salva o estado do dia E atualiza o ponteiro 'latest'
   */
  async function saveWeatherDay(dateStr, payload) {
    const savedAt = Date.now();
    const entry = { date: dateStr, data: payload, savedAt };

    // Salva a chave específica do dia
    await put(STORES.weather, entry);

    // Salva o snapshot persistente 'latest'
    const latestEntry = { date: 'latest', sourceDate: dateStr, data: payload, savedAt };
    await put(STORES.weather, latestEntry);

    // Espelha no meta
    await put(STORES.meta, { key: 'latest_snapshot', value: latestEntry, savedAt });
    lsSet('cota_latest_weather', latestEntry);

    return entry;
  }

  /**
   * Carrega o snapshot mais recente disponível em cache
   */
  async function loadLatestWeather() {
    // 1. Tenta chave 'latest'
    let row = await get(STORES.weather, 'latest');
    if (row && row.data) return row;

    // 2. Tenta meta 'latest_snapshot'
    const metaSnap = await get(STORES.meta, 'latest_snapshot');
    if (metaSnap && (metaSnap.value?.data || metaSnap.data)) {
      return metaSnap.value || metaSnap;
    }

    // 3. Tenta LocalStorage 'cota_latest_weather'
    const lsSnap = lsGet('cota_latest_weather');
    if (lsSnap && lsSnap.data) return lsSnap;

    // 4. Varre todos os registros e pega o mais recente por timestamp
    const all = await getAll(STORES.weather);
    if (all && all.length) {
      const sorted = all
        .filter((item) => item && item.data && item.date !== 'latest')
        .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
      if (sorted.length > 0) return sorted[0];
    }

    return null;
  }

  /**
   * Carrega a previsão para uma data específica com Resolvedor de Projeção de 16 dias:
   * Se a chave do dia exato não existir, busca o snapshot 'latest' e resolve
   * se a data requisitada está coberta pela janela de 16 dias em cache.
   */
  async function loadWeatherDay(dateStr) {
    // 1. Busca exata por dataStr
    const exact = await get(STORES.weather, dateStr);
    if (exact && exact.data) return exact;

    // 2. Resolvedor de Projeção a partir do snapshot 'latest'
    const latest = await loadLatestWeather();
    if (!latest || !latest.data) return null;

    const forecast = latest.data.forecast || latest.data.data?.forecast;
    const dailyTimes = forecast?.daily?.time;

    // Verifica se a data requisitada existe na projeção de 16 dias
    if (Array.isArray(dailyTimes) && dailyTimes.includes(dateStr)) {
      return {
        date: dateStr,
        sourceDate: latest.date || latest.sourceDate,
        data: latest.data.data ? latest.data.data : latest.data,
        maps: latest.data.maps || null,
        savedAt: latest.savedAt,
        isProjected: true
      };
    }

    // Se não estiver na lista ou se não houver dailyTimes,
    // retorna o snapshot 'latest' como fallback resiliente (evita quebrar offline)
    return {
      date: dateStr,
      sourceDate: latest.date || latest.sourceDate,
      data: latest.data.data ? latest.data.data : latest.data,
      maps: latest.data.maps || null,
      savedAt: latest.savedAt,
      isStaleFallback: true
    };
  }

  async function saveMeta(key, value) {
    return put(STORES.meta, { key, value, savedAt: Date.now() });
  }

  async function loadMeta(key) {
    const row = await get(STORES.meta, key);
    if (!row) return null;
    return row.value !== undefined ? row.value : row;
  }

  return {
    saveWeatherDay,
    loadWeatherDay,
    loadLatestWeather,
    saveMeta,
    loadMeta,
    getAll,
    STORES,
  };
});