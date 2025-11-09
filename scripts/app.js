/**
 * Halo Web App
 */

// ===================================
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', () => {

    setupEventListeners();
    updateCharCount();
    loadFromURLParams();
});

// ===================================
// EVENT LISTENERS
// ===================================

function loadFromURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const text = urlParams.get('text');
    const type = urlParams.get('type');
    
    if (text) {
        // Decode and set the text
        document.getElementById('textInput').value = decodeURIComponent(text);
        updateCharCount();
    }
    
    if (type) {
        // Set the summary type
        document.getElementById('summaryType').value = type;
    }
    
    // If text is present, scroll to the input area
    if (text) {
        document.getElementById('textInput').scrollIntoView({ behavior: 'smooth' });
    }
}

function setupEventListeners() {
    // Generate button
    document.getElementById('generateBtn').addEventListener('click', generateSummary);
    
    // Clear button
    document.getElementById('clearBtn').addEventListener('click', handleClear);
    
    // Copy button
    document.getElementById('copySummary').addEventListener('click', handleCopy);

    // Download button
    document.getElementById('downloadSummary').addEventListener('click', handleDownload);

    // Text to Speech button
    document.getElementById('ttsBtn').addEventListener('click', handleTextToSpeech);
    
    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
    
    // Modal controls
    document.getElementById('closeModal').addEventListener('click', closeSettingsModal);
    document.getElementById('cancelSettings').addEventListener('click', closeSettingsModal);
    document.getElementById('saveSettings').addEventListener('click', handleSaveSettings);
    
    // AI Provider change
    document.getElementById('aiProvider').addEventListener('change', handleProviderChange);
    
    // Character count
    document.getElementById('textInput').addEventListener('input', updateCharCount);
    
    // Close modal on outside click
    document.getElementById('settingsModal').addEventListener('click', (e) => {
        if (e.target.id === 'settingsModal') {
            closeSettingsModal();
        }
    });
}

// ===================================
// MAIN FUNCTIONS
// ===================================

// ===================================
// CLEAR AND COPY FUNCTIONS
// ===================================


function handleClear() {
    document.getElementById('textInput').value = '';
    document.getElementById('summaryResult').style.display = 'none';
    document.getElementById('summaryError').style.display = 'none';
    document.getElementById('summaryLoading').style.display = 'none';
    document.getElementById('audioPlayer').style.display = 'none';
    if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
        currentAudioUrl = null;
    }
    updateCharCount();
}

function handleCopy() {
    const summaryText = document.getElementById('summaryText').textContent;
    navigator.clipboard.writeText(summaryText).then(() => {
        const btn = document.getElementById('copySummary');
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.style.background = '#4caf50';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 2000);
    });
}

function updateCharCount() {
    const text = document.getElementById('textInput').value;
    document.getElementById('charCount').textContent = `${text.length} characters`;
}


// ===================================
// TEXT-TO-SPEECH FUNCTION (add this new function)
// ===================================

async function handleTextToSpeech() {
    // const settings = getSettings();

    chrome.storage.sync.get(['elevenLabsApiKey', 'voiceId'], async (data) => {
        const elevenLabsApiKey = data.elevenLabsApiKey;
        const voiceId = data.voiceId || 'JBFqnCBsd6RMkjVDRZzb'; // Default to Rachel

        data = {
            elevenLabsApiKey: elevenLabsApiKey,
            voiceId: voiceId
        };

    try {
      // Call appropriate API to summarize
      await handleTextToSpeechmain(data);
    } catch (error) {
      showError('Error: ' + error.message);
    }
  });

}

async function handleTextToSpeechmain(settings) {
    const summaryText = document.getElementById('summaryText').textContent;
    const elevenLabsApiKey = settings.elevenLabsApiKey;
    const voiceId = settings.voiceId || 'JBFqnCBsd6RMkjVDRZzb'; // Default to Rachel
    
    // Validation
    if (!elevenLabsApiKey) {
        showError('Please configure your ElevenLabs API key in Settings to use Text-to-Speech.');
        return;
    }
    
    if (!summaryText || summaryText.trim().length === 0) {
        showError('No summary text available to convert to speech.');
        return;
    }
    
    const ttsBtn = document.getElementById('ttsBtn');
    const originalText = ttsBtn.textContent;
    
    try {
        // Show loading state
        ttsBtn.classList.add('loading');
        ttsBtn.disabled = true;
        ttsBtn.textContent = 'Generating...';
        
        // Clean up previous audio
        // if (currentAudioUrl) {
        //     URL.revokeObjectURL(currentAudioUrl);
        //     currentAudioUrl = null;
        // }
        
        // Call ElevenLabs API
        const audioBlob = await generateSpeech(summaryText, elevenLabsApiKey, voiceId);
        
        // Create audio URL
        currentAudioUrl = URL.createObjectURL(audioBlob);
        
        // Set up audio player
        const audioPlayer = document.getElementById('audioPlayer');
        const audio = document.getElementById('summaryAudio');
        
        audio.src = currentAudioUrl;
        audioPlayer.style.display = 'block';
        
        // Auto-play the audio
        audio.play();
        
        // Update button
        ttsBtn.textContent = '🔊 Playing...';
        
        // Reset button when audio ends
        audio.onended = () => {
            ttsBtn.textContent = originalText;
        };
        
    } catch (error) {
        console.error('TTS Error:', error);
        showError('Failed to generate speech: ' + error.message);
        ttsBtn.textContent = originalText;
    } finally {
        ttsBtn.classList.remove('loading');
        ttsBtn.disabled = false;
    }
}

// ===================================
// ELEVENLABS API FUNCTION (add this new function)
// ===================================

async function generateSpeech(text, apiKey, voiceId) {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75
            }
        })
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail?.message || `ElevenLabs API error: ${response.status}`);
    }
    
    return await response.blob();
}

// ===================================
// Download Summary Function
// ===================================

function handleDownload() {
    const summaryText = document.getElementById('summaryText').textContent;
    const summaryType = document.getElementById('summaryType').value;
    
    // Create a blob with the summary text
    const blob = new Blob([summaryText], { type: 'text/plain' });
    
    // Create a download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    link.download = `flash-guardian-summary-${summaryType}-${timestamp}.txt`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Visual feedback
    const btn = document.getElementById('downloadSummary');
    const originalText = btn.textContent;
    btn.textContent = '✓ Downloaded!';
    btn.style.background = '#2e7d32';
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
    }, 2000);
}

// ===================================
// Generate Summary Function
// ===================================

async function generateSummary() {
    const type = document.getElementById('summaryType').value;
  const textInput = document.getElementById('textInput').value.trim();

  // Check if text is provided
  if (!textInput) {
    showError('Please paste some text to summarize.');
    return;
  }

  if (textInput.length < 100) {
    showError('Please provide more text (at least 100 characters) for a meaningful summary.');
    return;
  }

  // Check which provider is configured
  chrome.storage.sync.get(['geminiApiKey', 'elevenLabsApiKey', 'voiceId'], async (data) => {
    const apiKey = data.geminiApiKey;
    

    if (!apiKey) {
      showError(`Please configure your Gemini API key first. Click the ⚙️ settings icon at the top.`);
      return;
    }

    // Show loading state
    showLoading();

    closeAudio();

    try {
      // Call appropriate API to summarize
      const summary = await summarizeText(textInput, type, apiKey);
      showSummary(summary);
    } catch (error) {
      showError('Error: ' + error.message);
    }
  });
}

async function closeAudio() {
    const ttsBtn = document.getElementById('ttsBtn');
    ttsBtn.textContent = '🔊 Listen';
    document.getElementById('audioPlayer').style.display = 'none';
    const audio = document.getElementById('summaryAudio');
    audio.pause();
}

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

// Gemini API
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

// Remove markdown formatting
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

// ===================================
// UI STATE FUNCTIONS
// ===================================

function showLoading() {
    document.getElementById('summaryResult').style.display = 'none';
    document.getElementById('summaryError').style.display = 'none';
    document.getElementById('summaryLoading').style.display = 'block';
}

function showSummary(text) {
    document.getElementById('summaryLoading').style.display = 'none';
    document.getElementById('summaryError').style.display = 'none';
    document.getElementById('summaryText').textContent = text;
    document.getElementById('summaryResult').style.display = 'block';
    
    // Scroll to result
    document.getElementById('summaryResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showError(message) {
    document.getElementById('summaryLoading').style.display = 'none';
    document.getElementById('summaryResult').style.display = 'none';
    document.getElementById('summaryError').textContent = message;
    document.getElementById('summaryError').style.display = 'block';
}

function showInfo(message) {
    document.getElementById('summaryError').textContent = message;
    document.getElementById('summaryError').style.display = 'block';
}

// ===================================
// SETTINGS MODAL
// ===================================

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
  handleProviderChange();
  document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('active');
    
    // Clear password fields
    document.getElementById('apiKeyInput').value = '';
}

function handleProviderChange() {
    const provider = document.getElementById('aiProvider').value;
    
    if (provider === 'gemini') {
    document.getElementById('geminiKeySection').style.display = 'block';
  } else if (provider === 'elevenlabs') {
    document.getElementById('geminiKeySection').style.display = 'none';
    document.getElementById('elevenLabsKeySection').style.display = 'block';
  }
}

function handleSaveSettings() {
    const provider = document.getElementById('aiProvider').value;
    const geminiKey = document.getElementById('apiKeyInput').value.trim();
    const elevenLabsKey = document.getElementById('elevenLabsApiKeyInput').value.trim();
    const voiceId = document.getElementById('voiceSelect').value;
    
    // Validation
    if (provider === 'gemini' && !geminiKey) {
        alert('Please enter a Gemini API key');
        return;
    }
    
    chrome.storage.sync.set({
        aiProvider: provider,
        geminiApiKey: geminiKey,
        elevenLabsApiKey: elevenLabsKey,
        voiceId: voiceId
    }, () => {

        closeAudio();
        closeSettingsModal();

        // Show success message
        document.getElementById('summaryError').style.background = '#d4edda';
        document.getElementById('summaryError').style.borderColor = '#28a745';
        document.getElementById('summaryError').style.color = '#155724';
        errormsg = aiProvider === 'gemini' ? `✓ Gemini API key saved! You can now generate summaries.` : `✓ ElevenLabs API key saved! You can now use Text-to-Speech.`;
        showInfo(errormsg);
        setTimeout(() => {
            document.getElementById('summaryError').style.display = 'none';
            document.getElementById('summaryError').style.background = '#ffebee';
            document.getElementById('summaryError').style.borderColor = '#ef5350';
            document.getElementById('summaryError').style.color = '#c62828';
        }, 3000);
    });
    
}

