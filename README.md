# ECHA — Extracteur de Comportement Humain sur Applications

Outil d'analyse comportementale qui capture et structure les interactions utilisateur sur applications mobiles (Instagram principalement) via l'arbre d'accessibilité Android.

## Architecture

```
echa/
├── src/                    # Core — scripts TypeScript d'extraction
│   ├── index.ts            # Point d'entrée principal
│   ├── adb.ts              # Wrapper ADB (devices, screenshots, UI dump)
│   ├── adb-path.ts         # Résolution automatique du chemin ADB
│   ├── capture.ts          # Capture temps réel avec dwell time tracking
│   ├── auto-capture.ts     # Capture automatisée en continu
│   ├── listen.ts           # Écoute logcat en temps réel
│   ├── logcat-listener.ts  # Listener logcat structuré
│   ├── parser.ts           # Parsing XML UIAutomator → données structurées
│   ├── analyzer.ts         # Analyse de session (catégorisation, rapport)
│   └── deep-extract.ts     # Extraction profonde des données
├── echa-app/               # Application Capacitor (Android)
│   └── android/            # Projet Android natif (APK)
├── echa-android/           # Application Android native
│   └── app/                # Module principal (APK debug)
├── scripts/
│   └── scan-devices.ts     # Gestion des appareils (scan, WiFi ADB, install APK)
├── data/                   # Données de sessions capturées (JSON)
└── .env.devices            # IPs des appareils connectés (auto-généré)
```

## Fonctionnement

1. **Connexion** — Détecte les appareils Android via ADB (USB ou WiFi)
2. **Capture** — Lit l'arbre d'accessibilité UIAutomator en temps réel pendant que l'utilisateur navigue
3. **Parsing** — Extrait les données structurées (posts, profils, interactions) depuis le XML brut
4. **Analyse** — Calcule le dwell time, catégorise le contenu, produit un rapport de session

## Prérequis

- Node.js LTS
- ADB (Android Debug Bridge) dans le PATH
- Appareil Android avec débogage USB activé

## Installation

```bash
npm install
```

## Commandes

### Gestion des appareils

```bash
npm run devices          # Scanner les appareils connectés → .env.devices
npm run devices:wifi     # Activer ADB WiFi sur tous les appareils
npm run devices:list     # Afficher les appareils enregistrés
npm run apk:install -- <chemin.apk>   # Installer un APK sur tous les appareils
```

### Capture et analyse

```bash
npx tsx src/capture.ts [durée_secondes]   # Capture en temps réel (défaut: 30s)
npx tsx src/auto-capture.ts               # Capture automatique en continu
npx tsx src/analyzer.ts [session.json]    # Analyser une session capturée
npx tsx src/index.ts                      # Extraction complète
```

## Stack

- **TypeScript** strict
- **ADB** pour la communication Android
- **UIAutomator** pour l'arbre d'accessibilité
- **Capacitor** pour l'app embarquée

## Données extraites

- Posts visibles (auteur, caption, likes, description image)
- Temps de visionnage par post (dwell time)
- Navigation et scrolls
- Informations de profil
- Catégorisation automatique du contenu
