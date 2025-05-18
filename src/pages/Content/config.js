// config.js

// Function to set API key in Chrome storage
async function setApiKey() {
    const apiKey = 'DtJq96UYWK4iUJmqkmgjX047UZD0YPxjfIGNhCSCZ7Y'; // This will be replaced in production
    
    try {
        await chrome.storage.local.set({ 'apiKey': apiKey });
        console.log('API key stored successfully');
    } catch (error) {
        console.error('Error storing API key:', error);
    }
}

// Initialize API key when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
    setApiKey();
});