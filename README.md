# Video Clip Manager

A powerful web-based video editing tool for creating, combining, and managing multiple clip variations from a single source video. Built with Next.js 15, TypeScript, and Tailwind CSS.

## Features

### Core Editing
- **Video Import**: Upload any video file and start editing immediately
- **Trim & Clip**: Set in/out points to create precise clips
- **Timeline Scrubbing**: Click anywhere on the timeline to jump to that point
- **Draggable Markers**: Adjust trim points by dragging yellow markers on the timeline

### Clip Management
- **Multiple Variations**: Create unlimited clip variations from one source video
- **Combine Clips**: Select multiple clips and merge them into a single sequence
- **Duplicate**: Quickly create copies of clips for iteration
- **Preview Mode**: Isolated preview showing only the selected clip (not the full video)

### Text Overlays
- **Add Text**: Overlay text on any clip with full customization
- **Position Control**: Top, center, or bottom positioning
- **Styling Options**:
  - Font size (20-120px)
  - Text color
  - Background color with opacity control
  - Font weight (normal to black)
- **Multi-line Support**: Add multiple lines of text with line breaks
- **Real-time Canvas Rendering**: Text overlays render in real-time during preview

### Preview Mode
- **Isolated Playback**: When previewing, see only that specific clip
- **Timeline Relative to Clip**: Timeline shows clip duration, not full video
- **Automatic Looping**: Clips loop seamlessly for easy review
- **Combined Clip Playback**: Multi-segment clips play all sections in sequence
- **Easy Exit**: Return to edit mode with one click

## Project Structure

```
video-clip-tool/
├── prototype/                 # Original HTML prototype (reference only)
│   └── video-clip-manager.html
├── app/                       # Next.js App Router
│   ├── page.tsx              # Main entry point
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── components/
│   └── VideoEditor/          # Main editor components
│       ├── VideoEditor.tsx   # Main container with state management
│       ├── VideoImport.tsx   # File import UI
│       ├── VideoPlayer.tsx   # Video player with canvas overlay
│       ├── Timeline.tsx      # Timeline with progress and markers
│       ├── Controls.tsx      # Playback and editing controls
│       ├── ClipList.tsx      # Grid of all clip variations
│       └── TextOverlayModal.tsx  # Text editing modal
├── types/
│   └── index.ts              # TypeScript type definitions
└── lib/
    └── utils.ts              # Utility functions (formatTime, hexToRgb, etc.)
```

## Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or yarn

### Installation

1. Clone the repository and navigate to the project:
```bash
cd video-clip-tool
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Usage

1. **Import a Video**: Click the import area and select a video file
2. **Create Clips**:
   - Play through the video or scrub the timeline
   - Click "Set In Point" at the start of your desired clip
   - Click "Set Out Point" at the end
   - Click "Create Clip" to save
3. **Add Text**: Click "Edit Text" on any clip to add overlays
4. **Preview**: Click "Preview" to see your clip in isolation
5. **Combine**: Select multiple clips (checkboxes) and click "Combine Selected"
6. **Iterate**: Duplicate any clip to create variations

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React hooks (useState, useRef, useEffect)
- **Video Processing**: HTML5 Video API + Canvas API for text overlays
- **Build Tool**: Turbopack

## Future Enhancements

### Ready to Add (staying in single HTML/client-side)
- Transitions between clips (fade in/out, crossfade)
- Audio level control
- Speed adjustment (slow-mo, time-lapse)
- Filters/color grading
- Keyboard shortcuts
- Undo/redo history
- Local export with FFmpeg.js

### Requires Backend (Next.js API + Database)
- User authentication
- Cloud storage for projects
- Collaborative editing
- Shareable clip links
- Auto-captions with Whisper API
- Organization/workspace management

## Development

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Component Architecture

The app uses a unidirectional data flow:
1. **VideoEditor** (parent) manages all state
2. Child components receive props and callbacks
3. State updates flow down, events flow up
4. Video and canvas refs are passed to components that need them

### Key Patterns

- **Refs for DOM access**: Video element and canvas are accessed via refs
- **Controlled components**: All form inputs are controlled
- **Event delegation**: Click handlers on parent elements where appropriate
- **RAF for canvas**: `requestAnimationFrame` for smooth text overlay rendering

## Contributing

This is a private tool for internal use. If you're on the team and want to add features, create a branch and submit a PR.

## License

Private - Internal use only

---

Built with ❤️ using Next.js and TypeScript
