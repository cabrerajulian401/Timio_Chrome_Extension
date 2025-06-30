console.log('Background page running');

// --- Configuration ---
// Changed to the new server address as requested
const API_BASE_URL = 'https://serverfortimio.vercel.app'; 
const API_ENDPOINTS = {
  GET_CONTENT: `${API_BASE_URL}/api/content`,    // Assuming you have a /api/content endpoint
  GET_INSIGHTS: `${API_BASE_URL}/api/insights`,  // Assuming you have a /api/insights endpoint
  GET_PIVOT: `${API_BASE_URL}/api/pivot`,        // Changed to GET_PIVOT as it handles pivot articles (getTags in old code)
};

// --- Logger Utility ---
const Logger = {
  log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = {
      timestamp,
      message,
      data: data
        ? typeof data === 'string'
          ? data
          : { ...data, sensitive: undefined }
        : null,
    };
    console.log('TIMIO Extension:', logMessage);
  },

  error(message, error = null) {
    const timestamp = new Date().toISOString();
    const logMessage = {
      timestamp,
      message,
      error: error?.message || error,
      stack: error?.stack,
    };
    console.error('TIMIO Extension ERROR:', logMessage);
  },
};

// --- Cache Manager ---
const CacheManager = {
  async set(key, data) {
    try {
      Logger.log(`Setting cache for key: ${key}`);
      await chrome.storage.local.set({
        [key]: {
          data,
          timestamp: Date.now(),
        },
      });
      Logger.log(`Cache set successfully for key: ${key}`);
    } catch (error) {
      Logger.error(`Failed to set cache for key: ${key}`, error);
      throw error;
    }
  },

  async get(key) {
    try {
      Logger.log(`Getting cache for key: ${key}`);
      const result = await chrome.storage.local.get(key);
      Logger.log(`Cache retrieved for key: ${key}`);
      return result[key];
    } catch (error) {
      Logger.error(`Failed to get cache for key: ${key}`, error);
      throw error;
    }
  },

  async clear(keys) {
    try {
      Logger.log(`Clearing cache for keys:`, keys);
      await chrome.storage.local.remove(keys);
      Logger.log('Cache cleared successfully');
    } catch (error) {
      Logger.error('Failed to clear cache', error);
      throw error;
    }
  },

  isExpired(timestamp) {
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    return Date.now() - timestamp > CACHE_DURATION;
  },
};

// --- API Service with Retry Logic ---
const ApiService = {
  async fetchWithRetry(url, options, retries = 5) {
    Logger.log(`Making API request to: ${url}`, {
      method: options.method,
      hasBody: !!options.body,
    });

    let lastError;
    for (let i = 0; i < retries; i++) {
      try {
        Logger.log(`Request attempt ${i + 1} of ${retries}`);

        const finalUrl =
          options.method === 'GET' && options.params
            ? `${url}?${new URLSearchParams(options.params)}`
            : url;

        Logger.log('Request details:', {
          url: finalUrl,
          method: options.method,
          hasParams: !!options.params,
          hasBody: !!options.body,
        });

        const response = await fetch(finalUrl, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HTTP error! status: ${response.status}, details: ${errorText}`
          );
        }

        const data = await response.json();
        Logger.log(`API request successful`, {
          status: response.status,
          hasData: !!data,
        });
        return data;
      } catch (error) {
        lastError = error;
        Logger.error(`API request attempt ${i + 1} failed`, error);

        if (i === retries - 1) break; // Don't retry on the last attempt

        const delay = Math.pow(2, i) * 3000; // Exponential backoff starting at 3 seconds
        Logger.log(`Retrying in ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError; // Throw the last error if all retries fail
  },
};

// --- Content Service (Combined functions for clarity and reduced redundancy) ---
const ContentService = {
  async getArticleContent(url, useCache = true) {
    Logger.log(`Getting article content for URL: ${url}`, { useCache });

    const cacheKey = `content_${url}`;
    if (useCache) {
      try {
        const cached = await CacheManager.get(cacheKey);
        if (cached && !CacheManager.isExpired(cached.timestamp)) {
          Logger.log('Returning cached content');
          return cached.data;
        }
      } catch (error) {
        Logger.error('Cache retrieval failed for article content', error);
      }
    }

    try {
      Logger.log(`Fetching fresh content from API`);
      const data = await ApiService.fetchWithRetry(API_ENDPOINTS.GET_CONTENT, {
        method: 'GET',
        params: { article_url: url }, // Assuming your content endpoint expects article_url as a GET param
      });

      if (!data || !data.clean_text) {
        throw new Error('Invalid content response from API');
      }

      await CacheManager.set(cacheKey, data);
      return data;
    } catch (error) {
      Logger.error('Failed to get article content', error);
      throw error;
    }
  },

  async getInsights(content, url, useCache = true) {
    const cacheKey = `insights_${url}`; // Cache based on URL, not just truncated content
    if (useCache) {
      try {
        const cached = await CacheManager.get(cacheKey);
        if (cached && !CacheManager.isExpired(cached.timestamp)) {
          Logger.log('Returning cached insights');
          return cached.data;
        }
      } catch (error) {
        Logger.error('Cache retrieval failed for insights', error);
      }
    }

    try {
      Logger.log('Requesting insights analysis');

      if (!content || !content.clean_text) {
        throw new Error('Invalid content provided for insights');
      }

      const insightsResponse = await ApiService.fetchWithRetry(
        API_ENDPOINTS.GET_INSIGHTS,
        {
          method: 'POST',
          body: JSON.stringify({
            content: content.clean_text,
            // Assuming your insights API can handle an optional 'url' or 'title' if needed
            url: url
          }),
        }
      );
      
      // Assuming insightsResponse has a 'result' property based on your API structure
      if (!insightsResponse || !insightsResponse.result) {
          throw new Error("Invalid insights response format from API");
      }

      await CacheManager.set(cacheKey, insightsResponse.result); // Cache only the result
      return insightsResponse.result; // Return the actual insight text
    } catch (error) {
      Logger.error('Failed to get insights', error);
      throw error;
    }
  },

  async getPivotArticles(content, url, useCache = true) { // Renamed from getTags for clarity
    const cacheKey = `pivot_${url}`; // Cache based on URL for pivot articles
    if (useCache) {
      try {
        const cached = await CacheManager.get(cacheKey);
        if (cached && !CacheManager.isExpired(cached.timestamp)) {
          Logger.log('Returning cached pivot articles');
          return cached.data;
        }
      } catch (error) {
        Logger.error('Cache retrieval failed for pivot articles', error);
      }
    }

    try {
      Logger.log('Requesting pivot articles');

      if (!content || !content.clean_text) {
        throw new Error('Invalid content provided for pivot articles');
      }

      const pivotResponse = await ApiService.fetchWithRetry(API_ENDPOINTS.GET_PIVOT, {
        method: 'POST',
        body: JSON.stringify({
          content: content.clean_text,
          url: url // Send the original URL for pivot, as requested
        }),
      });

      // Assuming pivotResponse has a 'result' property containing the articles array
      if (!pivotResponse || !pivotResponse.result) {
          throw new Error("Invalid pivot articles response format from API");
      }

      // Ensure the result is an array before caching/returning
      let articles = pivotResponse.result;
      if (typeof articles === 'string') {
        try {
          articles = JSON.parse(articles);
        } catch (e) {
          Logger.error('Failed to parse articles JSON from pivot API', e);
          articles = []; // Default to empty array on parse failure
        }
      }
      if (!Array.isArray(articles)) {
          Logger.warn('Pivot API did not return an array of articles, defaulting to empty array.');
          articles = [];
      }

      await CacheManager.set(cacheKey, articles);
      return articles;
    } catch (error) {
      Logger.error('Failed to get pivot articles', error);
      throw error;
    }
  },
};


// --- Chrome Runtime Communication Handlers ---

// Handle messages from the popup/content script (used for side panel interaction)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'AUTH_STATE_CHANGED') {
    Logger.log('Auth state changed from popup:', { isLoggedIn: request.isLoggedIn });
    // This part is for authentication management, which you mentioned removing.
    // However, if you're tracking login state at all, storing it is still relevant.
    // If auth is completely removed, this block can be deleted.
    chrome.storage.local.set({ isLoggedIn: request.isLoggedIn }, () => {
      if (chrome.runtime.lastError) {
        Logger.error('Error saving auth state:', chrome.runtime.lastError);
      } else {
        Logger.log('Auth state saved successfully');
      }
    });
    sendResponse({ success: true });
    return true; // Indicate asynchronous response
  }
  
  // Handlers for side panel actions
  if (["getSummary", "getInsights", "getOpposingViews"].includes(request.action)) {
    (async () => {
      try {
        Logger.log(`Processing ${request.action} for side panel: "${request.title}"`);

        if (sender.tab && sender.tab.id) {
          await chrome.sidePanel.open({ tabId: sender.tab.id });
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for panel to open
        }

        await chrome.runtime.sendMessage({
          action: 'showLoading',
          title: request.title || 'Processing...'
        });

        // Determine payload: for 'getOpposingViews', use sender.tab.url
        // For 'getInsights'/'getSummary', use request.content (which should be clean_text from content script)
        let processedContent;
        let finalResult;
        let displayAction;

        const articleUrl = sender.tab ? sender.tab.url : null; // Get current tab's URL

        // For Insights and Pivot, we first need the clean article content from the URL
        if (request.action === 'getInsights' || request.action === 'getOpposingViews') {
            if (!articleUrl) {
                throw new Error("Article URL not available for content extraction.");
            }
            processedContent = await ContentService.getArticleContent(articleUrl);
            Logger.log("Article content retrieved for API call.");
        } else {
            // For getSummary (if you add it back and use content directly from content script)
            processedContent = { clean_text: request.content };
        }

        if (request.action === 'getInsights') {
          finalResult = await ContentService.getInsights(processedContent, articleUrl);
          displayAction = 'displayResult'; // For insights, display as general result
        } else if (request.action === 'getOpposingViews') {
          finalResult = await ContentService.getPivotArticles(processedContent, articleUrl);
          displayAction = 'displayOpposingViews'; // Specific action for pivot articles
        } else if (request.action === 'getSummary') { // If you re-introduce getSummary
          // Assuming a similar API call to insights for summarization
          // finalResult = await ContentService.getSummary(processedContent, articleUrl);
          // displayAction = 'displayResult';
          throw new Error("Summarize action not implemented in this version.");
        }

        await chrome.runtime.sendMessage({
          action: displayAction,
          result: finalResult,
          title: request.title
        });
        Logger.log(`${request.action} completed successfully`);

      } catch (error) {
        Logger.error(`Process for ${request.action} failed:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        await chrome.runtime.sendMessage({
          action: 'displayResult',
          result: `❌ **Error occurred:**\n\n${errorMessage}`,
          title: 'Error'
        });
      }
    })();
    return true; // Indicate asynchronous response
  }
});


// Handle messages from content script via long-lived port (for insights/pivot tools)
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'timio-extension') {
    Logger.log('Rejected connection with unexpected port name:', port.name);
    return;
  }
  Logger.log('New connection established from content script');

  port.onMessage.addListener(async (message) => {
    Logger.log('Port received message', { action: message.action });

    // Use a specific timeout for insights only, as pivot can take longer
    let timeoutId = null;
    if (message.action === 'getInsights') {
      timeoutId = setTimeout(() => {
        Logger.error('Insights operation timed out');
        port.postMessage({ error: 'Analysis timed out. Please try again.' });
      }, 70000); // 70 seconds for insights
    }

    try {
      // Fetch article content first if needed
      let articleContent;
      if (message.url) {
          articleContent = await ContentService.getArticleContent(message.url);
          if (!articleContent || !articleContent.clean_text) {
              throw new Error("Could not extract clean text from article.");
          }
      } else if (message.content) {
          // If content script sent content directly (less robust without full URL processing)
          articleContent = { clean_text: message.content };
      } else {
          throw new Error("No URL or content provided for analysis.");
      }

      let result;
      if (message.action === 'getInsights') {
        result = await ContentService.getInsights(articleContent, message.url);
        port.postMessage({ insights: result });
      } else if (message.action === 'getPivotArticles') {
        result = await ContentService.getPivotArticles(articleContent, message.url);
        port.postMessage({ articles: result });
      } else {
        Logger.error(`Unknown action received via port: ${message.action}`);
        port.postMessage({ error: `Unknown action: ${message.action}` });
      }
    } catch (error) {
      Logger.error('Port message handler failed:', error);
      port.postMessage({ error: error.message || 'An unexpected error occurred' });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  });

  port.onDisconnect.addListener(() => {
    Logger.log('Port disconnected:', port.name);
  });
});

// --- Side Panel Action Button ---
// Opens the side panel when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) { // Ensure tab.id exists before trying to open side panel
    chrome.sidePanel.open({ tabId: tab.id }).catch((error) => {
      Logger.error("Failed to open side panel:", error);
      // Fallback for older Chrome versions or errors: open as popup
      chrome.windows.create({
        url: chrome.runtime.getURL('popup.html'), // Assuming popup.html is your popup file
        type: 'popup',
        width: 400,
        height: 600
      });
    });
  } else {
    Logger.error("chrome.action.onClicked: tab.id is undefined.");
    // Fallback: open as popup
    chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: 400,
      height: 600
    });
  }
});


// --- Authentication Management (Simplified to just storage, no external auth) ---
// Not using firebase auth as per discussion, just storage for isLoggedIn state.
const getAuthState = () => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['isLoggedIn'], function(result) { // Removed authToken, userId
      if (chrome.runtime.lastError) {
        Logger.error('Error accessing storage for auth state:', chrome.runtime.lastError);
        resolve({ isLoggedIn: false });
        return;
      }
      resolve({
        isLoggedIn: !!result.isLoggedIn,
      });
    });
  });
};

// Check auth state when extension starts (for logging/internal state)
chrome.runtime.onStartup.addListener(async function() {
  try {
    const authState = await getAuthState();
    Logger.log('Extension started, initial auth state:', authState);
  } catch (error) {
    Logger.error('Error checking auth state on startup:', error);
  }
});

// Listen for extension installation or update
chrome.runtime.onInstalled.addListener(function(details) {
  Logger.log('Extension installed or updated', { reason: details.reason });
  // Set default isLoggedIn state to false on install if not already set
  chrome.storage.local.get('isLoggedIn', (result) => {
      if (typeof result.isLoggedIn === 'undefined') {
          chrome.storage.local.set({ isLoggedIn: false });
          Logger.log('Default isLoggedIn state set to false on install.');
      }
  });
});


// --- Initialization Log ---
Logger.log('Background script initialized', {
  apiBaseUrl: API_BASE_URL,
  endpoints: API_ENDPOINTS,
});