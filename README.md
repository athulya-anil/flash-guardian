# Halo

A dual-purpose Chrome browser extension for accessibility built for HackUmass 2025.

**Halo** combines two powerful accessibility features:
1. **Flash Protection**: Protects people with photosensitive epilepsy by detecting flashing content in videos
2. **Text Summarizer**: AI-powered article summarization for people with ADHD/ADD with Audiobook support

## Project Overview

Halo is a Manifest V3 Chrome extension that serves two different user groups with distinct accessibility needs:

- **For photosensitive users**: Real-time flash detection that monitors video content and automatically pauses when dangerous flashing patterns are detected (≥3 flashes per second), following WCAG 2.1 standards
- **For users with ADHD/ADD**: AI-powered text summarization using Google Gemini to condense long articles into digestible summaries

All video processing happens locally in your browser for complete privacy. The extension features a clean popup interface that allows users to toggle between the two modes and customize their experience.

## What It Does

### Flash Protection
Halo monitors videos on YouTube, TikTok, Twitter/X, Instagram, and Twitch. When it detects rapid flashing (3 or more flashes per second), it immediately pauses the video and shows a warning overlay, helping protect photosensitive users from potentially harmful content.

### Text Summarizer
Condenses long articles and blog posts into easy-to-read summaries using Google's Gemini AI. Helps users with ADHD/ADD quickly grasp key information without reading lengthy content.

### Multilingual tts 
Uses ElevenLabs Multilingual Model for text to speech for narration of summaries

### White Noise
Can play multiple soothing white noise to boost concentration

## Features

### Flash Protection
- **Real-time Detection**: Analyzes video frames while you watch
- **WCAG 2.1 Compliant**: Follows web accessibility standards for flash detection
- **Auto-Pause**: Stops videos instantly when dangerous flashing is detected
- **Privacy-First**: All processing happens locally in your browser
- **Smart Filtering**: Avoids false alarms with warmup periods and brightness thresholds
- **Statistics**: Track videos monitored, warnings issued, and flashes detected

### Text Summarizer
- **AI-Powered**: Uses Google Gemini API for intelligent summarization
- **Flexible Length**: Choose brief (2-3 sentences), moderate (1 paragraph), or detailed (bullet points)
- **Smart Extraction**: Automatically finds and extracts main article content
- **Copy to Clipboard**: Easy sharing of summaries
- **Download Summary** Download summary as a txt file
- **TTS Support** Narrate summaries in 10 different voices/tones
- **Works Everywhere**: Summarize articles on any website

## Technical Architecture

- **Manifest Version**: 3
- **Content Scripts**:
  - `detector.js` - Flash detection logic for video platforms (YouTube, TikTok, Twitter/X, Instagram, Twitch)
  - `summarizer.js` - Text summarization functionality (works on all websites)
- **Background Worker**: `background.js` - Manages extension lifecycle and communication
- **Popup Interface**: `popup.html` + `popup.js` - User settings, statistics, and controls
- **AI Integration**: Supports Google Gemini for intelligent text summarization and ElevenLabs API for tts

## How It Works

### Flash Protection

The extension monitors videos using these steps:

1. **Captures frames** from playing videos
2. **Calculates brightness** of each frame using WCAG 2.1 luminance formulas
3. **Detects flashes** by tracking significant brightness changes between frames
4. **Counts frequency** - if 3+ flashes occur within 1 second, it triggers a warning
5. **Pauses video** and displays a warning overlay with statistics

**Smart Detection:**
- Skips the first 10 frames to avoid false positives during video loading
- Ignores very dark frames (below 5% brightness) like loading screens
- Detects saturated red flashes, which are particularly dangerous
- Analyzes every 3rd frame and samples pixels for better performance

### Text Summarizer

1. **Extract Content**: Uses multiple strategies to find the main article text
2. **Call Gemini API**: Sends text to Google's Gemini with optimized prompts
3. **Generate Summary**: AI creates concise, ADHD-friendly summaries
4. **Display Results**: Shows summary in popup with copy option

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the `Halo` folder
5. The extension icon will appear in your toolbar
6. Refresh any open video pages to activate protection

## Usage

### Flash Protection (Default View)

1. **Browse normally** - Halo runs automatically on supported sites
2. **Watch videos** - Detection starts when any video begins playing
3. **Get warnings** - If flashing is detected (≥3 flashes/second):
   - Video pauses immediately
   - Warning overlay appears showing:
     - Flash frequency (flashes per second)
     - Total flashes detected
     - Timestamp where flashing occurred
   - Choose to "Continue Anyway" or "Close Video"

**Settings & Statistics:**
- **Enable Protection**: Turn detection on/off
- **Session Statistics**: Videos monitored, warnings issued, flashes detected
- **Reset Statistics**: Clear session data

### Text Summarizer

**First Time Setup:**
1. Click the Halo icon in your toolbar
2. Click the ⚙️ settings icon at the top
3. Choose your AI provider:
   - **Google Gemini** (Recommended): Fast, high-quality summaries
     - Get free API key: [Google AI Studio](https://aistudio.google.com)
4. Paste your API key and click "Save"

**Using the Summarizer:**
1. Navigate to any article or blog post
2. Select and copy the text you want to summarize (Cmd/Ctrl+A then Cmd/Ctrl+C)
3. Click the Halo icon
4. Make sure you're in the Text Summarizer view (📝 icon)
5. Paste the text into the text box (Cmd/Ctrl+V)
6. Choose your summary length:
   - **Brief**: 2-3 sentences
   - **Moderate**: 1 paragraph (default)
   - **Detailed**: Bullet point list
7. Click "Generate Summary"
8. Wait for AI to create your summary
9. Use "Copy" button to copy summary to clipboard

**Using the Text to Speech:**
1. Add your ElevenLabs API Key
2. Select the voice
3. Click on listen

**Switching Between Views:**
- Click the 🛡️ or 📝 icon in the top-right of the popup to toggle between Flash Protection and Text Summarizer


## Team  

Built by:
- [**Balachandra DS**](https://github.com/Baluds)
- [**Athulya Anil**](https://github.com/atl-007)
- [**Allen Joe Winny**](https://github.com/atl-007)

Created for **HackUMass XIII (2025)**.  

*Inspired by a simple belief — the internet should be safe and inclusive for everyone.*

## License  

[MIT License](LICENSE)
