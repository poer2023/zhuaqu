/**
 * ZhaQu Extension - Popup Script
 */

document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Check connection
    checkConnection();

    // Load saved API base
    chrome.storage.local.get(['apiBase'], (result) => {
        if (result.apiBase) {
            document.getElementById('api-base').value = result.apiBase;
        }
    });

    // Event listeners
    document.getElementById('toggle-mode-btn').addEventListener('click', toggleSelectionMode);
    document.getElementById('save-url-btn').addEventListener('click', saveApiBase);
}

async function checkConnection() {
    const statusIndicator = document.getElementById('status-indicator');
    const connectionStatus = document.getElementById('connection-status');

    try {
        const response = await chrome.runtime.sendMessage({ type: 'CHECK_CONNECTION' });

        if (response.connected) {
            statusIndicator.classList.add('connected');
            statusIndicator.classList.remove('disconnected');
            connectionStatus.classList.add('connected');
            connectionStatus.classList.remove('disconnected');
            connectionStatus.querySelector('.text').textContent = 'Connected to ZhaQu';
        } else {
            throw new Error('Not connected');
        }
    } catch (_e) {
        statusIndicator.classList.add('disconnected');
        statusIndicator.classList.remove('connected');
        connectionStatus.classList.add('disconnected');
        connectionStatus.classList.remove('connected');
        connectionStatus.querySelector('.text').textContent = 'Not connected';
    }
}

async function toggleSelectionMode() {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('x.com') && !tab.url.includes('twitter.com')) {
        alert('Please navigate to X/Twitter first');
        return;
    }

    // Send message to content script
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SELECTION_MODE' });

    // Close popup
    window.close();
}

async function saveApiBase() {
    const apiBase = document.getElementById('api-base').value.trim();

    if (!apiBase) {
        alert('Please enter a valid URL');
        return;
    }

    await chrome.runtime.sendMessage({ type: 'SET_API_BASE', apiBase });

    // Re-check connection
    checkConnection();
}
