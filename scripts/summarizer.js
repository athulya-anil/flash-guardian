/**
 * Halo - Text Summarizer Content Script
 * Extracts article text from web pages for summarization
 */

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractText') {
    const text = extractArticleText();
    sendResponse({ text: text });
  }
  return true; // Keep channel open for async response
});

/**
 * Extract readable article text from the page
 * Uses multiple strategies to find main content
 */
function extractArticleText() {
  let text = '';

  // Strategy 1: Try to find <article> tag
  const article = document.querySelector('article');
  if (article) {
    text = extractTextFromElement(article);
    if (text.length > 200) return text;
  }

  // Strategy 2: Try common article containers
  const selectors = [
    'article',
    '[role="article"]',
    '.article-content',
    '.post-content',
    '.entry-content',
    '.content',
    'main article',
    'main .content',
    '.article-body',
    '.post-body',
    '[class*="article"]',
    '[class*="post-content"]'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      text = extractTextFromElement(element);
      if (text.length > 200) return text;
    }
  }

  // Strategy 3: Find the element with most paragraph text
  const mainContent = findMainContentByTextDensity();
  if (mainContent) {
    text = extractTextFromElement(mainContent);
    if (text.length > 200) return text;
  }

  // Strategy 4: Fall back to all paragraphs on page
  const paragraphs = document.querySelectorAll('p');
  const paragraphTexts = Array.from(paragraphs)
    .map(p => p.textContent.trim())
    .filter(t => t.length > 50); // Filter out short paragraphs

  return paragraphTexts.join('\n\n');
}

/**
 * Extract clean text from an element
 */
function extractTextFromElement(element) {
  // Clone element to avoid modifying the page
  const clone = element.cloneNode(true);

  // Remove unwanted elements
  const unwantedSelectors = [
    'script',
    'style',
    'nav',
    'header',
    'footer',
    'aside',
    '.advertisement',
    '.ad',
    '.social-share',
    '.comments',
    '[class*="comment"]',
    '[class*="sidebar"]',
    '[class*="ad-"]',
    '[class*="promo"]'
  ];

  unwantedSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });

  // Get text content
  let text = clone.textContent || '';

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
    .trim();

  return text;
}

/**
 * Find main content by analyzing text density
 * Returns the element with the most paragraph text
 */
function findMainContentByTextDensity() {
  const containers = document.querySelectorAll('div, section, main');
  let maxScore = 0;
  let bestElement = null;

  containers.forEach(container => {
    const paragraphs = container.querySelectorAll('p');
    let textLength = 0;

    paragraphs.forEach(p => {
      const text = p.textContent.trim();
      if (text.length > 50) { // Only count substantial paragraphs
        textLength += text.length;
      }
    });

    // Score based on text length and number of paragraphs
    const score = textLength * paragraphs.length;

    if (score > maxScore) {
      maxScore = score;
      bestElement = container;
    }
  });

  return bestElement;
}

// Summarizer content script loaded (debug omitted)
