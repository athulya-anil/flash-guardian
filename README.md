# Flash Guardian

A Chrome browser extension that protects people with photosensitive epilepsy by detecting and warning about flashing content in online videos.

## What It Does

Flash Guardian monitors videos on YouTube, TikTok, Twitter/X, Instagram, and Twitch. When it detects rapid flashing (3 or more flashes per second), it immediately pauses the video and shows a warning overlay, helping protect photosensitive users from potentially harmful content.

## Features

- **Real-time Detection**: Analyzes video frames while you watch
- **WCAG 2.1 Compliant**: Follows web accessibility standards for flash detection
- **Auto-Pause**: Stops videos instantly when dangerous flashing is detected
- **Privacy-First**: All processing happens locally in your browser
- **Smart Filtering**: Avoids false alarms with warmup periods and brightness thresholds
- **Statistics**: Track videos monitored, warnings issued, and flashes detected

## How It Works

The extension monitors videos using these steps:

1. **Captures frames** from playing videos using the Canvas API
2. **Calculates brightness** of each frame using WCAG 2.1 luminance formulas
3. **Detects flashes** by tracking significant brightness changes between frames
4. **Counts frequency** - if 3+ flashes occur within 1 second, it triggers a warning
5. **Pauses video** and displays a warning overlay with statistics

### Smart Detection

- Skips the first 10 frames to avoid false positives during video loading
- Ignores very dark frames (below 5% brightness) like loading screens
- Detects saturated red flashes, which are particularly dangerous
- Analyzes every 3rd frame and samples pixels for better performance

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the `flash-guardian` folder
5. The extension icon will appear in your toolbar
6. Refresh any open video pages to activate protection

## 🚀 Usage

### Normal Browsing

1. **Browse normally** - Flash Guardian runs automatically on supported sites
2. **Watch videos** - Detection starts when any video begins playing
3. **Get warnings** - If flashing is detected (≥3 flashes/second):
   - Video pauses immediately
   - Warning overlay appears showing:
     - Flash frequency (flashes per second)
     - Total flashes detected
     - Timestamp where flashing occurred
   - Choose to "Continue Anyway" or "Close Video"

### Settings & Statistics

Click the Flash Guardian icon in your toolbar to access:
- **Enable Protection**: Turn detection on/off
- **Auto-Pause Videos**: Automatically pause when flashing is detected
- **Sensitivity**: Medium (WCAG 2.1 standard - ≥3 flashes/second)
- **Session Statistics**:
  - Videos Monitored
  - Warnings Issued
  - Flashes Detected
- **Reset Statistics**: Clear session data for testing

### Console Logging

Open DevTools (F12) → Console to see detection activity:
```
[Flash Guardian] Content script loaded
[Flash Guardian] Found 1 video(s) on page
[Flash Guardian] Initialized detector for video
[Flash Guardian] Started monitoring video
[Flash Guardian] Detection state reset
```

Built for HackUmass 2025