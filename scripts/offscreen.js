/**
 * Halo Offscreen Document
 * Handles audio playback for the extension
 */

let audioElement = null;

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Offscreen received message (debug omitted)

  if (request.action === 'startAudio') {
    const soundFile = request.soundFile;
    try {
      // Stop any existing audio gracefully
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
        audioElement = null;
      }

      // Create and play audio
      audioElement = new Audio(chrome.runtime.getURL(soundFile));
      audioElement.loop = true;
      audioElement.volume = 0.3;

      // Play audio with better error handling
      const playPromise = audioElement.play();

      if (playPromise !== undefined) {
        playPromise.then(() => {
          // Offscreen audio started (debug omitted)
          sendResponse({ success: true });
        }).catch((error) => {
          // Ignore "interrupted" errors as they're harmless
          if (error.name === 'AbortError') {
            // Audio play was interrupted (harmless)
            sendResponse({ success: true });
          } else {
            console.error('[Halo Offscreen] Error playing audio:', error);
            sendResponse({ success: false, error: error.message });
          }
        });
      } else {
        sendResponse({ success: true });
      }
    } catch (error) {
      console.error('[Halo Offscreen] Error creating audio:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  if (request.action === 'stopAudio') {
    try {
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
        audioElement.src = '';
        audioElement = null;
  // Offscreen audio stopped (debug omitted)
      }
      sendResponse({ success: true });
    } catch (error) {
      console.error('[Halo Offscreen] Error stopping audio:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  if (request.action === 'getAudioState') {
    const playing = audioElement !== null && !audioElement.paused;
    sendResponse({ playing: playing });
    return true;
  }
});

// Offscreen audio player initialized (debug omitted)
