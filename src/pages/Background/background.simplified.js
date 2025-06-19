// background.simplified.js
// --- Simplified Background Script for TimioNews Extension ---
// This script integrates the Logger utility, uses prototype-style message handling and API calls,
// and removes authentication, retry logic, and unused complexity. It is designed for clarity and maintainability.

// --- Logger Utility (copied from TimioNews) ---
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

// --- API Call Logic (prototype style, no retry logic) ---
const SERVER_URL = 'https://deployment-timio-nd4v.vercel.app';

/**
 * Calls the server API for summarization, insights, or opposing views.
 * @param {string} payload - The data to send (URL or article content).
 * @param {string} action - The action to determine the endpoint.
 * @param {string} title - The title of the article (optional).
 * @returns {Promise<any>} - Resolves to the API response.
 */
async function callServerAPI(payload, action, title = '') {
    let endpoint;
    if (action === 'getSummary' || action === 'getInsights') {
        endpoint = action === 'getSummary' ? '/api/summarize' : '/api/insights';
    } else if (action === 'getOpposingViews') {
        endpoint = '/api/pivot';
    } else {
        throw new Error(`Invalid action: ${action}`);
    }

    const url = `${SERVER_URL}${endpoint}`;
    const requestBody = { content: payload };
    if (title) requestBody.title = title;
    Logger.log(`Calling ${action} at ${url}`);
    Logger.log('Payload being sent to API:', requestBody);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            Logger.error('API Error Response:', errorBody);
            throw new Error(`API request failed with status ${response.status}`);
        }

        const responseData = await response.json();
        if (!responseData.success) {
            throw new Error(responseData.error || 'Unknown API error');
        }
        return responseData.result;
    } catch (error) {
        Logger.error(`${action} failed:`, error);
        throw error;
    }
}

// --- Message Handling (prototype style, no ports) ---
// Listens for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Only handle supported actions
    if (["getSummary", "getInsights", "getOpposingViews"].includes(request.action)) {
        (async () => {
            try {
                Logger.log(`Processing ${request.action} for: "${request.title}"`);

                // Open the side panel for the current tab
                await chrome.sidePanel.open({ tabId: sender.tab.id });
                // Optionally, add a small delay to ensure the panel is ready
                await new Promise(resolve => setTimeout(resolve, 100));

                // Notify the side panel to show a loading state
                await chrome.runtime.sendMessage({
                    action: 'showLoading',
                    title: request.title || 'Processing...'
                });

                // For opposing views, use the tab's URL; otherwise, use article content
                const payload = request.action === 'getOpposingViews' ? sender.tab.url : request.content;
                const result = await callServerAPI(payload, request.action, request.title);

                // Determine which display action to use
                const displayAction = request.action === 'getOpposingViews' ? 'displayOpposingViews' : 'displayResult';

                // Send the result to the side panel
                await chrome.runtime.sendMessage({
                    action: displayAction,
                    result: result,
                    title: request.title
                });

                Logger.log(`${request.action} completed successfully`);
            } catch (error) {
                Logger.error('Process failed:', error);
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

// --- Side Panel Action Button ---
// Opens the side panel when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
});

// --- Initialization Log ---
Logger.log('Simplified background script initialized.');

// --- Port-based Communication for Content Script ---
chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'timio-extension') {
        Logger.log('Rejected connection with unexpected port name:', port.name);
        return;
    }
    Logger.log('New port connection established:', port.name);

    port.onMessage.addListener(async (message) => {
        Logger.log('Port received message', { action: message.action });
        try {
            if (["getInsights", "getPivotArticles"].includes(message.action)) {
                // For getPivotArticles, treat as getOpposingViews for API
                const apiAction = message.action === 'getPivotArticles' ? 'getOpposingViews' : message.action;
                const payload = apiAction === 'getOpposingViews' ? message.url : message.content;
                const title = message.title || '';

                // Only set a timeout for getInsights (not for getPivotArticles)
                let timeoutId = null;
                if (message.action === 'getInsights') {
                    timeoutId = setTimeout(() => {
                        Logger.error('Operation timed out');
                        port.postMessage({ error: 'Operation timed out. Please try again.' });
                    }, 25000); // 25 seconds
                }

                const result = await callServerAPI(payload, apiAction, title);
                if (timeoutId) clearTimeout(timeoutId);

                if (message.action === 'getPivotArticles') {
                    let articles = result;
                    if (typeof articles === 'string') {
                        try {
                            articles = JSON.parse(articles);
                        } catch (e) {
                            Logger.error('Failed to parse articles JSON', e);
                            articles = [];
                        }
                    }
                    port.postMessage({ articles });
                } else {
                    port.postMessage({ insights: result });
                }
            } else {
                port.postMessage({ error: `Unknown action: ${message.action}` });
            }
        } catch (error) {
            Logger.error('Port message handler failed:', error);
            port.postMessage({ error: error.message || 'An error occurred' });
        }
    });

    port.onDisconnect.addListener(() => {
        Logger.log('Port disconnected:', port.name);
    });
}); 