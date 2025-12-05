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
- **Anacrusis Detection**: Automatic pickup measure detection and preservation
- **Structure Protection**: Maintains square/non-square phrase structures
  
## Live Demo

**Try it now**: https://music-score-simplifier-v85.vercel.app/

## Recent Updates (v8.1)

### Staff Alignment Fix

- Fixed upper/lower staff note alignment issues that caused rhythm distortion
- Proper handling of MusicXML `<backup>` and `<forward>` elements
- Grace notes now correctly handled (zero duration, no time advancement)
- Each voice part duration precisely matches measure duration

### Anacrusis (Pickup Measure) Support

- Automatic detection of incomplete first measures
- Pickup notes preserved in original position
- Structure integrity maintained during simplification

### Square/Non-Square Structure Recognition

- Square structure: Even-numbered measure phrases (2, 4, 8 bars)
- Non-square structure: Odd-numbered or asymmetric phrases
- Phrase boundaries respected during simplification

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

## MusicXML Output Specification

- **Staff 1 (Upper)**: voice=1 (Soprano), voice=2 (Alto)
- **Staff 2 (Lower)**: voice=3 (Tenor), voice=4 (Bass)
- Each voice fills complete measure duration with notes/rests
- Proper `<backup>` elements for multi-voice handling

## Technology Stack

- **Frontend Framework**: Vue.js 3
- **Build Tool**: Vite
- **AI/ML**: TensorFlow.js, Magenta.js (MusicVAE)
- **File Processing**: JSZip for .mxl files
- **Clustering**: ml-kmeans, ml-knn for voice separation

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

Opens at http://localhost:5173

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Vercel will automatically detect Vite and deploy
3. Configuration in `vercel.json` handles SPA routing

### Manual Deployment

1. Build the project: `npm run build`
2. Deploy the `dist` folder to any static hosting service

## Project Structure

```
src/
├── ai/              # AI module (MusicVAE, voice separation, clustering)
├── components/      # Vue components
├── knowledge/       # Knowledge base (clefs, time signatures, durations)
├── modules/
│   ├── parser.js    # MusicXML parsing with backup/forward handling
│   ├── analyzer.js  # Score analysis, anacrusis detection
│   ├── simplifier.js # Simplification orchestration
│   └── exporter.js  # MusicXML export with proper voice alignment
├── rules/
│   ├── singleStaff.js # Single-staff simplification rules
│   └── grandStaff.js  # Grand-staff SATB voice separation
├── utils/           # Memory management, chunk processing
├── App.vue          # Main application component
├── main.js          # Application entry point
└── style.css        # Global styles
```

## Testing

Test files are located in `test-output/`:

- `ALIGNMENT_FIX_REPORT.md` - Detailed fix documentation
- `Mozart_K311_L3.musicxml` - Sample output (Mozart, Level 3)
- `Chopin_Op10_No3_L3.musicxml` - Sample output (Chopin, Level 3)

Run alignment tests:

```bash
node test-alignment-fix.js
```

## Known Limitations

- AI features require browser with WebGL support
- Large files (>5MB) may require chunked processing
- Some complex ornaments may not be fully recognized

## License

MIT License
