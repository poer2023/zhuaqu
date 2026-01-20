/**
 * ZhaQu Extension - Content Script
 * Injects selection mode UI into X/Twitter timeline
 * v1.1 Enhanced: Quick ingest, tags, status indicators, Likes/Bookmarks detection
 */

(function () {
    'use strict';

    // Configuration - loaded from storage
    let API_BASE = 'http://localhost:3000'; // Default, will be overridden
    const TWEET_SELECTOR = 'article[data-testid="tweet"]';

    // State
    let isSelectionMode = false;
    let selectedTweets = new Map(); // tweetId -> tweetData
    let ingestedTweets = new Set(); // Track already ingested tweets
    let settings = {
        workspaceId: null,
        poolId: null,
        tags: []
    };
    let availableTags = [];
    let isOnLikesPage = false;
    let isOnBookmarksPage = false;

    // Load API base from storage
    async function loadApiBase() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['apiBase'], (result) => {
                if (result.apiBase) {
                    API_BASE = result.apiBase;
                    console.log('ZhaQu: Using API base:', API_BASE);
                }
                resolve();
            });
        });
    }

    // Icons
    const ICONS = {
        check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        inbox: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>`,
        plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
        tag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>`,
        heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
        bookmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`
    };

    // Detect page type
    function detectPageType() {
        const url = window.location.href;
        isOnLikesPage = url.includes('/likes');
        isOnBookmarksPage = url.includes('/bookmarks') || url.includes('/i/bookmarks');
        return { isOnLikesPage, isOnBookmarksPage };
    }

    // Create toggle button
    function createToggleButton() {
        const btn = document.createElement('button');
        btn.className = 'zhaqu-toggle';
        btn.innerHTML = `
            <svg class="zhaqu-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="15"></line>
                <line x1="15" y1="9" x2="9" y2="15"></line>
            </svg>
            <span>ZhaQu</span>
        `;
        btn.addEventListener('click', toggleSelectionMode);
        document.body.appendChild(btn);
        return btn;
    }

    // Create floating action bar with enhanced features
    function createActionBar() {
        detectPageType();

        const bar = document.createElement('div');
        bar.className = 'zhaqu-action-bar';
        bar.innerHTML = `
            <div class="zhaqu-action-bar-count">0 selected</div>
            <select class="zhaqu-action-bar-select" id="zhaqu-pool-select">
                <option value="">Select Pool...</option>
            </select>
            <div class="zhaqu-tag-selector" id="zhaqu-tag-selector">
                <button class="zhaqu-tag-btn" id="zhaqu-tag-btn">
                    ${ICONS.tag}
                    <span id="zhaqu-tag-count">0</span>
                </button>
                <div class="zhaqu-tag-dropdown" id="zhaqu-tag-dropdown"></div>
            </div>
            <button class="zhaqu-action-bar-btn" id="zhaqu-submit-btn" disabled>
                ${ICONS.inbox} Import
            </button>
            <button class="zhaqu-action-bar-clear" id="zhaqu-clear-btn">
                ${ICONS.close}
            </button>
        `;

        bar.querySelector('#zhaqu-submit-btn').addEventListener('click', submitSelected);
        bar.querySelector('#zhaqu-clear-btn').addEventListener('click', clearSelection);
        bar.querySelector('#zhaqu-tag-btn').addEventListener('click', toggleTagDropdown);

        document.body.appendChild(bar);

        // Add sync bar for Likes/Bookmarks pages
        if (isOnLikesPage || isOnBookmarksPage) {
            createSyncBar();
        }

        return bar;
    }

    // Create sync bar for bulk import from Likes/Bookmarks
    function createSyncBar() {
        const syncBar = document.createElement('div');
        syncBar.className = 'zhaqu-sync-bar';
        const pageType = isOnLikesPage ? 'Likes' : 'Bookmarks';
        syncBar.innerHTML = `
            <div class="zhaqu-sync-icon">
                ${isOnLikesPage ? ICONS.heart : ICONS.bookmark}
            </div>
            <div class="zhaqu-sync-info">
                <span class="zhaqu-sync-title">Sync ${pageType}</span>
                <span class="zhaqu-sync-desc">Batch import visible tweets</span>
            </div>
            <button class="zhaqu-sync-btn" id="zhaqu-sync-visible">
                Sync Visible
            </button>
            <button class="zhaqu-sync-btn zhaqu-sync-btn-primary" id="zhaqu-sync-all">
                Create Sync Job
            </button>
        `;

        syncBar.querySelector('#zhaqu-sync-visible').addEventListener('click', () => syncVisibleTweets());
        syncBar.querySelector('#zhaqu-sync-all').addEventListener('click', () => createSyncJob());

        document.body.appendChild(syncBar);
    }

    // Toggle tag dropdown
    function toggleTagDropdown() {
        const dropdown = document.getElementById('zhaqu-tag-dropdown');
        dropdown.classList.toggle('visible');
    }

    // Toggle selection mode
    function toggleSelectionMode() {
        isSelectionMode = !isSelectionMode;
        document.body.classList.toggle('zhaqu-selection-mode', isSelectionMode);

        const toggle = document.querySelector('.zhaqu-toggle');
        toggle.classList.toggle('active', isSelectionMode);
        toggle.querySelector('span').textContent = isSelectionMode ? 'Exit Mode' : 'ZhaQu';

        if (isSelectionMode) {
            injectCheckboxes();
            injectQuickButtons();
            loadPools();
            loadTags();
            detectPageType();
        } else {
            removeCheckboxes();
            clearSelection();
        }

        updateActionBar();
    }

    // Inject quick ingest buttons on each tweet
    function injectQuickButtons() {
        const tweets = document.querySelectorAll(TWEET_SELECTOR);
        tweets.forEach(tweet => {
            if (!tweet.querySelector('.zhaqu-quick-btn')) {
                const tweetData = extractTweetData(tweet);
                if (!tweetData) return;

                const btn = document.createElement('button');
                btn.className = 'zhaqu-quick-btn';

                if (ingestedTweets.has(tweetData.id)) {
                    btn.classList.add('ingested');
                    btn.innerHTML = `${ICONS.check} Saved`;
                    btn.disabled = true;
                } else {
                    btn.innerHTML = `${ICONS.plus} Save`;
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        await quickIngest(tweet, btn);
                    });
                }

                tweet.appendChild(btn);
            }
        });
    }

    // Quick ingest single tweet
    async function quickIngest(tweetEl, btn) {
        const tweetData = extractTweetData(tweetEl);
        if (!tweetData || !settings.poolId) {
            showStatus('Please select a pool first', 'error');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = `<span class="zhaqu-spinner"></span> Saving...`;

        try {
            const res = await fetch(`${API_BASE}/api/ingest/jobs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId: settings.workspaceId,
                    poolId: settings.poolId,
                    urls: [tweetData.url],
                    tags: settings.tags,
                    options: { threadMode: 'single', mediaMode: 'link' }
                })
            });

            if (res.ok) {
                ingestedTweets.add(tweetData.id);
                btn.classList.add('ingested');
                btn.innerHTML = `${ICONS.check} Saved`;
                showStatus('Tweet saved!', 'success');
            } else {
                throw new Error('Failed');
            }
        } catch (_e) {
            btn.disabled = false;
            btn.innerHTML = `${ICONS.plus} Save`;
            showStatus('Failed to save', 'error');
        }
    }

    // Inject checkboxes into tweets
    function injectCheckboxes() {
        const tweets = document.querySelectorAll(TWEET_SELECTOR);
        tweets.forEach(tweet => {
            if (!tweet.querySelector('.zhaqu-checkbox-wrapper')) {
                const tweetData = extractTweetData(tweet);

                const wrapper = document.createElement('div');
                wrapper.className = 'zhaqu-checkbox-wrapper';

                const isIngested = tweetData && ingestedTweets.has(tweetData.id);

                wrapper.innerHTML = `
                    <div class="zhaqu-checkbox ${isIngested ? 'ingested' : ''}">
                        ${isIngested ? ICONS.check : ICONS.check}
                    </div>
                `;

                if (!isIngested) {
                    wrapper.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        toggleTweetSelection(tweet);
                    });
                }

                tweet.prepend(wrapper);
            }
        });
    }

    // Remove checkboxes
    function removeCheckboxes() {
        document.querySelectorAll('.zhaqu-checkbox-wrapper').forEach(el => el.remove());
        document.querySelectorAll('.zhaqu-quick-btn').forEach(el => el.remove());
    }

    // Toggle tweet selection
    function toggleTweetSelection(tweetEl) {
        const tweetData = extractTweetData(tweetEl);
        if (!tweetData) return;

        const checkbox = tweetEl.querySelector('.zhaqu-checkbox');

        if (selectedTweets.has(tweetData.id)) {
            selectedTweets.delete(tweetData.id);
            checkbox.classList.remove('checked');
            tweetEl.classList.remove('zhaqu-selected');
        } else {
            selectedTweets.set(tweetData.id, tweetData);
            checkbox.classList.add('checked');
            tweetEl.classList.add('zhaqu-selected');
        }

        updateActionBar();
    }

    // Extract tweet data from DOM
    function extractTweetData(tweetEl) {
        try {
            const link = tweetEl.querySelector('a[href*="/status/"]');
            if (!link) return null;

            const href = link.getAttribute('href');
            const match = href.match(/\/status\/(\d+)/);
            if (!match) return null;

            const tweetId = match[1];
            const handleEl = tweetEl.querySelector('div[data-testid="User-Name"] a[href^="/"]');
            const handle = handleEl ? handleEl.getAttribute('href').slice(1) : 'unknown';
            const textEl = tweetEl.querySelector('div[data-testid="tweetText"]');
            const text = textEl ? textEl.textContent : '';
            const url = `https://x.com${href}`;

            return { id: tweetId, url, authorHandle: handle, text: text.slice(0, 280) };
        } catch (e) {
            console.error('ZhaQu: Failed to extract tweet data', e);
            return null;
        }
    }

    // Update action bar
    function updateActionBar() {
        const bar = document.querySelector('.zhaqu-action-bar');
        const count = selectedTweets.size;

        bar.classList.toggle('visible', isSelectionMode && count > 0);
        bar.querySelector('.zhaqu-action-bar-count').textContent = `${count} selected`;

        const submitBtn = bar.querySelector('#zhaqu-submit-btn');
        const poolSelect = bar.querySelector('#zhaqu-pool-select');
        submitBtn.disabled = count === 0 || !poolSelect.value;

        // Update tag count
        const tagCount = document.getElementById('zhaqu-tag-count');
        if (tagCount) {
            tagCount.textContent = settings.tags.length;
        }
    }

    // Clear selection
    function clearSelection() {
        selectedTweets.clear();
        document.querySelectorAll('.zhaqu-checkbox.checked').forEach(el => el.classList.remove('checked'));
        document.querySelectorAll('.zhaqu-selected').forEach(el => el.classList.remove('zhaqu-selected'));
        updateActionBar();
    }

    // Load pools from API
    async function loadPools() {
        try {
            console.log('ZhaQu: Loading pools from', API_BASE);
            const res = await fetch(`${API_BASE}/api/workspaces`);
            const data = await res.json();
            const workspaces = data.workspaces || data;

            const select = document.querySelector('#zhaqu-pool-select');
            select.innerHTML = '<option value="">Select Pool...</option>';

            workspaces.forEach(ws => {
                if (ws.pools) {
                    ws.pools.forEach(pool => {
                        const option = document.createElement('option');
                        option.value = `${ws.id}|${pool.id}`;
                        option.textContent = `${ws.name} / ${pool.name}`;
                        select.appendChild(option);
                    });
                }
            });

            select.addEventListener('change', () => {
                const [wsId, poolId] = select.value.split('|');
                settings.workspaceId = wsId;
                settings.poolId = poolId;
                updateActionBar();
            });

            console.log('ZhaQu: Loaded', workspaces.length, 'workspaces');
        } catch (e) {
            console.error('ZhaQu: Failed to load pools from', API_BASE, e);
            showStatus('Failed to load pools', 'error');
        }
    }

    // Load tags from API
    async function loadTags() {
        try {
            const res = await fetch(`${API_BASE}/api/tags`);
            if (res.ok) {
                availableTags = await res.json();
                renderTagDropdown();
            }
        } catch (e) {
            console.error('ZhaQu: Failed to load tags', e);
        }
    }

    // Render tag dropdown
    function renderTagDropdown() {
        const dropdown = document.getElementById('zhaqu-tag-dropdown');
        if (!dropdown) return;

        dropdown.innerHTML = availableTags.map(tag => `
            <label class="zhaqu-tag-option">
                <input type="checkbox" value="${tag.id}" ${settings.tags.includes(tag.id) ? 'checked' : ''}>
                <span>${tag.name}</span>
            </label>
        `).join('');

        dropdown.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', (e) => {
                if (e.target.checked) {
                    settings.tags.push(e.target.value);
                } else {
                    settings.tags = settings.tags.filter(t => t !== e.target.value);
                }
                updateActionBar();
            });
        });
    }

    // Submit selected tweets
    async function submitSelected() {
        if (selectedTweets.size === 0) {
            showStatus('Please select at least one tweet', 'error');
            return;
        }
        if (!settings.poolId) {
            showStatus('Please select a Pool first', 'error');
            return;
        }

        const urls = Array.from(selectedTweets.values()).map(t => t.url);
        showStatus(`Importing ${urls.length} tweets...`);

        try {
            const res = await fetch(`${API_BASE}/api/ingest/jobs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId: settings.workspaceId,
                    poolId: settings.poolId,
                    urls,
                    tags: settings.tags,
                    options: { threadMode: 'single', mediaMode: 'link' }
                })
            });

            if (res.ok) {
                // Mark as ingested
                selectedTweets.forEach((_, id) => ingestedTweets.add(id));
                showStatus(`Successfully imported ${urls.length} tweets!`, 'success');
                clearSelection();
                // Update UI to show ingested status
                injectCheckboxes();
                injectQuickButtons();
            } else {
                const error = await res.json();
                showStatus(error.message || 'Import failed', 'error');
            }
        } catch (e) {
            console.error('ZhaQu: Import failed', e);
            showStatus('Import failed: Network error', 'error');
        }
    }

    // Sync visible tweets (for Likes/Bookmarks)
    async function syncVisibleTweets() {
        if (!settings.poolId) {
            showStatus('Please select a pool first', 'error');
            return;
        }

        const tweets = document.querySelectorAll(TWEET_SELECTOR);
        const urls = [];

        tweets.forEach(tweet => {
            const data = extractTweetData(tweet);
            if (data && !ingestedTweets.has(data.id)) {
                urls.push(data.url);
            }
        });

        if (urls.length === 0) {
            showStatus('No new tweets to sync', 'info');
            return;
        }

        showStatus(`Syncing ${urls.length} tweets...`);

        try {
            const res = await fetch(`${API_BASE}/api/ingest/jobs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId: settings.workspaceId,
                    poolId: settings.poolId,
                    urls,
                    options: { threadMode: 'single', mediaMode: 'link' }
                })
            });

            if (res.ok) {
                showStatus(`Synced ${urls.length} tweets!`, 'success');
            } else {
                showStatus('Sync failed', 'error');
            }
        } catch (_e) {
            showStatus('Sync failed: Network error', 'error');
        }
    }

    // Create sync job for bulk import
    async function createSyncJob() {
        if (!settings.poolId) {
            showStatus('Please select a pool first', 'error');
            return;
        }

        const source = isOnLikesPage ? 'LIKES' : 'BOOKMARKS';

        try {
            const res = await fetch(`${API_BASE}/api/sync/jobs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId: settings.workspaceId,
                    poolId: settings.poolId,
                    source,
                    options: { limit: 100 }
                })
            });

            if (res.ok) {
                showStatus('Sync job created! Check dashboard for progress.', 'success');
            } else {
                const error = await res.json();
                showStatus(error.error || 'Failed to create sync job', 'error');
            }
        } catch (_e) {
            showStatus('Failed to create sync job', 'error');
        }
    }

    // Show status notification
    function showStatus(message, type = 'info') {
        let status = document.querySelector('.zhaqu-status');
        if (!status) {
            status = document.createElement('div');
            status.className = 'zhaqu-status';
            document.body.appendChild(status);
        }

        status.textContent = message;
        status.className = `zhaqu-status ${type}`;

        setTimeout(() => status.classList.add('visible'), 10);
        setTimeout(() => status.classList.remove('visible'), 3000);
    }

    // Observer for dynamically loaded tweets
    function observeTimeline() {
        const observer = new MutationObserver(() => {
            if (isSelectionMode) {
                injectCheckboxes();
                injectQuickButtons();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Listen for messages from popup
    chrome.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
        if (message.type === 'TOGGLE_SELECTION_MODE') {
            toggleSelectionMode();
            sendResponse({ success: true });
        }
    });

    // Initialize
    async function init() {
        if (document.querySelector('.zhaqu-toggle')) return;

        // Load API base first
        await loadApiBase();

        createToggleButton();
        createActionBar();
        observeTimeline();

        console.log('ZhaQu Extension v1.1 initialized with API:', API_BASE);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
