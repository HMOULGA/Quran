# Itqan · إتقان

Application libre pour **apprendre, mémoriser et réciter le Coran**, inspirée de Tarteel.
Une seule base de code (React + TypeScript + Vite), empaquetée pour **Android** (Capacitor) et **Windows** (Electron).

## Fonctionnalités

| Mode | Ce qu'il fait |
|---|---|
| **Lire** | Texte uthmani (police Amiri Quran), traduction française, phonétique, 10 récitateurs (EveryAyah), lecture verset par verset avec surlignage, répétition (1, 3, 5, 10 fois ou en boucle), vitesse 0,75× à 1,5×, marque-pages, reprise de la lecture |
| **Mémoriser** | Masquage progressif des mots (1/3, 2/3, tous), révélation au toucher, auto-évaluation (Oublié / Difficile / Bien / Facile) avec **révision espacée** (SM-2) |
| **Réciter** | Récitation au micro avec **suivi mot à mot** et détection des mots oubliés, erronés ou approximatifs ; mode « texte masqué » où les mots apparaissent au fur et à mesure qu'on les récite correctement ; score final et notation automatique dans la révision |
| **Révision** | File quotidienne des versets à revoir, avec indice (premier mot) et contexte (fin du verset précédent) |
| **Progrès** | Série de jours, objectif quotidien, activité des 14 derniers jours, mémorisation par sourate |

La progression est enregistrée sur l'appareil et peut être exportée et importée (JSON) depuis les Réglages.

## Reconnaissance de la récitation

Trois moteurs, choisis automatiquement (modifiable dans les Réglages) :

1. **Android** : reconnaissance vocale native du téléphone (`ar-SA`), résultats en direct, via `@capacitor-community/speech-recognition`.
2. **Navigateur** (Chrome, Edge) : API Web Speech, en direct.
3. **Whisper Coran** (Windows et tous les autres cas) : modèle `tarteel-ai/whisper-base-ar-quran` (export ONNX `iqbalaesthetic/Basira`) exécuté **localement** avec transformers.js (WebGPU si disponible, sinon WebAssembly). Il est téléchargé une seule fois (environ 100 Mo), puis l'audio ne quitte jamais l'appareil. Il transcrit par segments, à chaque pause.

L'alignement entre ce qui est entendu et le texte attendu (`src/lib/align.ts`) est un algorithme de programmation dynamique. Il tolère :
- les différences de graphie entre l'écriture uthmani et l'écriture courante (alif suscrit, alif wasla, hamza, ta marbuta…) ;
- les mots écrits en un seul bloc mais prononcés en deux (يَٰٓأَيُّهَا → يا أيها) ;
- l'isti'adha ou la basmala prononcées avant de commencer.

Les tests unitaires sont dans `src/lib/align.test.ts`.

## Développement

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # tests de l'alignement
npm run build        # génère public/data puis dist/
```

### Windows (Electron)

```bash
npm run electron:dev   # fenêtre Electron branchée sur le serveur Vite
npm run dist:win       # installateur + version portable dans release/
```

### Android (Capacitor)

Le projet Android est déjà généré dans `android/` : permissions micro ajoutées, icônes en place.

```bash
npm run android:sync   # build web + copie dans le projet Android
npm run android:open   # ouvre Android Studio (Run ▶ pour installer sur le téléphone)
```

### Builds automatiques (GitHub Actions)

`.github/workflows/build.yml` lance les tests, puis produit `Itqan-android.apk` (APK de débogage, installable directement) et les `.exe` Windows. Ces fichiers sont disponibles dans l'onglet **Actions**, rubrique *Artifacts*. Pousser un tag `v0.1.0` crée une *Release* GitHub avec les deux fichiers.

## Structure

```
scripts/build-data.mjs     données du Coran → public/data (114 sourates, 6236 versets, juz, pages, sajdas)
src/lib/align.ts           alignement récitation ↔ texte
src/lib/arabic.ts          normalisation de l'arabe
src/lib/srs.ts             révision espacée
src/lib/audio.ts           lecteur verset par verset (répétitions, boucle, basmala)
src/lib/speech/            moteurs de reconnaissance (Android, Web Speech, Whisper en Web Worker)
src/lib/store.ts           état persistant (réglages, progrès, révision)
src/screens/               Accueil, Sourates, Lecteur, Révision, Progrès, Réglages
electron/main.cjs          application Windows (protocole app:// sécurisé, accès micro)
android/                   projet Android (Capacitor)
```

## Sources et licences

- Texte uthmani et traduction française : [QuranEnc](https://quranenc.com), via le paquet `quran-json` (CC BY-SA 4.0)
- Translittération : [Tanzil.net](https://tanzil.net)
- Juz, pages, sajdas : `quran-meta` (Mushaf de Médine, riwaya Hafs)
- Audio : [EveryAyah.com](https://everyayah.com)
- Police : Amiri Quran (SIL OFL)
- Modèle : `tarteel-ai/whisper-base-ar-quran` (Apache 2.0)

Avant une publication sur le Play Store, vérifiez les conditions d'utilisation de chaque source et faites relire le texte affiché par une personne qualifiée.
