# Norwegian 4x4 Timer

A mobile-friendly web app for the Norwegian 4x4 interval training protocol.

## What is Norwegian 4x4?

The Norwegian 4x4 is a high-intensity interval training (HIIT) protocol developed by researchers at the Norwegian University of Science and Technology. It consists of 4 intervals of high-intensity exercise followed by recovery periods, bookended by warmup and cooldown phases.

## Features

- **Customizable durations** - Adjust warmup, high intensity, recovery, cooldown, and number of intervals
- **Audio cues**:
  - Accelerating ticks during the last 10 seconds of each phase
  - Distinct tones for phase changes (ascending for run, descending for walk)
  - Celebration sound on workout completion
- **Mobile optimized** - Responsive design, native select pickers on iOS/Android
- **Screen wake lock** - Keeps your screen on during workouts
- **Settings persistence** - Your preferences are saved to localStorage

## Default Protocol

- 5 min warmup
- 4 x (4 min high intensity + 3 min recovery)
- 5 min cooldown
- **Total: 38 minutes**

## Usage

Open `index.html` in any modern browser. No server required - it's a pure frontend application.

## Browser Support

Works in all modern browsers with Web Audio API support (Chrome, Firefox, Safari, Edge).

## License

MIT
