# Scrollout

**Scrollout** capture et analyse ton activité Instagram pour produire un rapport structuré de ta consommation : quels contenus vus, combien de temps sur chacun, quelle catégorie, quelle origine (organique/algo/pub).

## Workflow

```
Capture → Enrichissement sémantique → Scoring politique/polarisation → Wrapped
```

1. **Capture** — AccessibilityService Android extrait l'arbre UI Instagram en temps réel
2. **Analyse** — Catégorisation automatique, dwell time, niveaux d'attention
3. **Enrichissement** — Pipeline hybride règles + LLM (Ollama/OpenAI) : taxonomie 5 niveaux, scoring politique, polarisation, narratif, émotions
4. **Wrapped** — Rapport visuel style Spotify Wrapped avec 19 slides animées

## Architecture

```
scrollout/
├── src/                        # Scripts TypeScript (PC-side)
│   ├── capture.ts              # Capture temps réel logcat
│   ├── analyzer.ts             # Analyse session + ingest SQLite
│   ├── enrichment/             # Pipeline sémantique (rules + LLM)
│   │   ├── pipeline.ts         # Orchestration normalize → rules → LLM → persist
│   │   ├── rules-engine.ts     # Classification par dictionnaires
│   │   ├── llm/                # Ollama / OpenAI providers
│   │   └── dictionaries/       # Taxonomie, acteurs politiques, hashtags
│   ├── media/                  # Transcription audio (Whisper)
│   └── db/                     # Prisma client + ingest SQLite
├── echa-app/                   # App Capacitor (Android)
│   ├── src/
│   │   ├── screens/            # screen-home, screen-wrapped, screen-transparence
│   │   ├── services/           # db-bridge, graph-ingest, enrichment-daemon
│   │   └── tracker/            # scrollout-ui (WebView Instagram)
│   └── android/                # Projet Android (Capacitor)
├── echa-android/               # APK AccessibilityService (Java)
├── prisma/                     # Schema SQLite (Session, Post, PostSemantic)
├── scripts/                    # Utilitaires (scan-devices, etc.)
├── docs/                       # Roadmap, replanification
└── scrollout-site/             # Landing page (Astro)
```

## Quick Start

```bash
npm install
npm run db:generate
```

### Capture

```bash
npm run devices                          # Scan appareils ADB
npx tsx src/capture.ts [seconds]         # Capture temps réel
npx tsx src/auto-capture.ts [n] [ms]     # Auto-scroll + capture
```

### Enrichissement

```bash
npm run enrich                           # Ollama (local, gratuit)
npx tsx src/enrich.ts --openai           # OpenAI (cloud)
npm run enrich:rules                     # Rules only (pas de LLM)
npx tsx src/enrich.ts --with-audio       # + transcription Whisper
```

### App Android

```bash
cd echa-app && npx vite build && npx cap sync android
cd android && ./gradlew assembleDebug
```

### Tests

```bash
npm test                                 # Vitest (tous les tests)
npm run test:watch                       # Watch mode
```

## Stack

| Composant | Technologie |
|-----------|-------------|
| Scripts | TypeScript + tsx |
| App mobile | Capacitor 8 + Lit |
| AccessibilityService | Java (Android natif) |
| Database | SQLite + Prisma |
| Enrichissement | Ollama / OpenAI |
| Transcription | Whisper (local + API) |
| Landing page | Astro |

## Pipeline d'enrichissement

```
Post brut → Normalize → Rules Engine → LLM Classify → Merge → PostSemantic
```

- **Taxonomie 5 niveaux** : domaine → thème → sujet → sujet précis → marqueurs
- **Scoring politique** : 0 (neutre) → 4 (militant)
- **Polarisation** : 0 (factuel) → 1 (polarisant)
- **Narratif** : apocalyptique, héroïque, oppression, nous-vs-eux, etc.
- **Émotions** : colère, peur, joie, espoir, dégoût, etc.

## Niveaux d'attention

| Niveau | Durée | Signification |
|--------|-------|---------------|
| `skipped` | < 0.5s | Scrollé sans regarder |
| `glanced` | 0.5–2s | Vu rapidement |
| `viewed` | 2–5s | Consulté |
| `engaged` | > 5s | Engagement fort |

## Prérequis

- Node.js LTS
- ADB (`~/lab/platform-tools/adb.exe`)
- Ollama (optionnel, pour enrichissement local)
- ffmpeg (optionnel, pour transcription audio)

## Licence

Projet privé.
