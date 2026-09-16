# Cota do Climão ☀️🌡️💨🌬️🌧️

**Progressive Web App** de "exame de sangue climático" para **Regência, Linhares-ES** — quanto o tempo concede ou retira hoje: calor, sol, vento, umidade, ar e chuva, com um índice agregado de **Preocupação** (0–100).

> Não é um app de consumo — é a **concessão do clima**. O tempo diz o que está liberado, suspenso, ou "estourado"; você decide como usar.

---

## 🎯 Pilotar em Regência (ES)

Regência, Linhares-ES (≈ `-19.52, -39.78`) — vila costeira na foz do Rio Doce, Mata Atlântica, clima tropical úmido. Público: moradores, pescadores e agricultores.

## 🧪 As 6 cotas + Preocupação

| Cota | Fonte | Ciência |
|------|-------|---------|
| 🌡️ **Calor** (WBGT outdoor) | Open-Meteo Forecast | NIOSH 2016 / ISO 7933 |
| ☀️ **Sol** (UV Index) | Open-Meteo Air Quality | WHO / EPA |
| 💨 **Vento** (Beaufort) | Open-Meteo Forecast | OMM |
| 💦 **Umidade** (bulbo úmido) | Open-Meteo Forecast | WB 25–35°C |
| 🌬️ **Ar** (AQI) | Open-Meteo Air Quality | WHO 2021 |
| 🌧️ **Chuva** (prob. + mm) | Open-Meteo Forecast | <30% baixo / >80% alto |
| 😰 **Preocupação** | Cálculo próprio | Ponderado (Calor 35 · Sol 15 · Umid 15 · Ar 15 · Vento 10 · Chuva 10) |

> No **modo El Niño** os pesos mudam automaticamente (Calor 40 · Ar 20) e aparecem alertas extras (seca, queimadas).

## 🧰 Stack

- **100% vanilla JS** — zero dependências
- **PWA**: manifest + Service Worker (Stale-While-Revalidate)
- **Offline-first**: IndexedDB com schema versionado; retry com backoff (1s→2s→4s→8s)
- **Tema adaptativo**: dark/light automático via `light-dark()`
- **WCAG AA**: ícones + cor + texto (daltonismo), `prefers-reduced-motion`, `:focus-visible`

## 🗂️ Estrutura

```
TORTADECLIMAO/
├── index.html            Dashboard (blood test)
├── manifest.json         PWA manifest
├── sw.js                 Service Worker (SWR)
├── css/style.css         Tema adaptativo
├── js/
│   ├── calculations.js   WBGT ISO 7933, AQI, Beaufort, Bulbo Úmido
│   ├── factors.js        Definições das 6 cotas + pesos + personas
│   ├── risk.js           Score de Preocupação
│   ├── api.js            Open-Meteo (Forecast/AQ/Marine) + retry
│   ├── storage.js        IndexedDB v1 (SWR)
│   ├── recommendations.js Linguagem variada + persona
│   └── app.js            Orquestração + render
├── icons/                Ícones PWA (gerados)
└── CONVERSATION_LOG.md    Registro de decisões
```

## 🚀 Rodar

Sem build/dependências. Sirva a pasta:

```bash
cd TORTADECLIMAO
python3 -m http.server 8080
# abra http://localhost:8080
```

> Para testar a instalação PWA e o offline use HTTPS ou `localhost`.

## 🕐 Atualização de dados

- Chamadas Open-Meteo: Forecast 16 dias, Air Quality (hoje amanhã), Marine (ondas/temp)
- Retry: 1s → 2s → 4s → 8s → fallback pro último cache no IndexedDB
- Banner visível quando os dados estão stale/offline

## 📚 Referências científicas

- NIOSH (2016) — critérios de estresse térmico / WBGT
- ISO 7933 — WBGT outdoor (estimativa Liljegren)
- WHO (2021) — diretrizes de qualidade do ar (PM2.5/PM10/O₃/NO₂)
- WHO/EPA — Índice UV e tempo seguro de exposição
- OMM — Escala de Beaufort
- CPTEC/INPE, NOAA (CPC) — monitoramento El Niño (ONI)

---

Feito para a gente entender o tempo — e sobreviver a ele. 🌊🧡
