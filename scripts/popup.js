/**
 * Halo Popup Script
 * Handles settings and statistics display
 */

// Current view state
let currentView = 'flash'; // 'flash' or 'summarizer'

// ============================================
// BACKGROUND AUDIO FUNCTIONALITY
// ============================================

let audioActive = false;
let currentSoundType = 'meditation';

// Map sound types to file paths
const soundFiles = {
  'meditation': 'sounds/Short Meditation Music - 3 Minute Relaxation, Calming.mp3'
  // Add more sounds here as you download them:
  // 'rain': 'sounds/rain.mp3',
  // 'ocean': 'sounds/ocean.mp3',
  // 'white': 'sounds/white-noise.mp3',
};

// Initialize audio toggle from storage
chrome.storage.sync.get(['audioEnabled', 'soundType'], (data) => {
  audioActive = data.audioEnabled === true; // Explicitly check for true, defaults to false
  currentSoundType = data.soundType || 'meditation'; // Default to meditation

  const toggle = document.getElementById('whiteNoiseToggle');
  const soundSelect = document.getElementById('soundType');

  if (toggle) {
    toggle.checked = audioActive;
  }
  if (soundSelect) {
    soundSelect.value = currentSoundType;
  }

  // If audio was ON before, make sure it's playing in background
  if (audioActive) {
    startAudio(currentSoundType);
  }
});

// Audio toggle change handler
document.getElementById('whiteNoiseToggle').addEventListener('change', (e) => {
  audioActive = e.target.checked;

  if (audioActive) {
    currentSoundType = document.getElementById('soundType').value;
    startAudio(currentSoundType);
  } else {
    stopAudio();
  }

  // Save state
  chrome.storage.sync.set({ audioEnabled: audioActive });
});

// Sound type selector change handler
document.getElementById('soundType').addEventListener('change', (e) => {
  currentSoundType = e.target.value;
  chrome.storage.sync.set({ soundType: currentSoundType });

  // If audio is currently playing, restart with new sound type
  if (audioActive) {
    stopAudio();
    setTimeout(() => startAudio(currentSoundType), 100);
  }
});

function startAudio(soundType = 'meditation') {
  try {
    // Get the file path for this sound type
    const audioFile = soundFiles[soundType];
    if (!audioFile) {
      console.error(`[Halo] No audio file found for sound type: ${soundType}`);
      return;
    }

    // Send message to background worker to start audio
    chrome.runtime.sendMessage({
      action: 'startAudio',
      soundFile: audioFile
    }, (response) => {
      if (response && response.success) {
        console.log(`[Halo] Playing: ${soundType}`);
      } else {
        console.error('[Halo] Error playing audio:', response?.error);
      }
    });

  } catch (error) {
    console.error('[Halo] Error starting audio:', error);
  }
}

function stopAudio() {
  try {
    // Send message to background worker to stop audio
    chrome.runtime.sendMessage({
      action: 'stopAudio'
    }, (response) => {
      if (response && response.success) {
        console.log('[Halo] Audio stopped');
      } else {
        console.error('[Halo] Error stopping audio:', response?.error);
      }
    });
  } catch (error) {
    console.error('[Halo] Error stopping audio:', error);
  }
}

// ============================================
// VIEW TOGGLE FUNCTIONALITY
// ============================================

// View toggle functionality
document.getElementById('viewToggle').addEventListener('click', () => {
  if (currentView === 'flash') {
    switchToSummarizer();
  } else {
    switchToFlash();
  }
});

function switchToFlash() {
  currentView = 'flash';
  document.getElementById('flashView').classList.add('active');
  document.getElementById('summarizerView').classList.remove('active');
  document.getElementById('viewToggle').innerHTML = '<img src="icons/notepad.png" alt="Notepad" class="icon-img">';
  document.getElementById('viewToggle').title = 'Switch to Summarizer';
  document.getElementById('viewToggleHint').textContent = 'Summarizer';
  document.getElementById('viewToggleHint').style.display = 'inline';
  document.getElementById('headerSubtitle').textContent = 'Photosensitive Content Protection';
  // Hide settings and music buttons in flash view
  document.getElementById('settingsBtn').style.display = 'none';
  document.getElementById('musicBtn').style.display = 'none';
}

function switchToSummarizer() {
  currentView = 'summarizer';
  document.getElementById('flashView').classList.remove('active');
  document.getElementById('summarizerView').classList.add('active');
  document.getElementById('viewToggle').innerHTML = '<img src="icons/shield.png" alt="Shield" class="icon-img">';
  document.getElementById('viewToggle').title = 'Switch to Flash Protection';
  document.getElementById('viewToggleHint').style.display = 'none';
  document.getElementById('headerSubtitle').textContent = 'AI-Powered Text Summarizer';
  // Show settings and music buttons in summarizer view
  document.getElementById('settingsBtn').style.display = 'flex';
  document.getElementById('musicBtn').style.display = 'flex';
  // Clear everything when switching to summarizer view
  document.getElementById('textInput').value = '';
  document.getElementById('summaryResult').style.display = 'none';
  document.getElementById('summaryError').style.display = 'none';
  document.getElementById('summaryLoading').style.display = 'none';
}

// Settings button - opens modal
document.getElementById('settingsBtn').addEventListener('click', () => {
  openSettingsModal();
});

// Music button - toggles audio section visibility
document.getElementById('musicBtn').addEventListener('click', () => {
  const audioSection = document.getElementById('audioSection');
  if (audioSection) {
    // Toggle visibility
    if (audioSection.style.display === 'none' || audioSection.style.display === '') {
      audioSection.style.display = 'block';
      // Scroll to it
      setTimeout(() => {
        audioSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add a brief highlight effect
        audioSection.style.transition = 'background-color 0.3s ease';
        audioSection.style.backgroundColor = 'rgba(184, 245, 10, 0.15)';
        setTimeout(() => {
          audioSection.style.backgroundColor = '';
        }, 1200);
      }, 100);
    } else {
      audioSection.style.display = 'none';
    }
  }
});

// Load settings from storage
chrome.storage.sync.get(['enabled', 'autoPause'], (data) => {
  // Set toggle state for enable protection
  document.getElementById('enableToggle').checked = data.enabled !== false;

  // Auto-pause is always enabled (no toggle in UI)

  // Update status display
  updateStatusDisplay(data.enabled !== false);
});

// Load statistics from local storage (faster and more reliable)
chrome.storage.local.get(['stats'], (data) => {
  if (data.stats) {
    document.getElementById('videosMonitored').textContent = data.stats.videosMonitored || 0;
    document.getElementById('warningsIssued').textContent = data.stats.warningsIssued || 0;
    document.getElementById('flashesDetected').textContent = data.stats.flashesDetected || 0;
  }
});

// Handle enable/disable toggle
document.getElementById('enableToggle').addEventListener('change', (e) => {
  const enabled = e.target.checked;

  chrome.storage.sync.set({ enabled }, () => {
    updateStatusDisplay(enabled);

    // Notify content scripts
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: enabled ? 'enable' : 'disable'
        }).catch(() => {
          // Ignore errors for tabs that don't have our content script
        });
      }
    });
  });
});

// Auto-pause is always enabled (removed toggle from UI)

/**
 * Update status display based on enabled state
 */
function updateStatusDisplay(enabled) {
  const statusDiv = document.getElementById('status');

  if (enabled) {
    statusDiv.classList.remove('disabled');
    statusDiv.querySelector('h2').innerHTML = `
      <span class="status-indicator"></span>
      Protection Active
    `;
    statusDiv.querySelector('p').textContent = 'Monitoring videos for flashing content';
  } else {
    statusDiv.classList.add('disabled');
    statusDiv.querySelector('h2').innerHTML = `
      <span class="status-indicator"></span>
      Protection Disabled
    `;
    statusDiv.querySelector('p').textContent = 'Flash detection is currently off';
  }
}

// Function to update stats display
function updateStatsDisplay() {
  chrome.storage.local.get(['stats'], (data) => {
    if (data.stats) {
      console.log('[Halo Popup] Updating stats display:', data.stats);
      document.getElementById('videosMonitored').textContent = data.stats.videosMonitored || 0;
      document.getElementById('warningsIssued').textContent = data.stats.warningsIssued || 0;
      document.getElementById('flashesDetected').textContent = data.stats.flashesDetected || 0;
    }
  });
}

// Refresh statistics every second while popup is open
setInterval(updateStatsDisplay, 500); // Update twice per second for better responsiveness

// Also listen for storage changes for immediate updates
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (changes.stats) {
    console.log('[Halo Popup] Storage changed:', changes.stats.newValue);
    updateStatsDisplay();
  }
});

// Reset statistics button
document.getElementById('resetStats').addEventListener('click', () => {
  const resetStats = {
    videosMonitored: 0,
    warningsIssued: 0,
    flashesDetected: 0
  };

  // Use both sync and local storage to ensure complete reset
  chrome.storage.local.set({ stats: resetStats }, () => {
    chrome.storage.sync.set({ stats: resetStats }, () => {
      // Update UI immediately
      document.getElementById('videosMonitored').textContent = '0';
      document.getElementById('warningsIssued').textContent = '0';
      document.getElementById('flashesDetected').textContent = '0';

      // Notify all content scripts to clear their visited videos cache
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { action: 'resetStats' }).catch(() => {
            // Ignore errors for tabs that don't have our content script
          });
        });
      });

      // Visual feedback
      const button = document.getElementById('resetStats');
      const originalText = button.textContent;
      button.textContent = 'Statistics Reset!';
      button.style.background = 'linear-gradient(135deg, #b8f50a 0%, #00d4ff 100%)';
      button.style.color = '#1a1a1a';

      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = '#1a1a1a';
        button.style.color = '#ffffff';
      }, 1500);

      console.log('[Halo] Statistics reset successfully');
    });
  });
});

// ============================================
// SUMMARIZER FUNCTIONALITY
// ============================================

// Generate button
document.getElementById('generateBtn').addEventListener('click', () => {
  const type = document.getElementById('summaryType').value;
  generateSummary(type);
});

// Add Enter key support for textarea (Ctrl+Enter or Cmd+Enter to generate)
document.getElementById('textInput').addEventListener('keydown', (e) => {
  // Check for Ctrl+Enter (Windows/Linux) or Cmd+Enter (Mac)
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    const type = document.getElementById('summaryType').value;
    generateSummary(type);
  }
});

// Clear button
document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('textInput').value = '';
  document.getElementById('summaryResult').style.display = 'none';
  document.getElementById('summaryError').style.display = 'none';
  document.getElementById('summaryLoading').style.display = 'none';
});

// Auto-Generate button - extracts text from current page
document.getElementById('autoGenerateBtn').addEventListener('click', async () => {
  const btn = document.getElementById('autoGenerateBtn');
  const originalText = btn.textContent;

  try {
    // Disable button and show loading state
    btn.disabled = true;
    btn.textContent = '⏳ Extracting text...';

    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // First, ensure the content script is injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['scripts/summarizer.js']
      });
      // Wait a bit for the script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (injectionError) {
      // Script might already be injected, continue
      console.log('[Halo] Content script may already be injected:', injectionError);
    }

    // Send message to content script to extract text
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractText' });

    if (response && response.text) {
      const extractedText = response.text.trim();

      if (extractedText.length < 100) {
        showError('Could not find enough article text on this page. Try pasting the text manually.');
        btn.disabled = false;
        btn.textContent = originalText;
        return;
      }

      // Fill the textarea
      document.getElementById('textInput').value = extractedText;

      // Show success feedback
      btn.textContent = 'Text Extracted!';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 2000);

      // Focus on the textarea so user can see the content
      document.getElementById('textInput').focus();

    } else {
      throw new Error('No text returned from page');
    }

  } catch (error) {
    console.error('[Halo] Auto-generate error:', error);
    showError('Could not extract text from this page. The page might not be supported, or you may need to refresh the page first.');
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

// Generate summary function
async function generateSummary(type) {
  const textInput = document.getElementById('textInput').value.trim();

  // Check if text is provided
  if (!textInput) {
    showError('Please paste article text in the box above, or click "Auto-Generate from Page" to extract text from the current page.');
    return;
  }

  if (textInput.length < 100) {
    showError('Please provide more text (at least 100 characters) for a meaningful summary.');
    return;
  }

  // Check which provider is configured
  chrome.storage.sync.get(['geminiApiKey'], async (data) => {
    const apiKey = data.geminiApiKey ;

    if (!apiKey) {
      showError(`Please configure your Gemini API key first. Click the ⚙️ settings icon at the top.`);
      return;
    }

    // Show loading state
    showLoading();

    try {
      // Call appropriate API to summarize
      const summary = await summarizeText(textInput, type, apiKey);
      showSummary(summary);
    } catch (error) {
      showError('Error: ' + error.message);
    }
  });
}

// Copy summary button - REMOVED (button no longer exists in UI)

// AI Provider selector
document.getElementById('aiProvider').addEventListener('change', (e) => {
  const provider = e.target.value;
  if (provider === 'gemini') {
    document.getElementById('geminiKeySection').style.display = 'block';
  } else if (provider === 'elevenlabs') {
    document.getElementById('geminiKeySection').style.display = 'none';
    document.getElementById('elevenLabsKeySection').style.display = 'block';
  }
});

// Settings Modal Functions
function openSettingsModal() {
  // Load existing settings
    chrome.storage.sync.get(['geminiApiKey', 'elevenLabsApiKey', 'voiceId'], (data) => {
    // Set provider
    const provider = data.aiProvider || 'gemini';
    document.getElementById('aiProvider').value = provider;

    // Trigger change event to show correct section
    document.getElementById('aiProvider').dispatchEvent(new Event('change'));

    // Load API keys
    if (data.geminiApiKey) {
      document.getElementById('apiKeyInput').value = data.geminiApiKey;
    }
    if (data.elevenLabsApiKey) {
      document.getElementById('elevenLabsApiKeyInput').value = data.elevenLabsApiKey;
    }
    if (data.voiceId) {
      document.getElementById('voiceSelect').value = data.voiceId || 'JBFqnCBsd6RMkjVDRZzb';
    }
  });
  document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('active');
  document.getElementById('apiKeyInput').value = '';
}

// Save settings
document.getElementById('saveSettings').addEventListener('click', () => {
  const provider = document.getElementById('aiProvider').value;
  const geminiKey = document.getElementById('apiKeyInput').value.trim();
  const elevenLabsKey = document.getElementById('elevenLabsApiKeyInput').value.trim();
  const voiceId = document.getElementById('voiceSelect').value;


  // Validate based on provider
  if (provider === 'gemini' && !geminiKey) {
    alert('Please enter a Gemini API key');
    return;
  }

  if (provider === 'elevenlabs' && !elevenLabsKey) {
    alert('Please enter an ElevenLabs API key');
    return;
  }

  // Save settings
  chrome.storage.sync.set({
    aiProvider: provider,
    geminiApiKey: geminiKey,
    elevenLabsApiKey: elevenLabsKey,
    voiceId: voiceId
  }, () => {
    closeSettingsModal();
    // Show success message
    if (currentView === 'summarizer') {
      document.getElementById('summaryError').style.background = '#d4edda';
      document.getElementById('summaryError').style.borderColor = '#28a745';
      document.getElementById('summaryError').style.color = '#155724';
      errormsg = aiProvider === 'gemini' ? `✓ Gemini API key saved! You can now generate summaries.` : `✓ ElevenLabs API key saved! You can now use Text-to-Speech.`;
      showError(errormsg);
      setTimeout(() => {
        document.getElementById('summaryError').style.display = 'none';
        document.getElementById('summaryError').style.background = '#ffebee';
        document.getElementById('summaryError').style.borderColor = '#ef5350';
        document.getElementById('summaryError').style.color = '#c62828';
      }, 3000);
    }
  });
});

// Cancel settings
document.getElementById('cancelSettings').addEventListener('click', () => {
  closeSettingsModal();
});

// Close modal when clicking outside
document.getElementById('settingsModal').addEventListener('click', (e) => {
  if (e.target.id === 'settingsModal') {
    closeSettingsModal();
  }
});

// Show loading state
function showLoading() {
  document.getElementById('summaryResult').style.display = 'none';
  document.getElementById('summaryError').style.display = 'none';
  document.getElementById('summaryLoading').style.display = 'block';
}

// Show summary result
function showSummary(text) {
  document.getElementById('summaryLoading').style.display = 'none';
  document.getElementById('summaryError').style.display = 'none';
  document.getElementById('summaryText').textContent = text;
  document.getElementById('summaryResult').style.display = 'block';
}

// Show error message
function showError(message) {
  document.getElementById('summaryLoading').style.display = 'none';
  document.getElementById('summaryResult').style.display = 'none';
  document.getElementById('summaryError').textContent = message;
  document.getElementById('summaryError').style.display = 'block';
}

// Call AI API to summarize text (supports Gemini)
async function summarizeText(text, type, apiKey) {
  const prompts = {
    quick: 'Summarize this article in 2-3 clear, concise sentences. Focus on the main point and key takeaway. DO NOT use markdown formatting like ** or bold. Just plain text:\n\n',
    bullets: 'Summarize this article as 3-5 KEY bullet points only. Focus on the most important takeaways. Keep each bullet point to ONE short sentence. Use simple hyphens (-) for bullets. DO NOT use sub-bullets or nested points. DO NOT use markdown. Be concise:\n\n'
  };

  const prompt = prompts[type] + text.substring(0, 15000); // Limit text length

  let summary;
  summary = await summarizeWithGemini(prompt, apiKey);

  // Clean up markdown formatting
  summary = cleanMarkdown(summary);
  return summary;
}

// Remove markdown formatting from summary
function cleanMarkdown(text) {
  // Remove bold/italic markers
  text = text.replace(/\*\*/g, '');
  text = text.replace(/\*/g, '');
  text = text.replace(/__/g, '');
  text = text.replace(/_/g, '');

  // Clean up bullet points - replace * with -
  text = text.replace(/^\s*\*\s+/gm, '- ');

  return text.trim();
}

// Gemini API implementation
async function summarizeWithGemini(prompt, apiKey) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}


// Open in Web App button - redirect to companion website
document.getElementById('openWebAppBtn').addEventListener('click', () => {
    const textInput = document.getElementById('textInput').value.trim();
    const type = document.getElementById('summaryType').value;
    
    // If there's text, pass it to the web app via URL parameters
    if (textInput) {
        const encodedText = encodeURIComponent(textInput);
        const url = `app.html?text=${encodedText}&type=${type}`;
        chrome.tabs.create({ url: chrome.runtime.getURL(url) });
    } else {
        // If no text, just open the web app
        chrome.tabs.create({ url: chrome.runtime.getURL('app.html') });
    }
});
