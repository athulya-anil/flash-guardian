/**
 * Halo Background Service Worker
 * Handles message passing and statistics tracking
 */

// Queue to serialize stat updates and prevent race conditions
let updateQueue = Promise.resolve();

// Offscreen document state
let offscreenDocumentCreated = false;

// Create offscreen document for audio playback
async function createOffscreenDocument() {
  if (offscreenDocumentCreated) {
    return;
  }

  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play background meditation music'
    });
    offscreenDocumentCreated = true;
  } catch (error) {
  }
}

// Track active tabs for each platform
let platformTabs = {
  youtube: new Set(),
  tiktok: new Set(),
  twitter: new Set(),
  instagram: new Set(),
  twitch: new Set()
};

// Platform URL matchers
const platformMatchers = {
  youtube: /youtube\.com/,
  tiktok: /tiktok\.com/,
  twitter: /(twitter\.com|x\.com)/,
  instagram: /instagram\.com/,
  twitch: /twitch\.tv/
};

/**
 * Determine which platform a URL belongs to
 */
function getPlatformFromUrl(url) {
  if (!url) return null;
  for (const [platform, regex] of Object.entries(platformMatchers)) {
    if (regex.test(url)) return platform;
  }
  return null;
}

/**
 * Reset stats to zero
 */
function resetStats() {
  const resetStatsObj = {
    videosMonitored: 0,
    warningsIssued: 0,
    flashesDetected: 0
  };

  chrome.storage.local.set({ stats: resetStatsObj }, () => {
  });

  chrome.storage.sync.set({ stats: resetStatsObj }, () => {
  });
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // Handle audio control messages - forward to offscreen document
  if (request.action === 'startAudio' || request.action === 'stopAudio' || request.action === 'getAudioState') {
    // Create offscreen document if needed
    createOffscreenDocument().then(() => {
      // Forward the message to the offscreen document
      chrome.runtime.sendMessage(request, (response) => {
        sendResponse(response);
      });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }

  if (request.action === 'updateStats') {
    // Serialize updates using a queue to prevent race conditions
    updateQueue = updateQueue.then(() => {
      return new Promise((resolve) => {
        // Read from local storage for faster access
        chrome.storage.local.get(['stats'], (data) => {
          const stats = data.stats || {
            videosMonitored: 0,
            warningsIssued: 0,
            flashesDetected: 0
          };



          // Update stats based on the request
          if (request.stat === 'videoMonitored') {
            stats.videosMonitored++;
          }
          if (request.stat === 'warningIssued') {
            stats.warningsIssued++;
          }
          if (request.stat === 'flashDetected') {
            stats.flashesDetected += request.count || 1;
          }

          // Save to both storages simultaneously
          const localSave = new Promise(saveResolve => {
            chrome.storage.local.set({ stats }, () => {
              saveResolve();
            });
          });

          const syncSave = new Promise(saveResolve => {
            chrome.storage.sync.set({ stats }, () => {
              saveResolve();
            });
          });

          Promise.all([localSave, syncSave]).then(() => {
            sendResponse({ success: true, stats });
            resolve();
          });
        });
      });
    });

    return true; // Keep message channel open for async response
  }
});

// Initialize default settings on install (first time only)
chrome.runtime.onInstalled.addListener((details) => {

  if (details.reason === 'install') {
    // First time installation - set defaults in both storages
    const defaultSettings = {
      enabled: true,
      autoPause: true,
      audioEnabled: false, // Audio OFF by default
      soundType: 'meditation',
      stats: {
        videosMonitored: 0,
        warningsIssued: 0,
        flashesDetected: 0
      }
    };
    chrome.storage.sync.set(defaultSettings);
    chrome.storage.local.set(defaultSettings);
  } else if (details.reason === 'update') {
    // Extension updated - preserve existing stats, ensure settings exist
    // Check both local and sync storage to preserve stats
    chrome.storage.local.get(['stats'], (localData) => {
      chrome.storage.sync.get(['enabled', 'autoPause', 'stats'], (syncData) => {
        const updates = {};
        if (syncData.enabled === undefined) updates.enabled = true;
        if (syncData.autoPause === undefined) updates.autoPause = true;

        // Preserve stats from local storage if available, otherwise use sync, otherwise reset
        if (!syncData.stats && !localData.stats) {
          updates.stats = {
            videosMonitored: 0,
            warningsIssued: 0,
            flashesDetected: 0
          };
        } else if (localData.stats) {
          // Copy from local to sync if local has stats
          updates.stats = localData.stats;
        }

        if (Object.keys(updates).length > 0) {
          chrome.storage.sync.set(updates, () => {
            // Also ensure local storage has the stats
            if (updates.stats) {
              chrome.storage.local.set({ stats: updates.stats });
            }
          });
        }
      });
    });
  }
});

// Track when tabs are created or updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Handle page load completion
  if (changeInfo.status === 'complete' && tab.url) {
    const platform = getPlatformFromUrl(tab.url);
    if (platform) {
      platformTabs[platform].add(tabId);
    }
  }

  // Handle URL changes (navigation within a tab)
  if (changeInfo.url) {
    const newPlatform = getPlatformFromUrl(changeInfo.url);

    // Remove tab from all platforms first
    for (const [platform, tabSet] of Object.entries(platformTabs)) {
      if (tabSet.has(tabId) && platform !== newPlatform) {
        tabSet.delete(tabId);
      }
    }

    // Add to new platform if applicable
    if (newPlatform) {
      platformTabs[newPlatform].add(tabId);
    }
  }
});

// Track when tabs are activated (switched to)
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab && tab.url) {
      const platform = getPlatformFromUrl(tab.url);
      if (platform) {
        platformTabs[platform].add(activeInfo.tabId);
      }
    }
  });
});

// Track when tabs are removed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {

  // Remove the tab from all platform sets
  for (const [platform, tabSet] of Object.entries(platformTabs)) {
    if (tabSet.has(tabId)) {
      tabSet.delete(tabId);
    }
  }
});
