console.log('Background page running');

// --- Configuration ---
const API_BASE_URL = 'https://serverfortimio.vercel.app'; 
const API_ENDPOINTS = {
  GET_CONTENT: `${API_BASE_URL}/api/content`,
  GET_INSIGHTS: `${API_BASE_URL}/api/insights`,
  GET_PIVOT: `${API_BASE_URL}/api/pivot`,
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

        if (i === retries - 1) break;

        const delay = Math.pow(2, i) * 3000;
        Logger.log(`Retrying in ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  },
};

// --- Content Service ---
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
        params: { article_url: url },
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
    const cacheKey = `insights_${url}`;
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
            url: url
          }),
        }
      );
      
      if (!insightsResponse || !insightsResponse.result) {
          throw new Error("Invalid insights response format from API");
      }

      await CacheManager.set(cacheKey, insightsResponse.result);
      return insightsResponse.result;
    } catch (error) {
      Logger.error('Failed to get insights', error);
      throw error;
    }
  },

  async getPivotArticles(content, url, useCache = true) {
    const cacheKey = `pivot_${url}`;
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
          url: url
        }),
      });

      if (!pivotResponse || !pivotResponse.result) {
          throw new Error("Invalid pivot articles response format from API");
      }

      let articles = pivotResponse.result;
      if (typeof articles === 'string') {
        try {
          articles = JSON.parse(articles);
        } catch (e) {
          Logger.error('Failed to parse articles JSON from pivot API', e);
          articles = [];
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

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  Logger.log('Received message:', { type: request.type, action: request.action });

  // Handle content script processing requests
  if (request.type === 'PROCESS_ARTICLE') {
    (async () => {
      try {
        Logger.log(`Processing ${request.action} from content script: "${request.title}"`);

        // Send loading state to content script
        if (request.useContentScript && sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: 'SHOW_LOADING',
            title: request.title || 'Processing...',
            animationType: request.animationType
          });
        }

        let processedContent;
        let finalResult;

        // Get article content from URL or use provided content
        if (request.url) {
          processedContent = await ContentService.getArticleContent(request.url);
          Logger.log("Article content retrieved for API call.");
        } else if (request.content) {
          processedContent = { clean_text: request.content };
        } else {
          throw new Error("No URL or content provided for analysis.");
        }

        // Process based on action
        if (request.action === 'getInsights') {
          finalResult = await ContentService.getInsights(processedContent, request.url);
        } else if (request.action === 'getPivotArticles') {
          finalResult = await ContentService.getPivotArticles(processedContent, request.url);
        } else {
          throw new Error(`Unknown action: ${request.action}`);
        }

        // Send results back to content script
        if (request.useContentScript && sender.tab?.id) {
          const responseMessage = {
            type: 'SHOW_RESULTS'
          };

          if (request.action === 'getInsights') {
            responseMessage.insights = finalResult;
          } else if (request.action === 'getPivotArticles') {
            responseMessage.articles = finalResult;
          }

          chrome.tabs.sendMessage(sender.tab.id, responseMessage);
          Logger.log(`${request.action} completed successfully and sent to content script`);
        }

        sendResponse({ success: true, result: finalResult });

      } catch (error) {
        Logger.error(`Process for ${request.action} failed:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        
        // Send error to content script
        if (request.useContentScript && sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: 'SHOW_RESULTS',
            error: errorMessage
          });
        }

        sendResponse({ success: false, error: errorMessage });
      }
    })();
    return true; // Indicate asynchronous response
  }

  // Handle tab reload requests
  if (request.action === 'reloadActiveTab') {
    if (sender.tab?.id) {
      chrome.tabs.reload(sender.tab.id);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No active tab found' });
    }
    return true;
  }

  // Handle error logging
  if (request.type === 'ERROR_LOG') {
    Logger.error('Error from content script:', request.errorInfo);
    sendResponse({ success: true });
    return true;
  }

  // Handle auth state changes (if still needed)
  if (request.type === 'AUTH_STATE_CHANGED') {
    Logger.log('Auth state changed:', { isLoggedIn: request.isLoggedIn });
    chrome.storage.local.set({ isLoggedIn: request.isLoggedIn }, () => {
      if (chrome.runtime.lastError) {
        Logger.error('Error saving auth state:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        Logger.log('Auth state saved successfully');
        sendResponse({ success: true });
      }
    });
    return true;
  }

  // Handle floating menu visibility toggle
  if (request.type === 'TOGGLE_FLOATING_MENU') {
    if (sender.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'TOGGLE_FLOATING_MENU',
        isVisible: request.isVisible
      });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No active tab found' });
    }
    return true;
  }

  // Legacy side panel actions (if you still have popup/sidepanel)
  if (["getSummary", "getInsights", "getOpposingViews"].includes(request.action)) {
    (async () => {
      try {
        Logger.log(`Processing ${request.action} for legacy interface: "${request.title}"`);

        // Try to open side panel if available
        if (sender.tab && sender.tab.id) {
          try {
            await chrome.sidePanel.open({ tabId: sender.tab.id });
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            Logger.log('Side panel not available, continuing without it');
          }
        }

        let processedContent;
        let finalResult;
        const articleUrl = sender.tab ? sender.tab.url : null;

        if (request.action === 'getInsights' || request.action === 'getOpposingViews') {
            if (!articleUrl) {
                throw new Error("Article URL not available for content extraction.");
            }
            processedContent = await ContentService.getArticleContent(articleUrl);
            Logger.log("Article content retrieved for API call.");
        } else {
            processedContent = { clean_text: request.content };
        }

        if (request.action === 'getInsights') {
          finalResult = await ContentService.getInsights(processedContent, articleUrl);
        } else if (request.action === 'getOpposingViews') {
          finalResult = await ContentService.getPivotArticles(processedContent, articleUrl);
        }

        // Try to send to side panel if available
        try {
          await chrome.runtime.sendMessage({
            action: request.action === 'getOpposingViews' ? 'displayOpposingViews' : 'displayResult',
            result: finalResult,
            title: request.title
          });
        } catch (error) {
          Logger.log('Could not send to side panel, side panel may not be active');
        }

        Logger.log(`${request.action} completed successfully`);
        sendResponse({ success: true, result: finalResult });

      } catch (error) {
        Logger.error(`Process for ${request.action} failed:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        
        try {
          await chrome.runtime.sendMessage({
            action: 'displayResult',
            result: `❌ **Error occurred:**\n\n${errorMessage}`,
            title: 'Error'
          });
        } catch (e) {
          Logger.log('Could not send error to side panel');
        }

        sendResponse({ success: false, error: errorMessage });
      }
    })();
    return true;
  }

  sendResponse({ success: false, error: 'Unknown message type' });
});

// Handle long-lived port connections (legacy support)
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'timio-extension') {
    Logger.log('Rejected connection with unexpected port name:', port.name);
    return;
  }
  Logger.log('New connection established from content script');

  port.onMessage.addListener(async (message) => {
    Logger.log('Port received message', { action: message.action });

    let timeoutId = null;
    if (message.action === 'getInsights') {
      timeoutId = setTimeout(() => {
        Logger.error('Insights operation timed out');
        port.postMessage({ error: 'Analysis timed out. Please try again.' });
      }, 70000);
    }

    try {
      let articleContent;
      if (message.url) {
          articleContent = await ContentService.getArticleContent(message.url);
          if (!articleContent || !articleContent.clean_text) {
              throw new Error("Could not extract clean text from article.");
          }
      } else if (message.content) {
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

// --- Action Button Handler ---
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    // Try to open side panel, fallback to popup
    chrome.sidePanel.open({ tabId: tab.id }).catch((error) => {
      Logger.error("Failed to open side panel:", error);
      // Fallback: open as popup window
      chrome.windows.create({
        url: chrome.runtime.getURL('popup.html'),
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

// --- Authentication Management ---
const getAuthState = () => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['isLoggedIn'], function(result) {
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

// Extension lifecycle handlers
chrome.runtime.onStartup.addListener(async function() {
  try {
    const authState = await getAuthState();
    Logger.log('Extension started, initial auth state:', authState);
  } catch (error) {
    Logger.error('Error checking auth state on startup:', error);
  }
});

chrome.runtime.onInstalled.addListener(function(details) {
  Logger.log('Extension installed or updated', { reason: details.reason });
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