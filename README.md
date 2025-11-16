# Tonnetz

An interactive infinite hexagonal canvas with musical tones. This is based on "Tonnetz" diagram.

## Features

- **Infinite Hexagonal Grid**: Navigate through an endless flat-top hexagonal tessellation
- **Musical Interaction**: Touch or click tiles to generate harmonious tones
  - Each hexagon has a unique frequency based on its axial coordinates (q, r)
  - Slide your finger across tiles to create melodies
  - Sound plays continuously while holding a tile
- **Visual Feedback**: 
  - Active tiles light up with color
  - Each tile displays its mathematical ratio
  - Real-time coordinate display
- **Touch Controls**:
  - **Joystick**: Bottom-left virtual joystick for smooth camera panning
  - **Zoom Buttons**: +/− buttons for precise zoom control
  - **Pinch Zoom**: Two-finger pinch gesture support (when pan/zoom mode enabled)
- **Responsive Design**: Works on desktop and mobile devices

## How to Use

### Desktop
- **Click** a hexagon to play its tone
- **Mouse Wheel** to zoom in/out (when pan/zoom enabled)
- **Click + Drag** to pan the canvas (when pan/zoom enabled)
- **Zoom Buttons** (+/−) for zooming

### Mobile
- **Tap** a hexagon to play its tone
- **Slide** your finger across hexagons to create a melody
- **Joystick** (bottom-left) to pan the camera
- **Zoom Buttons** (+/−) to zoom in/out
- **Pinch** with two fingers to zoom (when pan/zoom enabled)

## Getting Started

Simply open `index.html` in a modern web browser. No build process or dependencies required!

```bash
# Option 1: Open directly
open index.html

# Option 2: Use a local server (recommended)
python -m http.server 8000
# Then navigate to http://localhost:8000
```

## Technical Details

### Audio Synthesis
Each hexagon generates a tone based on its axial coordinates:
- Base frequency: Middle C (261.625565 Hz)
- Q-axis multiplier: 1.5^q
- R-axis multiplier: 1.25^r
- Final frequency: `baseFreq × (1.5^q) × (1.25^r)`

### Mathematical Display
Each tile shows:
- Simplified fraction representation
- Decimal approximation
- Based on the formula: `(3^q × 5^r) / (2^q × 4^r)` for positive coordinates

### Technologies
- Vanilla JavaScript (ES6+)
- HTML5 Canvas API
- Web Audio API
- Touch Events API
- No external dependencies

## Browser Compatibility

Works best on modern browsers with Web Audio API support:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari (iOS 13+)
- Chrome for Android

## Project Structure

```
justhex/
├── index.html    # Main HTML file with styling
├── app.js        # Core application logic
└── README.md     # This file
```

## Future Enhancements

- [ ] Different sound wave types (sine, square, triangle, sawtooth)
- [ ] Scale/mode selection
- [ ] Recording and playback
- [ ] Color themes
- [ ] Persistence of camera position

## License

MIT License - Feel free to use and modify as you wish!

---

**Created with ❤️ for musical exploration**
