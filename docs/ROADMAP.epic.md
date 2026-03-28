# ECHA — Roadmap Epics & Tasks

> Source de vérité pour le suivi d'avancement. Chaque epic correspond à un sprint du replan.
> Statuts : `done` | `in-progress` | `todo` | `blocked`

---

## EPIC-000 : Infrastructure de capture
**Statut** : `done`
**Description** : Capturer l'activité Instagram brute depuis un device Android.

| # | Tâche | Statut | Notes |
|---|-------|--------|-------|
| 000-1 | AccessibilityService Java (APK) | done | Logcat ECHA_DATA |
| 000-2 | Scripts ADB (dump UI, screenshot, auto-scroll) | done | `auto-capture.ts` |
| 000-3 | WebView Capacitor (tracker.js) | done | DOM parsing + IntersectionObserver |
| 000-4 | Logcat listener temps réel | done | `logcat-tap.ts` |
| 000-5 | Scan devices + WiFi ADB | done | `scan-devices.ts` |

---

## EPIC-001 : Data layer SQLite
**Statut** : `done`
**Description** : Stocker sessions et posts dans SQLite via Prisma.

| # | Tâche | Statut | Notes |
|---|-------|--------|-------|
| 001-1 | Schéma Prisma (Session, Post, PostSemantic) | done | `prisma/schema.prisma` |
| 001-2 | Pipeline ingestion _analysis.json → SQLite | done | `db/ingest.ts` |
| 001-3 | Auto-ingest depuis analyzer.ts | done | |
| 001-4 | Batch ingest-all.ts | done | |
| 001-5 | Visualizer debug (dashboard 6 panneaux) | done | `src/visualizer/` |

---

## EPIC-002 : Analyse basique posts
**Statut** : `done`
**Description** : Extraire et catégoriser les posts depuis les sessions brutes.

| # | Tâche | Statut | Notes |
|---|-------|--------|-------|
| 002-1 | Extraction posts depuis noeuds bruts | done | `analyzer.ts` |
| 002-2 | 16 catégories regex (2 passes) | done | primary + secondary blob |
| 002-3 | Calcul dwell time + attention levels | done | skipped/glanced/viewed/engaged |
| 002-4 | Rapport texte + JSON analysis | done | `_report.txt` + `_analysis.json` |

---

## EPIC-010 : Enrichissement post complet (`post_enriched`)
**Statut** : `done`
**Description** : Transformer chaque post brut en unité d'analyse sémantique et politique conforme au spec roadmap §6.

### Tâche 010-1 : Extension schéma Prisma
**Statut** : `done`

Étendre `PostSemantic` ou créer `PostEnriched` avec tous les champs cibles :
- `normalized_text` (consolidation caption+OCR+allText)
- `main_topics`, `secondary_topics` (JSON, multi-label)
- `content_domain`, `audience_target`
- `persons`, `organizations`, `political_actors` (JSON, entités nommées)
- `tone`, `primary_emotion`, `emotion_intensity`
- `political_explicitness_score` (Int 0-4)
- `political_issue_tags`, `public_policy_tags` (JSON)
- `institutional_reference_score` (Float)
- `activism_signal` (Bool)
- `polarization_score` (Float 0-1)
- `ingroup_outgroup_signal`, `conflict_signal`, `moral_absolute_signal`, `enemy_designation_signal` (Bool)
- `narrative_frame` (enum/string)
- `call_to_action_type` (enum/string)
- `problem_solution_pattern` (String)
- `confidence_score` (Float)
- `review_flag` (Bool)

### Tâche 010-2 : Dictionnaires et règles (couche 1)
**Statut** : `done`

Créer `src/enrichment/dictionaries/` :
- `political-actors.ts` — partis, élus, institutions FR
- `militant-hashtags.ts` — hashtags militants, causes, slogans
- `conflict-vocabulary.ts` — vocabulaire polarisant, indignation, opposition
- `topics-keywords.ts` — mots-clés par thème de la taxonomie (24 thèmes)

Créer `src/enrichment/rules-engine.ts` :
- Scoring politique rule-based (présence entités → score 0-4)
- Scoring polarisation rule-based (densité vocabulaire conflictuel → 0-1)
- Détection narratif simple (patterns textuels)

### Tâche 010-3 : Abstraction LLM + prompts (couche 2)
**Statut** : `done`

Créer `src/enrichment/llm/` :
- `provider.ts` — interface `LLMProvider` (call, models, cost)
- `openai.ts` — implémentation OpenAI (GPT-4o-mini)
- `ollama.ts` — implémentation Ollama (Llama 3 local)
- `prompts.ts` — prompt structuré pour enrichissement post :
  - résumé sémantique
  - classification multi-label (24 thèmes)
  - narratif (14 types)
  - portée politique (0-4) + justification
  - polarisation (0-1) + signaux détectés
  - entités nommées
  - appel à l'action (11 types)
  - confiance

### Tâche 010-4 : Consolidation texte (couche 4)
**Statut** : `done`

Créer `src/enrichment/normalize.ts` :
- Fusion caption + imageDesc (alt-text Instagram) + allText
- Nettoyage (emojis, mentions, URLs, whitespace)
- Détection langue
- Production `normalized_text`

### Tâche 010-5 : Pipeline d'enrichissement batch
**Statut** : `done`

Créer `src/enrichment/pipeline.ts` :
- Charger posts non enrichis depuis SQLite
- Pour chaque post : normalize → rules → LLM → merge → persist
- Rate limiting + retry
- Logs d'erreur + monitoring
- Mode batch (toute la base) + mode incrémental (nouveaux posts)

Script CLI : `src/enrich.ts` (entry point)

### Tâche 010-6 : Tests enrichissement
**Statut** : `done`

- Test unitaire dictionnaires (détection correcte entités politiques)
- Test unitaire rules-engine (scoring attendu sur posts exemples)
- Test intégration pipeline (20-50 posts réels → vérification sortie)

---

## EPIC-011 : Calibration post
**Statut** : `todo`
**Description** : Rendre les scores utilisables via annotation humaine et ajustement.

| # | Tâche | Statut | Notes |
|---|-------|--------|-------|
| 011-1 | Extraire 50-100 posts pour annotation | todo | Depuis sessions existantes |
| 011-2 | Créer format d'annotation + guide | todo | JSON avec score attendu par champ |
| 011-3 | Annoter manuellement | todo | Humain |
| 011-4 | Comparer scores système vs annotation | todo | Matrice confusion, accuracy |
| 011-5 | Ajuster seuils et dictionnaires | todo | Itérer |
| 011-6 | Flags review_flag pour cas ambigus | todo | |
| 011-7 | Rapport de calibration | todo | `docs/calibration-v1.md` |

---

## EPIC-020 : Profil utilisateur agrégé (`user_profile_mvp`)
**Statut** : `todo`
**Description** : Agréger les posts enrichis pour produire un profil de consommation par utilisateur.
**Dépend de** : EPIC-010, EPIC-011

### Tâche 020-1 : Modèle Prisma `UserProfile`
**Statut** : `todo`

- `user_id`, `window` (7d/30d/90d), `computed_at`
- `topic_distribution` (JSON), `top_5_topics` (JSON), `topic_entropy` (Float)
- `political_content_share`, `avg_political_explicitness`
- `avg_polarization_score`, `high_polarization_share`
- `top_narratives` (JSON), `narrative_concentration`
- `top_authors` (JSON), `source_concentration_index`
- `content_diversity_index`
- `consumption_profile` (String — 1 des 10 profils)

### Tâche 020-2 : Pipeline agrégation
**Statut** : `todo`

Créer `src/profiler/` :
- `aggregator.ts` — calcul distributions, entropies, concentrations
- `profiles.ts` — règles d'affectation profil (transparentes, documentées)
- `pipeline.ts` — load enriched posts → aggregate → derive profile → persist

### Tâche 020-3 : Tests profiler
**Statut** : `todo`

- Tests unitaires agrégation (distributions, entropy Shannon)
- Tests affectation profils (cas limites)
- Test intégration sur données réelles

---

## EPIC-030 : Dashboard enrichi
**Statut** : `todo`
**Description** : Rendre le système lisible et exploitable via dashboard web.
**Dépend de** : EPIC-010, EPIC-020

| # | Tâche | Statut | Notes |
|---|-------|--------|-------|
| 030-1 | Vue fiche post enrichie | todo | Scores, narratif, entités, confiance |
| 030-2 | Vue fiche utilisateur | todo | Distribution, indicateurs, profil, fenêtres |
| 030-3 | Vue population / segmentation | todo | Filtres thème/politique/polarisation |
| 030-4 | Exports CSV / JSON | todo | |
| 030-5 | API REST étendue | todo | Endpoints enrichissement + profils |

---

## EPIC-040 : Gouvernance et documentation
**Statut** : `todo`
**Description** : Documenter limites, méthodologie, et sécuriser l'usage.

| # | Tâche | Statut | Notes |
|---|-------|--------|-------|
| 040-1 | Documentation taxonomie + méthodologie | todo | |
| 040-2 | Note de gouvernance (limites, risques) | todo | exposition ≠ conviction |
| 040-3 | Guide lecture métier | todo | |
| 040-4 | Versionnage taxonomies et scores | todo | `scoring_rules_version` |

---

## Dépendances

```mermaid
graph TD
    E000[EPIC-000 Capture] -->|done| E001[EPIC-001 SQLite]
    E001 -->|done| E002[EPIC-002 Analyse basique]
    E002 -->|done| E010[EPIC-010 Enrichissement post]
    E010 --> E011[EPIC-011 Calibration]
    E011 --> E020[EPIC-020 Profil utilisateur]
    E010 --> E030[EPIC-030 Dashboard]
    E020 --> E030
    E010 --> E040[EPIC-040 Gouvernance]
    E020 --> E040
```

## Changelog
- 2026-03-28 : création du système epic/task, migration depuis ROADMAP.md + REPLAN.md
