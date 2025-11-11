/**
 * Halo - Photosensitive Content Detector
 * Based on WCAG 2.1 Guidelines for Flash and Red Flash Thresholds
 *
 * Detection criteria:
 * - General Flash: 3+ flashes per second with luminance change > 10%
 * - Red Flash: 3+ flashes per second with saturated red transitions
 */

// Check if extension context is valid before running
// Only throw if chrome is completely undefined, otherwise continue
if (typeof chrome === 'undefined') {
  throw new Error('Chrome API not available');
}

class FlashDetector {
  constructor(video, videoId, warnedVideosSet, getProtectionEnabled) {
    this.video = video;
    this.videoId = videoId;
    this.warnedVideosSet = warnedVideosSet; // Reference to global warned videos set
    this.getProtectionEnabled = getProtectionEnabled; // Function to check if protection is enabled
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    // Detection parameters (WCAG 2.1 compliant)
    this.LUMINANCE_THRESHOLD = 0.2; // 10% relative luminance change
    this.RED_THRESHOLD = 0.6; // Saturated red detection
    this.FLASH_FREQUENCY = 3; // 3 flashes per second
    this.DETECTION_WINDOW = 1000; // 1 second in milliseconds
    this.MIN_BRIGHTNESS = 0.05; // Ignore very dark frames (< 5% brightness)
    this.WARMUP_FRAMES = 10; // Skip first 10 frames to avoid false positives during video initialization

    // State tracking
    this.prevLuminance = null;
    this.prevRedSaturation = null;
    this.flashTimestamps = [];
    this.redFlashTimestamps = [];
    this.isAnalyzing = false;
    this.warningShown = false;
    this.frameCount = 0;
    this.skipFrames = 2; // Analyze every 3rd frame for performance
    this.analyzedFrameCount = 0; // Count of actual analyzed frames (after skipping)

    // Statistics
    this.totalFlashes = 0;
    this.maxFlashesPerSecond = 0;

    // Error tracking
    this.corsErrorLogged = false;
  }

  /**
   * Calculate relative luminance of a frame
   * Uses sRGB color space formula from WCAG
   */
  calculateLuminance(imageData) {
    const data = imageData.data;
    let totalLuminance = 0;
    const pixelCount = data.length / 4;

    // Sample every 4th pixel for performance (still statistically significant)
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;

      // Convert to linear RGB
      const rLinear = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
      const gLinear = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
      const bLinear = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

      // Calculate relative luminance
      const luminance = 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
      totalLuminance += luminance;
    }

    return totalLuminance / (pixelCount / 4);
  }

  /**
   * Detect saturated red content in frame
   * Red flash is particularly dangerous for photosensitive users
   */
  calculateRedSaturation(imageData) {
    const data = imageData.data;
    let redSaturation = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Detect saturated red (high R, low G and B)
      if (r > 200 && g < 100 && b < 100) {
        redSaturation++;
      }
    }

    return redSaturation / (pixelCount / 4);
  }

  /**
   * Analyze a single frame for flash detection
   */
  analyzeFrame() {
    // Stop analyzing if protection is disabled
    if (!this.getProtectionEnabled()) {
      this.stop();
      return;
    }

    if (!this.video || this.video.paused || this.video.ended) {
      return;
    }

    // Skip frames for performance
    this.frameCount++;
    if (this.frameCount % this.skipFrames !== 0) {
      requestAnimationFrame(() => this.analyzeFrame());
      return;
    }

    try {
      // Capture current video frame
      this.canvas.width = Math.min(this.video.videoWidth, 640);
      this.canvas.height = Math.min(this.video.videoHeight, 360);

      // Check if canvas is tainted (CORS issue)
      try {
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const currentTime = Date.now();

        // Calculate luminance and red saturation
        const currentLuminance = this.calculateLuminance(imageData);
        const currentRedSaturation = this.calculateRedSaturation(imageData);

        // Increment analyzed frame counter
        this.analyzedFrameCount++;

        // Skip warmup frames to avoid false positives during video initialization
        if (this.analyzedFrameCount <= this.WARMUP_FRAMES) {
          this.prevLuminance = currentLuminance;
          this.prevRedSaturation = currentRedSaturation;
          requestAnimationFrame(() => this.analyzeFrame());
          return;
        }

        // Ignore very dark frames (loading screens, fade to black, etc.)
        if (currentLuminance < this.MIN_BRIGHTNESS || (this.prevLuminance !== null && this.prevLuminance < this.MIN_BRIGHTNESS)) {
          this.prevLuminance = currentLuminance;
          this.prevRedSaturation = currentRedSaturation;
          requestAnimationFrame(() => this.analyzeFrame());
          return;
        }

        if (this.prevLuminance !== null) {
          // Check for general flash (luminance change)
          const luminanceChange = Math.abs(currentLuminance - this.prevLuminance);
          const relativeLuminanceChange = luminanceChange / Math.max(this.prevLuminance, 0.01);

          // Additional check: both current and previous luminance must be significant for a valid flash
          const bothFramesBright = currentLuminance > this.MIN_BRIGHTNESS && this.prevLuminance > this.MIN_BRIGHTNESS;
          const absoluteChangeSignificant = luminanceChange > 0.1; // At least 10% absolute change

          if (relativeLuminanceChange > this.LUMINANCE_THRESHOLD && bothFramesBright && absoluteChangeSignificant) {
            this.flashTimestamps.push(currentTime);
            this.totalFlashes++;
          }

          // Check for red flash
          const redChange = Math.abs(currentRedSaturation - this.prevRedSaturation);
          if (redChange > this.RED_THRESHOLD && bothFramesBright) {
            this.redFlashTimestamps.push(currentTime);
          }

          // Remove old timestamps outside detection window
          this.flashTimestamps = this.flashTimestamps.filter(
            t => currentTime - t <= this.DETECTION_WINDOW
          );
          this.redFlashTimestamps = this.redFlashTimestamps.filter(
            t => currentTime - t <= this.DETECTION_WINDOW
          );

          // Update max flashes per second
          this.maxFlashesPerSecond = Math.max(
            this.maxFlashesPerSecond,
            this.flashTimestamps.length
          );

          // Trigger warning if threshold exceeded
          if (this.flashTimestamps.length >= this.FLASH_FREQUENCY) {
            this.triggerWarning('general', this.flashTimestamps.length);
          } else if (this.redFlashTimestamps.length >= this.FLASH_FREQUENCY) {
            this.triggerWarning('red', this.redFlashTimestamps.length);
          }

          // Log flash activity for debugging
          if (this.flashTimestamps.length > 0) {
          }
        }

        this.prevLuminance = currentLuminance;
        this.prevRedSaturation = currentRedSaturation;

      } catch (corsError) {
        // CORS/Security error - video cannot be analyzed (different origin)
        // This is expected for some videos, silently skip this frame
        // Suppressed logging to avoid console spam
        this.corsErrorLogged = true;
      }

    } catch (error) {
      // Other unexpected errors
    }

    // Continue analyzing
    if (this.isAnalyzing) {
      requestAnimationFrame(() => this.analyzeFrame());
    }
  }

  /**
   * Trigger warning overlay
   */
  triggerWarning(type, flashCount) {
    // Report warning to popup - wrap in try-catch for extension context errors
    if (this.warningShown) return;

    this.warningShown = true;

    // Pause video immediately
    this.video.pause();

    speakWarning(flashCount);

    
    try {
      chrome.runtime.sendMessage({
        action: 'updateStats',
        stat: 'warningIssued'
      }).then(response => {
      }).catch(error => {
      });
    } catch (error) {
    }

    // Report flashes detected - wrap in try-catch for extension context errors
    try {
      chrome.runtime.sendMessage({
        action: 'updateStats',
        stat: 'flashDetected',
        count: this.totalFlashes
      }).then(response => {
      }).catch(error => {
      });
    } catch (error) {
    }

    // Dispatch custom event for warning UI
    const warningEvent = new CustomEvent('flashDetected', {
      detail: {
        type: type,
        flashCount: flashCount,
        maxFlashesPerSecond: this.maxFlashesPerSecond,
        totalFlashes: this.totalFlashes,
        timestamp: this.video.currentTime
      }
    });

    // Show the warning overlay
    this.showWarningOverlay(type, flashCount);
  }

  /**
   * Show warning overlay without incrementing stats
   * Used when video was already warned but user seeks back
   */
  showWarningOverlay(type, flashCount) {
    const warningEvent = new CustomEvent('flashDetected', {
      detail: {
        type: type,
        flashCount: flashCount,
        maxFlashesPerSecond: this.maxFlashesPerSecond,
        totalFlashes: this.totalFlashes,
        timestamp: this.video.currentTime
      }
    });

    document.dispatchEvent(warningEvent);
  }

  /**
   * Reset detection state (used when seeking or resuming after warning)
   */
  resetDetectionState() {
    this.prevLuminance = null;
    this.prevRedSaturation = null;
    this.flashTimestamps = [];
    this.redFlashTimestamps = [];
    this.analyzedFrameCount = 0;
  }

  /**
   * Start detection
   */
  start() {
    if (this.isAnalyzing) return;

    this.isAnalyzing = true;
    this.warningShown = false;
    this.totalFlashes = 0;
    this.maxFlashesPerSecond = 0;
    this.resetDetectionState();

    this.analyzeFrame();
  }

  /**
   * Stop detection
   */
  stop() {
    this.isAnalyzing = false;
  }

  /**
   * Reset warning state (allow video to continue)
   */
  resetWarning() {
    this.warningShown = false;
    this.resetDetectionState();
  }
}

function speakWarning(flashCount) {

  chrome.storage.sync.get(['ttsEnabled'], (data) => {

    if (data.ttsEnabled === false) {
      return;
    }

  // Check if speech synthesis is supported
  if (!window.speechSynthesis) {
    return;
  }

  // Create utterance with warning message
  const message = `Warning! Detected ${flashCount} flashes per second. This content may be unsafe for photosensitive viewers.`;
  const utterance = new SpeechSynthesisUtterance(message);
  
  // Configure voice settings
  utterance.rate = 1.0;  // Normal speed
  utterance.pitch = 1.0; // Normal pitch
  utterance.volume = 0.8; // Slightly quieter than max
  
  // Try to use a neutral female voice if available
  const voices = speechSynthesis.getVoices();
  const preferredVoice = voices.find(voice => 
    voice.name.includes('Female') || 
    voice.name.includes('Samantha') || 
    voice.name.includes('Google')
  );
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  // Speak the warning
  speechSynthesis.speak(utterance);
  });
}

// Main execution
(function() {

  const detectors = new Map();
  const visitedVideos = new Set(); // Track unique videos to prevent duplicate counting
  const warnedVideos = new Set(); // Track videos that have already shown warnings (prevents inflation from seeking)
  let protectionEnabled = true; // Default to enabled
  let storageLoaded = false; // Track if storage has been loaded

  // Load both enabled state and visited videos before initializing
  Promise.all([
    new Promise(resolve => {
      chrome.storage.sync.get(['enabled'], (data) => {
        protectionEnabled = data.enabled !== false;
        resolve();
      });
    }).catch(error => {
    console.error('[Flash Guardian] Error loading settings:', error);
    protectionEnabled = true; // Default to enabled on error
    resolve();
  }),
    new Promise(resolve => {
      chrome.storage.local.get(['visitedVideos'], (data) => {
        if (data.visitedVideos && Array.isArray(data.visitedVideos)) {
          data.visitedVideos.forEach(videoId => visitedVideos.add(videoId));
        }
        resolve();
      });
    })
  ]).then(() => {
    storageLoaded = true;
    // Now find and monitor videos
    findAndMonitorVideos();
  });

  /**
   * Get video identifier from URL (for YouTube)
   */
  function getVideoId() {
    // Check if we're on YouTube
    if (window.location.hostname.includes('youtube.com')) {
      // Check for Shorts first
      if (window.location.pathname.includes('/shorts/')) {
        const shortsMatch = window.location.pathname.match(/\/shorts\/([^/?]+)/);
        return shortsMatch?.[1] || null;
      }
      
      // Regular YouTube videos
      const urlParams = new URLSearchParams(window.location.search);
      const videoId = urlParams.get('v');
      
      // Return video ID for both watch pages and embedded players
      if (videoId) {
        return videoId;
      }
    }
    
    // For non-YouTube videos, use the src as an ID
    return 'video-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Initialize detector for a video element
   */
  function initializeDetector(video) {
    // Don't initialize if protection is disabled
    if (!protectionEnabled) {
      return;
    }

    // CRITICAL: Don't initialize until storage is loaded
    if (!storageLoaded) {
      setTimeout(() => initializeDetector(video), 100);
      return;
    }

    // Get the current video source (URL or src attribute)
    const currentSrc = video.currentSrc || video.src;

    // For YouTube, use the video ID from URL instead of video src
    const videoId = getVideoId();

  // Don't process videos on non-watch/non-shorts pages (homepage, search, etc.)
  // if (!videoId) {
  //   return;
  // }

    // If no source yet, wait for it
    if (!currentSrc) {
      return;
    }

    // Check if this is a new video by comparing sources
    const previousSrc = video.dataset.flashGuardianSrc;
    const previousVideoId = video.dataset.flashGuardianVideoId;
    const isNewVideo = (previousSrc !== currentSrc) || (previousVideoId !== videoId);

    // initializeDetector called (debug info omitted)

    // If video element already has a detector
      if (detectors.has(video)) {
      // If it's the same video, don't reinitialize
      if (!isNewVideo) {
        return;
      }

      // New video in same element - stop old detector and create new one
  // New video detected in existing element
      const oldDetector = detectors.get(video);
      oldDetector.stop();
      detectors.delete(video);
    }

    // Additional guard: If this exact videoId has already been processed, skip
    // This handles the case where initializeDetector is called twice in rapid succession
    if (visitedVideos.has(videoId) && video.dataset.flashGuardianVideoId === videoId) {
      return;
    }

    // Wait for video metadata to load
    if (video.readyState < 2) {
      video.addEventListener('loadedmetadata', () => initializeDetector(video), { once: true });
      return;
    }

    // CRITICAL: Mark the video as processed BEFORE creating detector
    // This prevents double-counting if initializeDetector is called twice rapidly
    video.dataset.flashGuardianSrc = currentSrc;
    video.dataset.flashGuardianVideoId = videoId;

    const detector = new FlashDetector(video, videoId, warnedVideos, () => protectionEnabled);
    detectors.set(video, detector);

  // Created new detector for video ID (debug omitted)

    // Report video monitored to popup (only for unique videos never seen before)
    const alreadyVisited = visitedVideos.has(videoId);

  if (!alreadyVisited) {
      // Add to set IMMEDIATELY to prevent double-counting if called twice rapidly
  visitedVideos.add(videoId);

      // Save visited videos to storage FIRST for persistence
      chrome.storage.local.set({ visitedVideos: Array.from(visitedVideos) }, () => {

        // THEN send the message to update stats
        try {
          chrome.runtime.sendMessage({
            action: 'updateStats',
            stat: 'videoMonitored'
          }).then(response => {
          }).catch(error => {
            if (error && error.message && error.message.includes('Extension context invalidated')) {
              console.warn('[Halo] Extension was reloaded, cannot send message');
            } else {
              console.error('[Halo] Error sending videoMonitored message:', error);
            }
          });
        } catch (error) {
          console.warn('[Halo] Cannot send message, extension context may be invalid:', error);
        }
      });
    } else {
    }

    setupVideoEventListeners(video, detector);

    // If video is already playing, start detection immediately (only if protection enabled)
    if (!video.paused && protectionEnabled) {
      detector.start();
    }
  }

  /**
   * Setup event listeners for a video element
   */
  function setupVideoEventListeners(video, detector) {
    // Check if already set up to avoid duplicate listeners
    if (video.dataset.flashGuardianListenersSetup === 'true') {
      return;
    }
    video.dataset.flashGuardianListenersSetup = 'true';

    // Start detection when video plays
    video.addEventListener('play', () => {
      // Only start detection if protection is enabled
      if (!protectionEnabled) {
        return;
      }

      // If playing from the beginning (first 3 seconds), reset warning
      if (video.currentTime < 3) {
        detector.warningShown = false;
        detector.totalFlashes = 0;
        detector.maxFlashesPerSecond = 0;
      }
      detector.start();
    });

    // Stop detection when video pauses
    video.addEventListener('pause', () => {
      detector.stop();
    });

    // Reset detection state when seeking to avoid false positives
      video.addEventListener('seeking', () => {
      detector.resetDetectionState();

      // If seeking backwards or to the beginning, allow warning to show again
      if (video.currentTime < 10) {
        detector.warningShown = false;
        detector.totalFlashes = 0;
        detector.maxFlashesPerSecond = 0;
      }
    });

    // Clean up when video ends
    video.addEventListener('ended', () => {
      detector.stop();
    });

  // Setup event listeners for video (debug info omitted)
  }

  /**
   * Find and monitor all video elements
   */
  function findAndMonitorVideos() {
    // Don't initialize until storage is loaded
    if (!storageLoaded) {
      return;
    }

    const videos = document.querySelectorAll('video');
  // Found videos on page (debug omitted)
    videos.forEach(video => initializeDetector(video));
  }

  // Note: Initial scan is now called from Promise.all().then() above after storage loads

  // Watch for dynamically added videos (e.g., YouTube/TikTok)
  // Throttle to avoid excessive calls
  let observerTimeout;
  const observer = new MutationObserver(() => {
    if (observerTimeout) return;
    observerTimeout = setTimeout(() => {
      findAndMonitorVideos();
      observerTimeout = null;
    }, 500); // Wait 500ms before checking again
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Create warning overlay when flash is detected
  document.addEventListener('flashDetected', (event) => {
    // Only show warning if protection is enabled
    if (!protectionEnabled) {
      return;
    }
    showWarningOverlay(event.detail);
  });

  // Listen for messages from popup (e.g., enable/disable, reset stats)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'enable') {
      protectionEnabled = true;
      // Start all detectors if videos are playing
      detectors.forEach(detector => {
        if (!detector.video.paused) {
          detector.start();
        }
      });
    } else if (request.action === 'disable') {
      protectionEnabled = false;
      // Stop all detectors
      detectors.forEach(detector => detector.stop());

      // Hide any visible warning overlay
      const overlay = document.getElementById('halo-overlay');
      if (overlay) {
        overlay.style.display = 'none';
      }
    } else if (request.action === 'resetStats') {
      // Clearing visited videos cache and warned videos
      // Clear the visited videos set so videos can be counted again
      visitedVideos.clear();
      // Clear the warned videos set so warnings can be issued again
      warnedVideos.clear();
      // Also clear from storage
      chrome.storage.local.set({ visitedVideos: [] }, () => {
      });
    }
    sendResponse({ success: true });
    return true;
  });

  /**
   * Create and show warning overlay
   */
  function showWarningOverlay(details) {
    // Check if extension context is still valid
    try {
      if (!chrome.runtime?.id) {
        // Extension context invalidated
        return;
      }
    } catch (e) {
      // Extension context invalidated
      return;
    }

    // Check if overlay already exists
    let overlay = document.getElementById('halo-overlay');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'halo-overlay';

      let warningIconUrl;
      try {
        warningIconUrl = chrome.runtime.getURL('icons/warning.png');
      } catch (e) {
        // Cannot get icon URL; extension context invalidated
        return;
      }

      overlay.innerHTML = `
        <div class="halo-content">
          <div class="halo-icon">
            <img src="${warningIconUrl}" alt="Warning">
          </div>
          <h2>Photosensitive Warning</h2>
          <p class="halo-message">
            Rapid flashing content detected (<strong>${details.flashCount} flashes/second</strong>)
          </p>
          <p class="halo-info">
            This video may contain content that could trigger seizures in people with photosensitive epilepsy.
          </p>
          <div class="halo-stats">
            <div>Max flashes/sec: <strong>${details.maxFlashesPerSecond}</strong></div>
            <div>Total flashes: <strong>${details.totalFlashes}</strong></div>
            <div>Timestamp: <strong>${Math.floor(details.timestamp)}s</strong></div>
          </div>
          <div class="halo-buttons">
            <button id="halo-continue" class="fg-btn fg-btn-danger">
              Continue Anyway (Not Recommended)
            </button>
            <button id="halo-close" class="fg-btn fg-btn-primary">
              Pause Video
            </button>
          </div>
          <p class="halo-wcag">
            Detection based on WCAG 2.1 Guidelines (≥3 flashes/second threshold)
          </p>
        </div>
      `;

      document.body.appendChild(overlay);

      // Add event listeners
      document.getElementById('halo-continue').addEventListener('click', () => {
        const videos = document.querySelectorAll('video');
        // Stop any speech warnings before resuming playback
        try {
          if (window.speechSynthesis && typeof window.speechSynthesis.cancel === 'function') {
            window.speechSynthesis.cancel();
          }
        } catch (e) {
          // Ignore if speechSynthesis isn't available or cancel fails
        }

        videos.forEach(video => {
          const detector = detectors.get(video);
          if (detector) {
            detector.resetWarning();
            video.play();
          }
        });

        overlay.style.display = 'none';
      });

      document.getElementById('halo-close').addEventListener('click', () => {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
          video.pause();
          // Keep video at current position instead of resetting
        });
        // Stop any speech warnings when pausing the video
        try {
          if (window.speechSynthesis && typeof window.speechSynthesis.cancel === 'function') {
            window.speechSynthesis.cancel();
          }
        } catch (e) {
          // Ignore if speechSynthesis isn't available or cancel fails
        }

        overlay.style.display = 'none';

        // Optionally close the tab or go back
        // window.history.back();
      });
    } else {
      // Update existing overlay with new data
      overlay.querySelector('.halo-message').innerHTML =
        `Rapid flashing content detected (<strong>${details.flashCount} flashes/second</strong>)`;
      overlay.querySelector('.halo-stats').innerHTML = `
        <div>Max flashes/sec: <strong>${details.maxFlashesPerSecond}</strong></div>
        <div>Total flashes: <strong>${details.totalFlashes}</strong></div>
        <div>Timestamp: <strong>${Math.floor(details.timestamp)}s</strong></div>
      `;
      overlay.style.display = 'flex';
    }
  }
})();
