/**
 * Cota do Climão — Storage (IndexedDB)
 * Schema versioned: v1
 * Estratégia: Stale-While-Revalidate (nunca Cache-First para dados climáticos)
 */
(function () {
  'use strict';

  const DB_NAME = 'cota-do-climao';
  const DB_VERSION = 1;

  const STORES = {
    weather: 'weather',       // chave: 'regencia-YYYY-MM-DD'
    meta: 'meta',             // chave: 'last-update', 'schema', 'el-nino'
  };

  function openDB() {
    return new Promise((resolve, reject) => {
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
      req.onerror = () => reject(req.error);
    });
  }

  async function put(storeName, obj) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(obj);
      tx.oncomplete = () => resolve(obj);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function get(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAll(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveWeatherDay(dateStr, payload) {
    await put(STORES.weather, { date: dateStr, data: payload, savedAt: Date.now() });
  }

  async function loadWeatherDay(dateStr) {
    return get(STORES.weather, dateStr);
  }

  async function saveMeta(key, value) {
    await put(STORES.meta, { key, value, savedAt: Date.now() });
  }

  async function loadMeta(key) {
    const row = await get(STORES.meta, key);
    return row ? row.value : null;
  }

  window.ClimStorage = {
    saveWeatherDay,
    loadWeatherDay,
    saveMeta,
    loadMeta,
    getAll,
    STORES,
  };
})();