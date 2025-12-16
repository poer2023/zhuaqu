/**
 * ZhaQu Extension - Background Service Worker
 * Handles communication between popup, content scripts, and backend
 */

// Store state
let state = {
    isConnected: false,
    apiBase: 'http://localhost:3000'
};

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'CHECK_CONNECTION':
            checkConnection().then(sendResponse);
            return true; // Keep channel open for async response

        case 'GET_STATE':
            sendResponse(state);
            break;

        case 'SET_API_BASE':
            state.apiBase = message.apiBase;
            chrome.storage.local.set({ apiBase: message.apiBase });
            sendResponse({ success: true });
            break;

        case 'INGEST_URLS':
            ingestUrls(message.data).then(sendResponse);
            return true;
    }
});

// Check connection to backend
async function checkConnection() {
    try {
        const res = await fetch(`${state.apiBase}/api/workspaces`);
        state.isConnected = res.ok;
        return { connected: res.ok };
    } catch (e) {
        state.isConnected = false;
        return { connected: false, error: e.message };
    }
}

// Ingest URLs to backend
async function ingestUrls(data) {
    try {
        const res = await fetch(`${state.apiBase}/api/ingest/jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            const job = await res.json();
            return { success: true, job };
        } else {
            const error = await res.json();
            return { success: false, error: error.message };
        }
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// Load saved settings on startup
chrome.storage.local.get(['apiBase'], (result) => {
    if (result.apiBase) {
        state.apiBase = result.apiBase;
    }
});

console.log('ZhaQu Background Service Worker loaded');
