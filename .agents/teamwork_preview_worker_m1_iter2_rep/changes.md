# Changes Report — Milestone M1 Iteration 2 Remediation

**Worker Agent:** `teamwork_preview_worker_m1_iter2_rep`  
**Date:** 2026-09-19T04:37:00Z  
**Milestone:** M1 Iteration 2 (Data Engine & API Resilience Remediation)  

---

## 1. Summary of Changes

Two targeted resilience deficiencies identified by Challenger 1 were remediated:

1. **`js/app.js` — Corrupt Cache Fallback Hardening:**
   - **Problem:** When cached data was present in storage but lacked a valid `forecast` property (e.g. from partial saves, corrupt payload, or malformed mock objects), `bootstrap()` proceeded to `buildDaily(data.forecast.daily, ...)` which caused an unhandled `TypeError: Cannot read properties of undefined (reading 'daily')`. This left the dashboard indefinitely frozen in `data-state="loading"`, omitting `#err-box`.
   - **Fix:** In `bootstrap()`, `candidate` cached data is now explicitly verified to contain `candidate.forecast && candidate.forecast.daily`. If missing or invalid:
     - `#err-box` is shown with text `'SEM CONEXÃO E SEM REGISTRO — ABRA O APP ONLINE AO MENOS UMA VEZ'`.
     - `#app-main` attribute `data-state` is set to `'ready'`.
     - Function returns cleanly.
     - `buildDaily`, `buildFatores`, and `render` are furthermore enclosed in a defensive `try/catch` block that triggers the same graceful error state should any unexpected structural mismatch occur.

2. **`js/api.js` — Schema Validation Bypass Remediation:**
   - **Problem:** In `fetchForecast`, `fetchAirQuality`, and `fetchMarine`, expressions used `|| raw` as fallback after schema validation (e.g. `s ? s.validateForecast(raw) || raw : raw`). When an API returned a mutated or malformed shape, `schema.validateX()` returned `null`, but the logical OR caused the invalid raw object to pass through to the application and persist into storage.
   - **Fix:** Removed all instances of `|| raw`:
     - In `fetchForecast()`: If `s.validateForecast(raw)` returns null, throws `Error('Payload da API Forecast falhou na validação de schema')`. In `fetchAll()`, `Promise.allSettled` catches this rejection, records the error in `status.errors`, sets `forecast: null`, and triggers offline/cache fallback.
     - In `fetchAirQuality()`: If `s.validateAirQuality(raw)` returns null, returns `null` for secondary degradation.
     - In `fetchMarine()`: If `s.validateMarine(raw)` returns null, returns `null` for secondary degradation.

---

## 2. File-by-File Diffs

### `js/app.js`
```diff
@@ -477,20 +477,32 @@
     // 2. Fallback para cache se não houver dados online de forecast
-    if (!data || !data.forecast) {
+    if (!data || !data.forecast || !data.forecast.daily) {
       // Tenta carregar pelo dia ou pelo resolvedor de projeção / latest
       let cachedRaw = await window.ClimStorage.loadWeatherDay(HOJE());
       if (!cachedRaw || !cachedRaw.data) {
         cachedRaw = await window.ClimStorage.loadLatestWeather();
       }
 
-      if (cachedRaw && cachedRaw.data) {
-        data = cachedRaw.data.data ? cachedRaw.data.data : cachedRaw.data;
+      const candidate = cachedRaw?.data?.data ? cachedRaw.data.data : cachedRaw?.data;
+      if (candidate && candidate.forecast && candidate.forecast.daily) {
+        data = candidate;
         meta.online = false;
         meta.staleAt = cachedRaw.savedAt || Date.now();
         meta.elNinoAtivo = !!(data.enino && data.enino.ativo);
         meta.enino = data.enino || null;
       } else {
         const errBox = document.getElementById('err-box');
         if (errBox) {
           errBox.hidden = false;
           errBox.textContent = 'SEM CONEXÃO E SEM REGISTRO — ABRA O APP ONLINE AO MENOS UMA VEZ';
         }
         const appMain = document.getElementById('app-main');
         if (appMain) appMain.setAttribute('data-state', 'ready');
         return;
       }
     }
 
+    try {
       const maps = buildDaily(data.forecast.daily, data.forecast.hourly, data.air, data.marine);
 
       // Se estiver online, persiste o estado no storage
       if (meta.online) {
         try {
           await window.ClimStorage.saveWeatherDay(HOJE(), { data, maps, savedAt: meta.updatedAt });
         } catch (_) {}
       }
 
       const fatores = buildFatores(maps);
       const risco = calcularRiscoSeguro(fatores, meta.elNinoAtivo);
       render(fatores, risco, maps, meta.enino, meta);
 
       window.ClimCurrent = { maps, fatores, risco, meta, enino: meta.enino };
+    } catch (renderErr) {
+      const errBox = document.getElementById('err-box');
+      if (errBox) {
+        errBox.hidden = false;
+        errBox.textContent = 'SEM CONEXÃO E SEM REGISTRO — ABRA O APP ONLINE AO MENOS UMA VEZ';
+      }
+      const appMain = document.getElementById('app-main');
+      if (appMain) appMain.setAttribute('data-state', 'ready');
+    }
```

### `js/api.js`
```diff
@@ -125,7 +125,12 @@
   async function fetchForecast() {
     const raw = await fetchDeduplicated('forecast');
     const s = getSchema();
-    return s ? s.validateForecast(raw) || raw : raw;
+    if (!s) return raw;
+    const validated = s.validateForecast(raw);
+    if (!validated) {
+      throw new Error('Payload da API Forecast falhou na validação de schema');
+    }
+    return validated;
   }
 
   async function fetchAirQuality() {
@@ -132,6 +137,11 @@
     try {
       const raw = await fetchDeduplicated('airQuality');
       const s = getSchema();
-      return s ? s.validateAirQuality(raw) || raw : raw;
+      if (!s) return raw;
+      const validated = s.validateAirQuality(raw);
+      if (!validated) {
+        return null;
+      }
+      return validated;
     } catch (err) {
       // Degradação graciosa: Air Quality é secundário
       console.warn('Falha na API Air Quality (degradação graciosa):', err.message);
@@ -142,7 +152,12 @@
     try {
       const raw = await fetchDeduplicated('marine');
       const s = getSchema();
-      return s ? s.validateMarine(raw) || raw : raw;
+      if (!s) return raw;
+      const validated = s.validateMarine(raw);
+      if (!validated) {
+        return null;
+      }
+      return validated;
     } catch (err) {
       // Degradação graciosa: Marine é secundário
       console.warn('Falha na API Marine (degradação graciosa):', err.message);
```
