// background.simplified.js
// --- Simplified Background Script for TimioNews Extension ---

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

    warn(message, data = null) {
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
        console.warn('TIMIO Extension WARNING:', logMessage);
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

// --- Configuration ---
const API_BASE_URL = 'https://serverfortimio.vercel.app';
const API_ENDPOINTS = {
    GET_CONTENT: `${API_BASE_URL}/api/content`,
    GET_INSIGHTS: `${API_BASE_URL}/api/insights`,
    GET_PIVOT: `${API_BASE_URL}/api/pivot`, // Endpoint for opposing views/pivot articles
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

// --- Helper to send message to Side Panel with error handling ---
async function sendToSidePanel(message, targetTabId = null) {
    try {
        let tabIdToTarget = targetTabId;

        // If targetTabId is not provided, try to find the active tab as a fallback.
        if (!tabIdToTarget) {
            try {
                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (activeTab && activeTab.id) {
                    tabIdToTarget = activeTab.id;
                }
            } catch (tabError) {
                Logger.error('Failed to get active tab:', tabError);
                return;
            }
        }

        if (!tabIdToTarget) {
            Logger.warn('Background: No valid tab ID to send message to side panel. Message dropped.', message);
            return;
        }

        // Send the message to the side panel's context for the given tabId.
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                Logger.warn('Background: Error sending message to Side Panel (likely recipient closed/not ready for tab ' + tabIdToTarget + '):', chrome.runtime.lastError.message);
            } else {
                Logger.log('Background: Side Panel (tab ' + tabIdToTarget + ') acknowledged message:', response);
            }
        });
    } catch (error) {
        Logger.error('Background: Unexpected error in sendToSidePanel helper:', error);
    }
}

// --- Helper to send message to Content Script with error handling ---
async function sendToContentScript(message, targetTabId) {
    try {
        if (!targetTabId) {
            Logger.warn('Background: No valid tab ID to send message to content script. Message dropped.', message);
            return;
        }

        chrome.tabs.sendMessage(targetTabId, message, (response) => {
            if (chrome.runtime.lastError) {
                Logger.warn(`Background: Error sending message to content script (tab ${targetTabId}):`, chrome.runtime.lastError.message);
            } else {
                Logger.log(`Background: Content script (tab ${targetTabId}) acknowledged message:`, response);
            }
        });
    } catch (error) {
        Logger.error('Background: Unexpected error in sendToContentScript helper:', error);
    }
}

// --- Chrome Runtime Communication Handlers ---

// Handle messages from the popup/content script (e.g., from floating menu)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    Logger.log('Received message:', { type: request.type, action: request.action, useContentScript: request.useContentScript });

    // Handle authentication state changes from popup (if authentication is still desired)
    if (request.type === 'AUTH_STATE_CHANGED') {
        Logger.log('Auth state changed from popup:', { isLoggedIn: request.isLoggedIn });
        chrome.storage.local.set({ isLoggedIn: request.isLoggedIn }, () => {
            if (chrome.runtime.lastError) {
                Logger.error('Error saving auth state:', chrome.runtime.lastError);
            } else {
                Logger.log('Auth state saved successfully');
            }
        });
        sendResponse({ success: true });
        return true;
    }

    // Handle the main 'PROCESS_ARTICLE' request from content script (floating menu)
    if (request.type === 'PROCESS_ARTICLE') {
        const currentTabId = sender.tab?.id;
        if (!currentTabId) {
            Logger.error("PROCESS_ARTICLE: Sender tab ID is missing.");
            sendResponse({ status: 'error', message: 'Missing tab ID' });
            return;
        }

        // Determine if we should use content script UI or traditional side panel
        const useContentScript = request.useContentScript;

        // 🔥 FIXED: Open side panel synchronously if user gesture is present and not using content script
        if (request.userGesture && !useContentScript) {
            try {
                // Enable and open side panel immediately in the same call stack
                chrome.sidePanel.setOptions({
                    tabId: currentTabId,
                    enabled: true,
                    path: 'sidepanel.html'
                });
                
                chrome.sidePanel.open({ tabId: currentTabId });
                Logger.log(`Side panel opened for tab ${currentTabId} from user gesture`);
            } catch (sidePanelError) {
                Logger.warn(`Could not open side panel for tab ${currentTabId}:`, sidePanelError.message);
                // Continue anyway - panel might already be open
            }
        }

        // Process article asynchronously
        (async () => {
            try {
                Logger.log(`Processing PROCESS_ARTICLE request: "${request.title}" (useContentScript: ${useContentScript})`);

                const articleUrl = request.url;
                const extractedArticleContent = request.content;

                if (!articleUrl || articleUrl.trim().length === 0) {
                    throw new Error("Article URL not available from content script.");
                }
                if (!extractedArticleContent || extractedArticleContent.trim().length === 0) {
                    throw new Error("No article content provided by content script for analysis.");
                }

                // Small delay to ensure UI is ready
                await new Promise(resolve => setTimeout(resolve, 200));

                // Send loading state to appropriate UI
                const loadingMessage = {
                    type: 'SHOW_LOADING',
                    title: request.title || 'Processing...',
                    animationType: request.animationType
                };

                if (useContentScript) {
                    await sendToContentScript(loadingMessage, currentTabId);
                } else {
                    await sendToSidePanel(loadingMessage, currentTabId);
                }

                let finalResult;
                let responseType;

                if (request.action === 'getInsights') {
                    finalResult = await ContentService.getInsights(
                        { clean_text: extractedArticleContent },
                        articleUrl
                    );
                    responseType = 'insights';
                } else if (request.action === 'getPivotArticles') {
                    finalResult = await ContentService.getPivotArticles(
                        { clean_text: extractedArticleContent },
                        articleUrl
                    );
                    responseType = 'articles';
                } else {
                    throw new Error(`Unknown action received: ${request.action}`);
                }

                // Send results back to appropriate UI
                const resultsMessage = {
                    type: 'SHOW_RESULTS',
                    [responseType]: finalResult
                };

                if (useContentScript) {
                    await sendToContentScript(resultsMessage, currentTabId);
                } else {
                    await sendToSidePanel(resultsMessage, currentTabId);
                }

                Logger.log(`${request.action} completed successfully (sent to ${useContentScript ? 'content script' : 'side panel'})`);

            } catch (error) {
                Logger.error(`PROCESS_ARTICLE failed for ${request.action}:`, error);
                const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
                
                const errorMsg = {
                    type: 'SHOW_RESULTS',
                    error: `Failed to get data: ${errorMessage}`
                };

                if (useContentScript) {
                    await sendToContentScript(errorMsg, currentTabId);
                } else {
                    await sendToSidePanel(errorMsg, currentTabId);
                }
            }
        })();

        // Respond immediately to preserve user gesture context
        sendResponse({ status: 'processing' });
        return true;
    }

    // Handle request to open side panel from popup
    if (request.type === 'OPEN_SIDE_PANEL') {
        (async () => {
            try {
                const currentTabId = sender.tab?.id;
                if (!currentTabId) {
                    // Get active tab if sender tab is not available
                    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (activeTab && activeTab.id) {
                        await chrome.sidePanel.setOptions({
                            tabId: activeTab.id,
                            enabled: true,
                            path: 'sidepanel.html'
                        });
                        await chrome.sidePanel.open({ tabId: activeTab.id });
                        Logger.log(`Side panel opened for active tab ${activeTab.id} from popup`);
                        sendResponse({ status: 'opened' });
                    } else {
                        sendResponse({ status: 'error', message: 'No active tab found' });
                    }
                } else {
                    await chrome.sidePanel.setOptions({
                        tabId: currentTabId,
                        enabled: true,
                        path: 'sidepanel.html'
                    });
                    await chrome.sidePanel.open({ tabId: currentTabId });
                    Logger.log(`Side panel opened for tab ${currentTabId} from popup`);
                    sendResponse({ status: 'opened' });
                }
            } catch (error) {
                Logger.error('Failed to open side panel from popup:', error);
                sendResponse({ status: 'error', message: error.message });
            }
        })();
        return true;
    }

    // Handle error logs from content script
    if (request.type === 'ERROR_LOG') {
        Logger.error('Content script error:', request.errorInfo);
        sendResponse({ status: 'logged' });
        return true;
    }
    
    // Handle specific request to reload active tab (from side panel error UI)
    if (request.action === 'reloadActiveTab') {
        (async () => {
            if (sender.tab && sender.tab.id) {
                try {
                    await chrome.tabs.reload(sender.tab.id);
                    Logger.log(`Tab ${sender.tab.id} reloaded successfully.`);
                } catch (error) {
                    Logger.error(`Error reloading tab ${sender.tab.id}:`, error);
                }
            } else {
                Logger.warn('Cannot reload tab: Sender tab ID is missing.');
            }
            sendResponse({ status: 'reloaded' });
        })();
        return true;
    }

    // Handle floating menu visibility toggle
    if (request.type === 'TOGGLE_FLOATING_MENU') {
        if (sender.tab?.id) {
            sendToContentScript({
                type: 'TOGGLE_FLOATING_MENU',
                isVisible: request.isVisible
            }, sender.tab.id);
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'No active tab found' });
        }
        return true;
    }

    // Default response for unknown message types
    sendResponse({ success: false, error: 'Unknown message type' });
});

// --- Port-based Communication (from content script - legacy support) ---
chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'timio-extension') {
        Logger.log('Rejected connection with unexpected port name:', port.name);
        return;
    }
    Logger.log('New port connection established from content script');

    port.onMessage.addListener(async (message) => {
        Logger.log('Port received message', { action: message.action, url: message.url, contentPreview: message.content?.substring(0, 50) + '...' });

        let timeoutId = null;
        if (message.action === 'getInsights') {
            timeoutId = setTimeout(() => {
                Logger.error('Insights operation timed out (via port)');
                port.postMessage({ error: 'Analysis timed out. Please try again.' });
            }, 70000);
        }

        try {
            const articleContent = { clean_text: message.content };
            const articleUrl = message.url;

            if (!articleContent.clean_text || articleContent.clean_text.trim().length === 0) {
                throw new Error("No article content provided from content script for analysis (via port).");
            }
            if (!articleUrl || articleUrl.trim().length === 0) {
                throw new Error("No article URL provided from content script (via port).");
            }

            let result;
            if (message.action === 'getInsights') {
                result = await ContentService.getInsights(articleContent, articleUrl);
                port.postMessage({ insights: result });
            } else if (message.action === 'getPivotArticles') {
                result = await ContentService.getPivotArticles(articleContent, articleUrl);
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
    chrome.storage.local.get('isLoggedIn', (result) => {
        if (typeof result.isLoggedIn === 'undefined') {
            chrome.storage.local.set({ isLoggedIn: false });
            Logger.log('Default isLoggedIn state set to false on install.');
        }
    });
    // Ensure side panel is enabled by default on install
    chrome.sidePanel.setOptions({ enabled: true }).catch(e => {
        Logger.error("Error setting side panel enabled on install:", e);
    });
});

// Enable/disable side panel for valid/excluded pages on tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        try {
            const url = new URL(tab.url);
            const excludedSitesHostnameParts = [
                'youtube.com', 'netflix.com', 'facebook.com', 'twitter.com',
                'instagram.com', 'reddit.com', 'linkedin.com', 'amazon.com',
                'gmail.com', 'outlook.com', 'drive.google.com', 'office.com',
                'github.com', 'stackoverflow.com', 'meet.google.com', 'zoom.us',
                'wikipedia.org'
            ];
            const isExcludedProtocol = ['chrome:', 'about:', 'file:', 'edge:', 'moz-extension:', 'chrome-extension:'].some(protocol => url.protocol.startsWith(protocol));
            const isExcludedDomain = excludedSitesHostnameParts.some(excluded => url.hostname.includes(excluded));
            
            const shouldEnableSidePanel = !isExcludedProtocol && !isExcludedDomain;

            try {
                await chrome.sidePanel.setOptions({
                    tabId: tabId,
                    enabled: shouldEnableSidePanel,
                    path: shouldEnableSidePanel ? 'sidepanel.html' : undefined
                });
                Logger.log(`Side panel ${shouldEnableSidePanel ? 'enabled' : 'disabled'} for tab ${tabId} (${url.hostname})`);
            } catch (error) {
                Logger.warn(`Error setting side panel options for tab ${tabId}:`, error.message);
            }
        } catch (urlError) {
            Logger.warn(`Error parsing URL for tab ${tabId}:`, urlError.message);
        }
    }
});

// --- Initialization Log ---
Logger.log('Background script initialized', {
    apiBaseUrl: API_BASE_URL,
    endpoints: API_ENDPOINTS,
    currentTime: new Date().toISOString()
});