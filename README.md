# Music Score Simplifier

A pure frontend web application that provides graded simplification of musical scores for instrument beginners. The application processes MusicXML files (.mxl/.musicxml) and applies rule-based and AI-assisted simplification to produce easier-to-play versions while preserving musical integrity.

## Features

- **File Upload**: Support for .mxl and .musicxml file formats
- **Score Type Selection**: Grand Staff (piano) or Single-Staff (violin, flute, etc.)
- **5 Simplification Levels**: From skeleton (Level 1) to near-original (Level 5)
- **AI-Assisted Analysis**: Uses TensorFlow.js and Magenta.js for melody/bass identification
- **Rule-Based Simplification**: Deterministic rules for consistent results
- **Voice Customization**: Customize soprano and bass levels for grand staff
- **Export**: Download simplified scores in .mxl or .musicxml format

## Simplification Levels

### Single-Staff (Monophonic Instruments)
- **Level 1 - Skeleton**: First note per measure only
- **Level 2 - Strong Beats**: Notes on strong beat positions
- **Level 3 - Beat Heads**: First note of each beat
- **Level 4 - Rhythmic Core**: Quarter/eighth notes preserved, shorter notes simplified
- **Level 5 - Near Original**: Ornaments removed only

### Grand Staff (Polyphonic Instruments)
- **Level 1 - Two-Voice**: Soprano melody + Bass skeleton
- **Level 2 - Three-Voice (RH)**: Soprano + Alto + Bass
- **Level 3 - Three-Voice (LH)**: Soprano + Tenor + Bass
- **Level 4 - Four-Voice**: Full SATB harmony on strong beats
- **Level 5 - Near Original**: Four voices with minimal simplification

## Technology Stack

- **Frontend Framework**: Vue.js 3
- **Build Tool**: Vite
- **AI/ML**: TensorFlow.js, Magenta.js
- **File Processing**: JSZip for .mxl files

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Deployment

### GitHub Pages

1. Build the project: `npm run build`
2. Deploy the `dist` folder to GitHub Pages

### Vercel

1. Connect your repository to Vercel
2. Vercel will automatically detect Vite and deploy

## Project Structure

```
src/
├── ai/              # AI module (MusicVAE, MelodyRNN, clustering)
├── components/      # Vue components
├── knowledge/       # Knowledge base (clefs, time signatures, etc.)
├── modules/         # Core modules (parser, analyzer, simplifier, exporter)
├── rules/           # Rule engine (single-staff, grand-staff rules)
├── types/           # Type definitions
├── App.vue          # Main application component
├── main.js          # Application entry point
└── style.css        # Global styles
```

## License

MIT License
