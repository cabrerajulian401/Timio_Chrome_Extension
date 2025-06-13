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
const SERVER_URL = 'http://localhost:3000'; // Change to your server as needed

/**
 * Calls the server API for summarization, insights, or opposing views.
 * @param {string} payload - The data to send (URL or article content).
 * @param {string} action - The action to determine the endpoint.
 * @returns {Promise<any>} - Resolves to the API response.
 */
async function callServerAPI(payload, action) {
    let endpoint;
    if (action === 'getSummary' || action === 'getInsights') {
        endpoint = action === 'getSummary' ? '/api/summarize' : '/api/insights';
    } else if (action === 'getOpposingViews') {
        endpoint = '/api/pivot';
    } else {
        throw new Error(`Invalid action: ${action}`);
    }

    const url = `${SERVER_URL}${endpoint}`;
    Logger.log(`Calling ${action} at ${url}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: payload }),
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
                const result = await callServerAPI(payload, request.action);

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