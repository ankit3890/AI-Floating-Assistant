document.addEventListener('DOMContentLoaded', async () => {
    // Phase 1: Feature Loading (Inject HTML)
    if (window.featureLoader) {
        await window.featureLoader.loadAll();
    }



    // --- Configuration & Constants ---
    const OAUTH_BACKEND_URL = 'http://localhost:3000'; // TODO: Update to production URL

    
    // Default AIs (SVG paths stored as strings for simplicity)
    const DEFAULT_AIS = [
        {
            name: "ChatGPT",
            url: "https://chatgpt.com",
            icon: `<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>`
        },
        {
            name: "Gemini",
            url: "https://gemini.google.com",
            icon: `<path d="M12 2L14.5 9.5 22 12 14.5 14.5 12 22 9.5 14.5 2 12 9.5 9.5z"></path>`
        },
        {
            name: "Claude",
            url: "https://claude.ai",
            icon: `<path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>`
        },
        {
            name: "Gamma",
            url: "https://gamma.app",
            icon: `<path d="M12 2L2 22h20L12 2zm0 4l6 14H6l6-14z"></path>`
        }
    ];

    // AI Input Selector Mapping for Context Send
    // AI Input Selector Mapping for Context Send
    // Updated with more robust selectors (Dec 2024)
    const AI_INPUT_SELECTORS = {
        'chatgpt.com': '#prompt-textarea, textarea[data-id="root"]',
        'gemini.google.com': 'div[role="textbox"], div[contenteditable="true"], rich-textarea',
        'claude.ai': 'div[contenteditable="true"], fieldset div[contenteditable="true"]',
        'copilot.microsoft.com': 'textarea[id*="searchbox"], div[role="textbox"]',
        'perplexity.ai': 'textarea[placeholder*="Ask"], div[role="textbox"]',
        'you.com': 'textarea[name="query"], textarea[placeholder*="Ask"]',
        // Fallback selectors - broadly try everything
        'default': 'textarea, div[contenteditable="true"], input[type="text"], div[role="textbox"]'
    };

    // State
    let currentAIs = [];
    let isAlwaysOnTop = true;
    let isBrowserMode = false;
    let currentContextText = ''; // For Context Send feature
    let isIncognitoMode = false; // For incognito sessions
    
    // Feature Visibility Configuration
    const DEFAULT_FEATURE_FLAGS = {
        compare: true,
        browser: true,
        screenDrawing: true,


    };
    let currentFeatureFlags = { ...DEFAULT_FEATURE_FLAGS };
    


    // --- References ---
    const webview = document.getElementById('ai-view');
    const toggleTopBtn = document.getElementById('toggle-top');
    const browserToolbar = document.getElementById('browser-toolbar');
    const addressBar = document.getElementById('address-bar');
    const navBack = document.getElementById('nav-back');
    const navForward = document.getElementById('nav-forward');
    const navReload = document.getElementById('nav-reload');

    const sidebar = document.getElementById('sidebar');
    const aiListContainer = document.getElementById('ai-list');
    const menuBtn = document.getElementById('menu-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    const aboutBtn = document.getElementById('btn-about-app');
    
    // Split View Refs
    const pane1 = document.getElementById('pane-1');
    const pane2 = document.getElementById('pane-2');
    const webview1 = document.getElementById('ai-view');
    const webview2 = document.getElementById('ai-view-2');

    
    // Modals
    const aboutModal = document.getElementById('modal-about-app');
    const closeModal = document.getElementById('close-modal');
    
    const settingsBtn = document.getElementById('btn-settings-app');
    const settingsModal = document.getElementById('modal-settings-app');
    const closeSettingsModal = document.getElementById('close-settings-modal');
    
    // Management UI
    const manageList = document.getElementById('manage-list');
    const newAiName = document.getElementById('new-ai-name');
    const newAiUrl = document.getElementById('new-ai-url');
    const saveAiBtn = document.getElementById('save-ai-btn');
    const resetDefaultsBtn = document.getElementById('reset-defaults-btn');
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    const incognitoToggleBtn = document.getElementById('incognito-toggle-btn');
    const incognitoStatus = document.getElementById('incognito-status');
    
    // Quick Access Buttons
    const quickIncognitoBtn = document.getElementById('quick-incognito-btn');
    const quickClearCookiesBtn = document.getElementById('quick-clear-cookies-btn');

    // Context Send Menu
    const contextMenu = document.getElementById('context-send-menu');
    const contextPreview = document.getElementById('context-preview');
    const closeContextMenu = document.getElementById('close-context-menu');
    const contextActions = document.querySelectorAll('.context-action');
    
    // Compact Mode Elements
    // Compact Mode Elements (Ref cleanup: collapseBtn replaced by hideWindowBtn)
    const bubbleView = document.getElementById('bubble-view');
    const expandBubbleBtn = document.getElementById('expand-btn');
    const bubblePill = document.querySelector('.bubble-pill');

    // Login Modal Refs (OAuth System Browser)
    const loginFailedModal = document.getElementById('modal-login-failed');
    const closeLoginFailedModal = document.getElementById('close-login-failed-modal');
    const oauthLoginBtn = document.getElementById('oauth-login-btn');
    const retryLoginBtn = document.getElementById('retry-login-btn');
    const cancelLoginFailedBtn = document.getElementById('cancel-login-failed-btn');

    
    // Split View State
    let isSplitMode = false;
    let activePane = 'pane-1'; // 'pane-1' or 'pane-2'

    // Webview Persistence Cache: { 'pane-1': { 'url': webview }, 'pane-2': { ... } }
    const paneWebviewCache = {
        'pane-1': {},
        'pane-2': {}
    };

    function getActiveWebview() {
        const container = document.getElementById(activePane);
        if (!container) return null;
        // Find visible webview in the active pane
        return container.querySelector('webview:not(.hidden)');
    }

    // Initial Webview Setup - Put existing one in cache
    console.log('[Init] Setting up initial webviews...');
    console.log('[Init] webview1:', webview1);
    console.log('[Init] webview2:', webview2);
    
    if (webview1 && pane1) {
        const initialUrl = webview1.getAttribute('src') || 'https://chatgpt.com';
        paneWebviewCache['pane-1'][initialUrl] = webview1;
        console.log('[Init] Calling setupWebviewListeners for webview1');
        setupWebviewListeners(webview1);
    }
    if (webview2 && pane2) {
        const initialUrl = webview2.getAttribute('src') || 'https://gemini.google.com';
        paneWebviewCache['pane-2'][initialUrl] = webview2;
        console.log('[Init] Calling setupWebviewListeners for webview2');
        setupWebviewListeners(webview2);
    }


    // ============================================
    // INCOGNITO MODE LOGIC MOVED TO LINE 362
    // ============================================

    // Bind Incognito Events
    if (quickIncognitoBtn) {
        quickIncognitoBtn.addEventListener('click', toggleIncognitoMode);
    }
    if (incognitoToggleBtn) {
        incognitoToggleBtn.addEventListener('click', toggleIncognitoMode);
    }

    // --- Auto-Startup Logic ---
    const startupToggle = document.getElementById('startup-toggle');
    if (startupToggle) {
        // Load initial state
        window.electronAPI.getStartupStatus().then(isEnabled => {
            startupToggle.checked = isEnabled;
        });

        // Handle toggle
        startupToggle.addEventListener('change', async () => {
             const newState = await window.electronAPI.toggleStartup();
             startupToggle.checked = newState;
             console.log(`Auto-Startup toggled: ${newState}`);
        });
    }





    // Login Failure Tracking
    const loginTracking = new Map(); // webview -> { retryCount: 0, timer: null, lastUrl: '' }

    function getLoginTracker(wv) {
        if (!loginTracking.has(wv)) {
            loginTracking.set(wv, { retryCount: 0, timer: null, lastUrl: '' });
        }
        return loginTracking.get(wv);
    }

    // Helper to add listener safely
    function addListener(element, event, handler) {
        if (element) {
            element.addEventListener(event, handler);
        }
    }

    // --- Helpers ---
    const footerProgress = document.getElementById('footer-progress');
    let loadingWebviews = new Set();
    let loadingSafetyTimeout = null;

    function updateFooterProgress() {
        if (!footerProgress) return;
        
        if (loadingWebviews.size > 0) {
            footerProgress.classList.remove('complete');
            footerProgress.classList.add('active');
            
            // Safety Valve: Force complete after 12 seconds if stuck
            if (loadingSafetyTimeout) clearTimeout(loadingSafetyTimeout);
            loadingSafetyTimeout = setTimeout(() => {
                if (loadingWebviews.size > 0) {
                    loadingWebviews.clear();
                    updateFooterProgress();
                }
            }, 12000);
        } else {
            if (loadingSafetyTimeout) {
                clearTimeout(loadingSafetyTimeout);
                loadingSafetyTimeout = null;
            }
            
            footerProgress.classList.add('complete');
            footerProgress.classList.remove('active');
            
            setTimeout(() => {
                if (loadingWebviews.size === 0) {
                    footerProgress.classList.remove('complete');
                }
            }, 400);
        }
    }

    function collapseSidebar() {
        if (sidebar && sidebar.classList.contains('expanded')) {
            sidebar.classList.remove('expanded');
            const overlay = document.getElementById('sidebar-overlay');
            if (overlay) overlay.classList.add('hidden');
        }
    }

    function expandSidebar() {
        if (sidebar && !sidebar.classList.contains('expanded')) {
            sidebar.classList.add('expanded');
            const overlay = document.getElementById('sidebar-overlay');
            if (overlay) overlay.classList.remove('hidden');
        }
    }

    // Centralized Webview Listener Setup
    // setupWebviewListeners function moved to line 1031 where it has full error detection


    // ============================================
    // INCOGNITO MODE LOGIC
    // ============================================

    function toggleIncognitoMode() {
        isIncognitoMode = !isIncognitoMode;
        
        // 1. Update State
        // 1. Update State
        const activeContainer = document.getElementById('pane-1');
        // FIX: Must get the CURRENT valid webview from DOM, not the stale 'webview1' const
        const currentWv = document.getElementById('ai-view') || getActiveWebview(); 
        const currentUrl = currentWv ? currentWv.getURL() : 'https://google.com';

        if (!currentWv || !currentWv.parentNode) {
            console.error("Cannot toggle Incognito: No active webview found in DOM.");
            return;
        }
        
        try {
            // 2. Remove Old Webview
            currentWv.parentNode.removeChild(currentWv);
            
            // 3. Clear all cached webviews to ensure privacy
            Object.keys(paneWebviewCache).forEach(paneId => {
                const cache = paneWebviewCache[paneId];
                Object.values(cache).forEach(wv => {
                    if (wv && wv.parentNode) wv.parentNode.removeChild(wv);
                });
                paneWebviewCache[paneId] = {};
            });

            // 4. Create New Webview for current active view
            const newWv = document.createElement('webview');
            newWv.src = currentUrl;
            newWv.id = 'ai-view'; // Keep ID for legacy refs if any
            
            // CRITICAL: Partition Switch
            if (isIncognitoMode) {
                newWv.partition = 'incognito'; 
            } else {
                newWv.partition = 'persist:ai_session_v2';
            }
            
            newWv.setAttribute('allowpopups', '');
            newWv.setAttribute('useragent', "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0");
            
            // Add to cache and pool
            paneWebviewCache['pane-1'][currentUrl] = newWv;
            setupWebviewListeners(newWv);
            activeContainer.appendChild(newWv);
            
            // Update UI
            if (incognitoStatus) {
                incognitoStatus.innerText = isIncognitoMode ? 'ON' : 'OFF';
                incognitoStatus.style.color = isIncognitoMode ? '#a855f7' : 'inherit';
            }
            if (incognitoToggleBtn) {
                 if (isIncognitoMode) {
                     incognitoToggleBtn.style.borderColor = '#a855f7';
                     incognitoToggleBtn.style.backgroundColor = 'rgba(168, 85, 247, 0.15)';
                     incognitoToggleBtn.style.boxShadow = '0 0 8px rgba(168, 85, 247, 0.3)';
                 } else {
                     incognitoToggleBtn.style.borderColor = '';
                     incognitoToggleBtn.style.backgroundColor = '';
                     incognitoToggleBtn.style.boxShadow = '';
                 }
            }
            if (quickIncognitoBtn) {
                quickIncognitoBtn.classList.toggle('active', isIncognitoMode);
                quickIncognitoBtn.style.color = isIncognitoMode ? '#a855f7' : '#666';
            }

            console.log(`Incognito toggled: ${isIncognitoMode}. Cache cleared.`);
            
        } catch (err) {
            console.error("Error toggling incognito:", err);
            alert("Failed to toggle Incognito mode. Please restart the app.");
        }
    }

    // --- Logic ---
    
    // Attach Listeners for Incognito
    if (incognitoToggleBtn) incognitoToggleBtn.addEventListener('click', toggleIncognitoMode);
    if (quickIncognitoBtn) quickIncognitoBtn.addEventListener('click', toggleIncognitoMode);

    // Quick Refresh
    const quickRefreshBtn = document.getElementById('quick-refresh-btn');
    if (quickRefreshBtn) {
        quickRefreshBtn.addEventListener('click', () => {
             const wv = getActiveWebview();
             if (wv) {
                 loadingWebviews.add(wv);
                 updateFooterProgress();
                 wv.reload();
                 
                 // Safety cleanup for refresh: if no event fires in 3s, clear it
                 setTimeout(() => {
                     if (loadingWebviews.has(wv)) {
                         loadingWebviews.delete(wv);
                         updateFooterProgress();
                     }
                 }, 3000);
             }
        });
    }

    // Initialize Progress State
    updateFooterProgress();

    // Nav Button Update Helper
    function updateNavButtons(wv) {
        if (!wv) return;
        if (typeof wv.canGoBack === 'function') {
            if(navBack) navBack.disabled = !wv.canGoBack();
        }
        if (typeof wv.canGoForward === 'function') {
            if(navForward) navForward.disabled = !wv.canGoForward();
        }
    }

    // Load AIs from Storage or Defaults
    // Load AIs from Store (Async)
    async function loadAIs() {
        let loaded = null;
        
        // 1. Try Electron Store
        if (window.electronAPI && window.electronAPI.settingsGet) {
            loaded = await window.electronAPI.settingsGet('userAIs');
        }
        
        // 2. Fallback to LocalStorage (Migration attempt)
        if (!loaded || !Array.isArray(loaded) || loaded.length === 0) {
            const local = localStorage.getItem('user-ais');
            if (local) {
                try { 
                    loaded = JSON.parse(local);
                } catch(e) {}
            }
        }

        if (loaded && Array.isArray(loaded) && loaded.length > 0) {
            currentAIs = loaded;
        } else {
            // Default
            currentAIs = [...DEFAULT_AIS];
            // Ensure we save this initial state to file
            saveAIs();
        }
        
        renderSidebar();

        // Auto-select logic (delayed to ensure render)
        setTimeout(() => {
            renderCompareView();
            let targetBtn = null;
            let targetUrl = '';
            
            const chatGPT = currentAIs.find(ai => ai.name.toLowerCase().includes('chatgpt'));
            if (chatGPT) {
                targetBtn = document.querySelector(`.ai-item[data-url="${chatGPT.url}"]`);
                if (targetBtn) targetUrl = chatGPT.url;
            }
            
            if (!targetBtn && currentAIs.length > 0) {
                 const firstAI = currentAIs[0];
                 targetBtn = document.querySelector(`.ai-item[data-url="${firstAI.url}"]`);
                 if (targetBtn) targetUrl = firstAI.url;
            }
            
            if (targetBtn) activateAI(targetBtn, targetUrl);
        }, 200);
    }

    // Save Logic
    function saveAIs() {
        // save to local storage for backup
        localStorage.setItem('user-ais', JSON.stringify(currentAIs));
        
        // save to file store
        if (window.electronAPI && window.electronAPI.settingsSet) {
            window.electronAPI.settingsSet('userAIs', currentAIs);
        }
        
        renderSidebar();
    }

    // Feature Flags Logic
    async function loadFeatureFlags() {
        let loaded = null;
        if (window.electronAPI && window.electronAPI.settingsGet) {
            loaded = await window.electronAPI.settingsGet('featureFlags');
        }
        
        if (loaded) {
             currentFeatureFlags = { ...DEFAULT_FEATURE_FLAGS, ...loaded };
        } else {
             // Fallback
             const saved = localStorage.getItem('feature-flags');
             if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    currentFeatureFlags = { ...DEFAULT_FEATURE_FLAGS, ...parsed };
                } catch (e) {}
             }
        }
        // Save to ensure sync
        saveFeatureFlags();
        renderFeatureSettings();
    }

    function saveFeatureFlags() {
        localStorage.setItem('feature-flags', JSON.stringify(currentFeatureFlags));
        
        if (window.electronAPI && window.electronAPI.settingsSet) {
            window.electronAPI.settingsSet('featureFlags', currentFeatureFlags);
        }
        renderSidebar();
    }
    
    function toggleFeature(featureKey, enabled) {
        currentFeatureFlags[featureKey] = enabled;
        saveFeatureFlags();
        
        // Update Settings UI to reflect state (if changed programmatically or just to sync)
        renderFeatureSettings();

        // Safety: If disabling current view, switch to default
        if (!enabled) {
            const safetyMap = {
                'compare': 'pane-compare',
                'browser': 'browser-toolbar', // Browser shares view but has toolbar


                'screenLens': 'pane-screen-lens'
            };
            
            // Heuristic check: Is this feature currently "active"?
            // If browser disabled and isBrowserMode is true -> switch
            // If compare disabled and compare pane !hidden -> switch
            // etc.
            
            let shouldSwitch = false;
            
            if (featureKey === 'browser' && isBrowserMode) shouldSwitch = true;
            if (featureKey === 'compare' && !document.getElementById('pane-compare').classList.contains('hidden')) shouldSwitch = true;


            
            if (shouldSwitch) {
                console.log(`Safety switch triggered: ${featureKey} disabled while active.`);
                // Switch to first available AI or just reload
                loadAIs(); // simpler to just re-run safe selection logic
            }
        }
    }

    // Render Feature Settings UI
    function renderFeatureSettings() {
        const container = document.getElementById('sidebar-features-list');
        if (!container) return;
        container.innerHTML = '';
        
        const featureLabels = {
            'compare': 'Compare Mode',
            'browser': 'Web Browser',
            'screenDrawing': 'Screen Drawing',


        };

        Object.keys(DEFAULT_FEATURE_FLAGS).forEach(key => {
            const isEnabled = currentFeatureFlags[key];
            const row = document.createElement('div');
            row.className = 'feature-toggle-row';
            
            row.innerHTML = `
                <span>${featureLabels[key] || key}</span>
                <label class="switch">
                    <input type="checkbox" ${isEnabled ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            `;
            
            const checkbox = row.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                toggleFeature(key, e.target.checked);
            });
            
            container.appendChild(row);
        });
    }

    // Render SideBar
    function renderSidebar() {
        if (!aiListContainer) return;
        aiListContainer.innerHTML = '';

        // 1. Compare Mode
        if (currentFeatureFlags.compare) {
            const compareLi = document.createElement('li');
            compareLi.className = 'ai-item';
            compareLi.id = 'sidebar-compare-btn';
            compareLi.title = 'Compare Mode';
            compareLi.innerHTML = `
               <svg class="icon" style="color: #8b5cf6;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
               </svg>
               <span class="ai-name">Compare</span>
            `;
            compareLi.addEventListener('click', () => toggleComparePane(compareLi));
            aiListContainer.appendChild(compareLi);
        }

        // 2. Browser Mode
        if (currentFeatureFlags.browser) {
            const browserLi = document.createElement('li');
            browserLi.className = 'ai-item browser-mode';
            browserLi.setAttribute('data-url', 'https://www.google.com');
            browserLi.title = 'Web Browser';
            browserLi.innerHTML = `
              <svg class="icon" style="color: #3b82f6;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
               <span class="ai-name">Browser</span>
            `;
            browserLi.addEventListener('click', () => {
                collapseSidebar(); // Auto-Collapse
                activateAI(browserLi, 'https://www.google.com', true);
            });
            aiListContainer.appendChild(browserLi);
        }

        // 3. Screen Drawing
        if (currentFeatureFlags.screenDrawing) {
            const drawingLi = document.createElement('li');
            drawingLi.className = 'ai-item drawing-item';
            drawingLi.title = 'Screen Drawing';
            drawingLi.innerHTML = `
              <svg class="icon" style="color: #ef4444;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                <path d="M2 2l7.586 7.586"></path>
                <circle cx="11" cy="11" r="2"></circle>
              </svg>
               <span class="ai-name">Screen Drawing</span>
            `;
            drawingLi.addEventListener('click', () => {
                 window.electronAPI.openScreenDrawing();
            });
            aiListContainer.appendChild(drawingLi);
        }

        // Separator (only if features above are likely present)
        if (currentFeatureFlags.compare || currentFeatureFlags.browser) {
            const sep = document.createElement('div');
            sep.className = 'separator';
            aiListContainer.appendChild(sep);
        }









        // 4. Custom AIs
        currentAIs.forEach((ai, index) => {
            const li = document.createElement('li');
            li.className = 'ai-item';
            li.setAttribute('data-url', ai.url);
            li.title = ai.name;

            const color = getAIColor(ai.name);
            
            let iconHtml = ai.icon;
            if (!iconHtml) {
                const initial = ai.name.charAt(0).toUpperCase();
                iconHtml = `<div class="icon" style="display:flex;justify-content:center;align-items:center;font-weight:bold;border:2px solid ${color};color:${color};border-radius:50%;width:24px;height:24px;font-size:12px;">${initial}</div>`;
            } else if (iconHtml.includes('<path') && !iconHtml.includes('<svg')) {
                 // Is a raw path (Default AIs) -> Wrap in SVG
                 iconHtml = `<svg class="icon" style="color: ${color};" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${iconHtml}</svg>`;
            } else if (!iconHtml.includes('<svg')) {
                 // Text/Emoji icon?
                 iconHtml = `<div class="icon" style="color:${color}">${iconHtml}</div>`;
            } else {
                 // Full SVG Icon - inject style
                 iconHtml = iconHtml.replace('<svg', `<svg style="color: ${color};"`);
            }

            li.innerHTML = `
                ${iconHtml}
                <span class="ai-name">${ai.name}</span>
            `;

            li.addEventListener('click', () => {
                collapseSidebar(); // Auto-Collapse
                activateAI(li, ai.url)
            });
            aiListContainer.appendChild(li);
        });

        // 4. Quick Add AI Button (Last Item)
        const addLi = document.createElement('li');
        addLi.className = 'ai-item add-ai-btn';
        addLi.title = 'Add New AI';
        addLi.innerHTML = `
            <div class="icon" style="display:flex;justify-content:center;align-items:center;border:2px dashed #666;color:#888;border-radius:50%;width:24px;height:24px;background:rgba(255,255,255,0.05);">
                <span style="font-size:16px;line-height:1;margin-top:-2px;">+</span>
            </div>
            <span class="ai-name" style="color:#888;">Add AI</span>
        `;
        addLi.addEventListener('click', () => {
             // Open Add Modal
             const addModal = document.getElementById('modal-add-ai');
             if (addModal) addModal.classList.remove('hidden');
             // Focus Name Input
             if (newAiName) setTimeout(() => newAiName.focus(), 100);
        });
        aiListContainer.appendChild(addLi);
    }

    function activateAI(item, url, isBrowser = false) {
        // UI Updates (Sidebar)
        document.querySelectorAll('.ai-item').forEach(i => i.classList.remove('active'));
        if (item) item.classList.add('active');
        
        // Hide other views
        const actionPane = document.getElementById('pane-action');
        const comparePane = document.getElementById('pane-compare');
        const screenLensPane = document.getElementById('pane-screen-lens');
        const webviewContainer = document.getElementById('webview-container');
        const container = document.getElementById(activePane);
        
        if (actionPane) actionPane.classList.add('hidden');
        if (comparePane) comparePane.classList.add('hidden'); 
        if (webviewContainer) webviewContainer.classList.remove('hidden');
        
        // Show active panes
        if (pane1) pane1.classList.remove('hidden');
        if (pane2) {
             if (isSplitMode) pane2.classList.remove('hidden');
             else pane2.classList.add('hidden');
        }
        
        // Hide all webviews in the current pane
        container.querySelectorAll('webview').forEach(wv => wv.classList.add('hidden'));

        isCompareActive = false;
        isBrowserMode = isBrowser;
        if (browserToolbar) {
            if (isBrowserMode) {
                browserToolbar.classList.remove('hidden');
                if(addressBar) addressBar.value = url; 
            } else {
                browserToolbar.classList.add('hidden');
            }
        }

        // Persistent Webview Logic
        let targetWebview = paneWebviewCache[activePane][url];
        
        if (!targetWebview) {
            console.log(`Creating new persistent webview for: ${url}`);
            targetWebview = document.createElement('webview');
            targetWebview.src = url;
            targetWebview.partition = isIncognitoMode ? 'incognito' : 'persist:ai_session_v2';
            targetWebview.setAttribute('allowpopups', '');
            targetWebview.setAttribute('useragent', "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0");
            
            setupWebviewListeners(targetWebview);
            container.appendChild(targetWebview);
            paneWebviewCache[activePane][url] = targetWebview;
        }

        targetWebview.classList.remove('hidden');

        // Update Address Bar if browser mode
        if (isBrowserMode && addressBar) {
            addressBar.value = targetWebview.getURL();
        }

        // If in split mode and pane has overlay, hide it
        const overlay = container.querySelector('.pane-overlay');
        if (overlay) overlay.style.display = 'none';
    }



    // Render Management List
    function renderManageList() {
        if (!manageList) return;
        manageList.innerHTML = '';

        currentAIs.forEach((ai, index) => {
            const row = document.createElement('div');
            row.className = 'settings-item';
            
            row.innerHTML = `
                <span class="settings-name">${ai.name}</span>
                <button class="delete-btn" title="Remove">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            `;

            row.querySelector('.delete-btn').addEventListener('click', () => {
                currentAIs.splice(index, 1);
                saveAIs();
                renderManageList(); // Re-render this list
            });

            manageList.appendChild(row);
        });
    }

    // Add New AI
    function addNewAI() {
        const name = newAiName.value.trim();
        let url = newAiUrl.value.trim();

        if (!name || !url) return alert('Name and URL are required');
        if (!url.startsWith('http')) url = 'https://' + url;

        currentAIs.push({ name, url, icon: null }); // Null icon -> generic initial
        saveAIs();
        
        // Refresh Manage List if open
        if (manageList) renderManageList();
        
        // Clear & Close
        newAiName.value = '';
        newAiUrl.value = '';
        
        const addModal = document.getElementById('modal-add-ai');
        if (addModal) addModal.classList.add('hidden');

        // Refresh Compare View if active or just update state
        if (typeof renderCompareView === 'function') {
            renderCompareView();
        }
    }

    // Reset Defaults
    function resetDefaults() {
        showConfirmModal('Are you sure you want to reset to the default AIs? Custom items will be lost.', () => {
            currentAIs = [...DEFAULT_AIS];
            saveAIs();
            renderManageList();
            if (typeof renderCompareView === 'function') {
                renderCompareView();
            }
        });
    }

    // --- Event Listeners ---
    
    // Initial Load
    // Initial Load
    await loadFeatureFlags(); 
    await loadAIs();
    renderFeatureSettings(); // Initial render of settings UI
    toggleTopBtn.classList.add('active'); // Default to pinned
    
    // Dynamic Version
    window.electronAPI.getAppVersion().then(ver => {
        const verEl = document.getElementById('app-version');
        if (verEl) verEl.innerText = `Version ${ver}`;
    });

    // Sidebar
    addListener(menuBtn, 'click', () => {
        if (!sidebar) return;
        if (sidebar.classList.contains('expanded')) {
            collapseSidebar();
        } else {
            expandSidebar();
        }
    });
    
    // Clicking the overlay collapses the sidebar
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', collapseSidebar);
    }
    
    // Auto-collapse when clicking outside (Main Content Area)
    document.addEventListener('click', (e) => {
        if (sidebar && sidebar.classList.contains('expanded')) {
            // Validate target is not sidebar itself or the toggle button
            if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                collapseSidebar();
            }
        }
    });

    // Modals
    addListener(aboutBtn, 'click', () => { if(aboutModal) aboutModal.classList.remove('hidden'); });
    addListener(closeModal, 'click', () => { if(aboutModal) aboutModal.classList.add('hidden'); });
    
    // Add AI Modal
    const addModal = document.getElementById('modal-add-ai');
    const closeAddModal = document.getElementById('close-add-modal');
    addListener(closeAddModal, 'click', () => { if(addModal) addModal.classList.add('hidden'); });
    // Close on outside click for Add Modal
    window.addEventListener('click', (e) => {
        if (e.target === addModal) addModal.classList.add('hidden');
    });

    addListener(settingsBtn, 'click', () => { 
        if(settingsModal) {
            renderManageList();
            settingsModal.classList.remove('hidden'); 
        }
    });
    addListener(closeSettingsModal, 'click', () => { if(settingsModal) settingsModal.classList.add('hidden'); });
    
    // Settings Actions
    
    addListener(saveAiBtn, 'click', addNewAI);
    addListener(resetDefaultsBtn, 'click', resetDefaults);

    // --- Confirmation Modal Logic ---
    const confirmModal = document.getElementById('modal-confirm');
    const confirmMessage = document.getElementById('confirm-message');
    const btnOkConfirm = document.getElementById('btn-ok-confirm');
    const btnCancelConfirm = document.getElementById('btn-cancel-confirm');
    const closeConfirmModal = document.getElementById('close-confirm-modal');
    
    let pendingConfirmAction = null;

    function showConfirmModal(msg, action) {
        if(confirmMessage) confirmMessage.innerText = msg;
        pendingConfirmAction = action;
        if(confirmModal) confirmModal.classList.remove('hidden');
    }

    function hideConfirmModal() {
        if(confirmModal) confirmModal.classList.add('hidden');
        pendingConfirmAction = null;
    }

    if(btnOkConfirm) {
        btnOkConfirm.addEventListener('click', () => {
            if (pendingConfirmAction) pendingConfirmAction();
            hideConfirmModal();
        });
    }
    
    if(btnCancelConfirm) btnCancelConfirm.addEventListener('click', hideConfirmModal);
    if(closeConfirmModal) closeConfirmModal.addEventListener('click', hideConfirmModal);
    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === confirmModal) hideConfirmModal();
    });

    addListener(clearCacheBtn, 'click', async () => {
        showConfirmModal('This will log you out of all AI services and clear cache. Continue?', async () => {
            await clearAllCache();
        });
    });

    async function clearAllCache() {
        if (window.electronAPI && window.electronAPI.clearSessionData) {
            const success = await window.electronAPI.clearSessionData();
            if (success) {
                showToast('Data cleared. The app will reload.');
                if (webview) webview.reload();
                if (webview2) webview2.reload();
            } else {
                showToast('Failed to clear data.');
            }
        } else {
            showToast('API not available.');
        }
    }

    // [REMOVED] Duplicate Update Logic (See Global Handler at bottom of file)

    // Login Failed Modal Handlers
    addListener(closeLoginFailedModal, 'click', () => loginFailedModal.classList.add('hidden'));
    addListener(cancelLoginFailedBtn, 'click', () => loginFailedModal.classList.add('hidden'));
    
    // Clear cache and retry login
    addListener(oauthLoginBtn, 'click', () => {
        loginFailedModal.classList.add('hidden');
        showToast('Opening system browser for login...');
        const authUrl = `${OAUTH_BACKEND_URL}/auth/google/start`;
        console.log('[OAuth] Opening external login:', authUrl);
        window.electronAPI.openExternal(authUrl);
    });

    // Handle Auth Success
    if (window.electronAPI && window.electronAPI.onAuthSuccess) {
        window.electronAPI.onAuthSuccess((token) => {
            console.log('[Auth] Received token from backend');
            if (!token) return;
            
            // Store token
            localStorage.setItem('app_token', token);
            showToast('✅ Logged in successfully!');
            
            // Reload active webview to apply any session changes (if applicable)
            const activeWv = getActiveWebview();
            if (activeWv) {
                console.log('[Auth] Reloading webview...');
                activeWv.reload();
            }
        });
    }


    // [REMOVED] Duplicate Toast (See Global Handler)

    // Browser Toolbar
    if (addressBar) {
        addressBar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                let val = addressBar.value.trim();
                if (!val) return;
                if (!val.startsWith('http://') && !val.startsWith('https://')) {
                    val = 'https://' + val;
                }
                if(webview) webview.src = val;
                addressBar.blur();
            }
        });
    }

    addListener(navBack, 'click', () => { const wv = getActiveWebview(); if (wv && wv.canGoBack()) wv.goBack(); });
    addListener(navForward, 'click', () => { const wv = getActiveWebview(); if (wv && wv.canGoForward()) wv.goForward(); });
    addListener(navReload, 'click', () => { const wv = getActiveWebview(); if(wv) wv.reload(); });

    // Centralized Webview Listener Setup
    function setupWebviewListeners(wv) {
        console.log('[setupWebviewListeners] Called for webview:', wv);
        if (!wv) {
            console.warn('[setupWebviewListeners] Webview is null/undefined!');
            return;
        }
        console.log('[setupWebviewListeners] Attaching event listeners...');

        // 1. Navigation State Updates
        wv.addEventListener('did-navigate', (e) => {
             if (wv === getActiveWebview()) {
                 if (addressBar) addressBar.value = e.url;
                 updateNavButtons(wv);
             }
             
             // Check for Google rejection URL on navigation
             const url = e.url.toLowerCase();
             if (url.includes('google.com') && url.includes('/rejected')) {
                 console.log('[did-navigate] Google rejection URL detected:', e.url);
                 showLoginFailedModal();
             }
        });

        wv.addEventListener('did-navigate-in-page', (e) => {
             if (wv === getActiveWebview()) {
                 if (addressBar) addressBar.value = e.url;
                 updateNavButtons(wv);
             }
             
             // Check for Google rejection URL on in-page navigation
             const url = e.url.toLowerCase();
             if (url.includes('google.com') && url.includes('/rejected')) {
                 console.log('[did-navigate-in-page] Google rejection URL detected:', e.url);
                 showLoginFailedModal();
             }
        });
        
        // 2. Loading State
        wv.addEventListener('did-start-loading', () => {
             loadingWebviews.add(wv);
             updateFooterProgress();
        });
        
        const stopLoading = () => {
             loadingWebviews.delete(wv);
             updateFooterProgress();
             if (wv === getActiveWebview()) {
                 updateNavButtons(wv);
             }
        };
        
        wv.addEventListener('did-stop-loading', stopLoading);

        // 3. New Window Handling (External Browser)
        wv.addEventListener('new-window', (e) => {
            e.preventDefault();
            window.electronAPI.openExternal(e.url);
        });

        // 4. Security & Error Handling
        wv.addEventListener('did-start-navigation', (e) => {
            // Let navigation proceed - we'll check for errors after page loads
        });

        wv.addEventListener('will-navigate', (e) => {
            if (isBrowserMode) return;
            // Domain allowlist logic can go here if needed
        });


        wv.addEventListener('did-finish-load', () => {
            const url = wv.getURL().toLowerCase();
            console.log('[Webview] Page loaded:', url);
            
            if (url.includes('google.com')) {
                // Only check for explicit rejection URLs
                if (url.includes('/rejected')) {
                    console.log('[Google] Rejection URL detected');
                    showLoginFailedModal();
                    return;
                }
                
                // For signin pages, check the actual page content for errors
                console.log('[Google] Checking for error page...');
                wv.executeJavaScript(`
                    (function() {
                        const content = document.body.innerText;
                        const patterns = [
                            'may not be secure',
                            'Couldn',
                            'couldn',
                            'sign you in',
                            'something went wrong',
                            'different browser',
                            'not supported',
                            'Try again'
                        ];
                        const found = patterns.find(p => content.includes(p));
                        return { hasError: !!found, pattern: found || null, content: content.substring(0, 500) };
                    })()
                `).then(result => {
                    console.log('[Google] Error check result:', result);
                    if (result && result.hasError) {
                        console.log('[Google] Error detected, showing modal');
                        showLoginFailedModal();
                    }
                }).catch(err => console.error('[Google] Error checking page:', err));
            }
        });
        console.log('[setupWebviewListeners] did-finish-load listener attached to webview');

        wv.addEventListener('did-fail-load', (e) => {
            stopLoading(); // Clean up loading state
            if (e.isMainFrame && e.errorCode < 0 && e.errorCode !== -3) { 
                const url = wv.getURL().toLowerCase();
                if (url.includes('google') || url.includes('openai') || url.includes('anthropic')) {
                    showLoginFailedModal();
                }
            }
        });
        
        wv.addEventListener('destroyed', stopLoading);
    }

    function showLoginFailedModal() {
        if (loginFailedModal) {
            loginFailedModal.classList.remove('hidden');
        }
    }

    setupWebviewListeners(webview1);
    setupWebviewListeners(webview2);

    // Split Button Listener & Pane Click Listeners Removed

    // Always on Top
    addListener(toggleTopBtn, 'click', async () => {
        isAlwaysOnTop = !isAlwaysOnTop;
        if (window.electronAPI) {
            const result = await window.electronAPI.toggleAlwaysOnTop(isAlwaysOnTop);
            if (result) toggleTopBtn.classList.add('active');
            else toggleTopBtn.classList.remove('active');
        }
    });

    // ===== Compact Mode Logic =====
    function setCompactMode(enabled) {
        if (enabled) {
            document.body.classList.add('compact-mode');
            if (window.electronAPI) window.electronAPI.collapseWindow();
        } else {
            document.body.classList.remove('compact-mode');
            if (window.electronAPI) window.electronAPI.expandWindow();
        }
    }

    // Listen for shortcut/IPC
    if (window.electronAPI) {
        window.electronAPI.onToggleCompactMode(() => {
            const isCompact = document.body.classList.contains('compact-mode');
            setCompactMode(!isCompact);
        });
    }

    // Hide Window Button
    const hideWindowBtn = document.getElementById('hide-window-btn');
    addListener(hideWindowBtn, 'click', () => {
        if (window.electronAPI && window.electronAPI.hideWindow) {
            window.electronAPI.hideWindow();
        }
    });
    
    // Expand when clicking pill or explicit expand button
    if (bubblePill) {
        bubblePill.addEventListener('click', (e) => {
             // If clicked expand button specifically, handle it there? 
             // Or generic click expands.
             setCompactMode(false);
        });
    }
    
    // Safety check: Exit compact mode if any modal triggers? 
    // Usually user will want to expand first.


    // --- Onboarding Tour Logic ---
    // --- Onboarding Tour Logic ---
    async function initTour() {
        let currentVersion = '1.0.4';
        try {
             currentVersion = await window.electronAPI.getAppVersion();
        } catch (e) { console.error(e); }

        const TOUR_VERSION_KEY = 'ai_pin_tour_seen_v3'; // Bumped version for new features
        const savedVersion = localStorage.getItem(TOUR_VERSION_KEY); 

        // Steps Configuration
        const rawSteps = [
            {
                element: null, 
                title: "Welcome to AI Assistant 1.0.4",
                text: "We've upgraded your workspace! Now featuring File Conversion, Sidebar Controls, and more."
            },
            {
                element: document.getElementById('sidebar-compare-btn'),
                title: "Compare Mode",
                text: "Chat with up to 3 AIs simultaneously to cross-reference answers.",
                position: 'right'
            },
            {
                element: document.querySelector('.browser-mode'),
                title: "Quick Browser",
                text: "A built-in web browser for fast searches without leaving the app.",
                position: 'right'
            },


            {
                element: document.querySelector('.add-ai-btn'),
                title: "Add Custom AIs",
                text: "Add any website or AI tool to your sidebar here.",
                position: 'right'
            },
            {
                element: document.getElementById('btn-settings-app'),
                title: "Settings & Visibility",
                text: "Manage your AIs and <b>toggle sidebar features</b> (like the Board or Browser) on/off.",
                position: 'top'
            },
            {
                element: document.getElementById('toggle-top'),
                title: "Pin Window",
                text: "Keep this window floating above your work.",
                position: 'top'
            }
        ];
        
        // Filter out steps for missing elements (e.g. if disabled in settings)
        const steps = rawSteps.filter(s => s.element !== undefined); // Allow explicit null (Welcome step)


        let currentStep = 0;

        function endTour() {
            const tourContainer = document.getElementById('tour-container');
            if(tourContainer) tourContainer.innerHTML = '';
            localStorage.setItem(TOUR_VERSION_KEY, currentVersion); // Use correct key
             steps.forEach(s => { if(s.element) s.element.classList.remove('tour-highlight'); });
        }

        function showStep(index) {
            if (index >= steps.length) {
                endTour();
                return;
            }

            const step = steps[index];
            const tourContainer = document.getElementById('tour-container');
            if(!tourContainer) return;
            
            tourContainer.innerHTML = ''; // Clear previous

            // Overlay
            const overlay = document.createElement('div');
            overlay.className = 'tour-overlay';
            tourContainer.appendChild(overlay);

            // Highlight
            if (step.element) {
                step.element.classList.add('tour-highlight');
            }

            // Tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'tour-tooltip';
            tooltip.innerHTML = `
                <h4>${step.title}</h4>
                <p>${step.text}</p>
                <div class="tour-actions">
                    <button class="tour-btn tour-btn-skip">Skip</button>
                    <button class="tour-btn tour-btn-next">${index === steps.length - 1 ? 'Finish' : 'Next'}</button>
                </div>
            `;

            tourContainer.appendChild(tooltip); // Append first
            
            if (step.element) {
                const rect = step.element.getBoundingClientRect();
                
                if (step.position === 'top') {
                     // Above element
                     let contentHeight = 150; 
                     tooltip.style.top = (rect.top - contentHeight) + 'px';
                     tooltip.style.left = rect.left + 'px';
                     if (rect.top < 160) {
                         tooltip.style.top = (rect.bottom + 10) + 'px'; 
                     }
                } else {
                    // Right side
                    tooltip.style.left = (rect.right + 15) + 'px';
                    if (rect.top > window.innerHeight / 2) {
                        tooltip.style.bottom = (window.innerHeight - rect.bottom) + 'px';
                        tooltip.style.top = 'auto';
                    } else {
                        tooltip.style.top = rect.top + 'px';
                        tooltip.style.bottom = 'auto';
                    }
                }
            } else {
                // Center
                tooltip.style.top = '50%';
                tooltip.style.left = '50%';
                tooltip.style.transform = 'translate(-50%, -50%)';
            }

            // Events
            const nextBtn = tooltip.querySelector('.tour-btn-next');
            const skipBtn = tooltip.querySelector('.tour-btn-skip');
            
            if(nextBtn) nextBtn.addEventListener('click', () => {
                if (step.element) step.element.classList.remove('tour-highlight');
                showStep(index + 1);
            });

            if(skipBtn) skipBtn.addEventListener('click', () => {
                if (step.element) step.element.classList.remove('tour-highlight');
                endTour();
            });
        }

        // Auto Logic
        console.log(`Tour Debug: Current=${currentVersion}, Saved=${savedVersion}`);
        
        if (!savedVersion || savedVersion !== currentVersion) {
            console.log('Tour Triggering (Version Mismatch or New User)');
            // New version detected, trigger tour
            showStep(0);
        } else {
            console.log('Tour Skipped (Version Matches)');
        }
        
        // Manual Logic (attached here because we need closure over showStep/steps/currentVersion)
        const replayBtn = document.getElementById('replay-tour-btn');
        if(replayBtn) {
            replayBtn.onclick = () => {
                 localStorage.removeItem(TOUR_VERSION_KEY); // Correct key
                 showStep(0);
                 const settingsModal = document.getElementById('modal-settings-app'); 
                 if(settingsModal) settingsModal.classList.add('hidden');
            };
        }
    }

    // ===== Context Send Feature =====
    
    // Listen for context send trigger from main process
    // Listen for context send trigger from main process
    window.electronAPI.onContextSendTriggered((text) => {
        console.log('Renderer received context send:', text);
        
        if (!text || text.trim().length === 0) {
            console.warn('No text in clipboard');
            // Show helpful message
            alert('No text found in clipboard!\n\nPlease:\n1. Select text\n2. Copy it (Ctrl+C)\n3. Press Ctrl+Shift+C');
            return;
        }
        
        currentContextText = text.trim();
        
        // Handle Compare Mode Multicast
        if (isCompareActive && typeof compareWebviews !== 'undefined' && compareWebviews.length > 0) {
             const checkboxes = document.querySelectorAll('#ai-toggles input[type="checkbox"]');
             // Default to all if checkboxes not found or just use webviews 
             // Logic: Only send to visible/checked ones
             
             let sentCount = 0;
             checkboxes.forEach(cb => {
                 if (cb.checked) {
                     const index = parseInt(cb.value);
                     if (compareWebviews[index]) {
                         injectTextIntoWebview(compareWebviews[index], currentContextText);
                         sentCount++;
                     }
                 }
             });
             
             // Fallback if no checkboxes logic (e.g. init issue): send to all
             if (sentCount === 0) {
                 compareWebviews.forEach(wv => injectTextIntoWebview(wv, currentContextText));
             }
             
             return;
        }

        // Standard Single View Injection
        injectTextIntoActiveAI(currentContextText);
        currentContextText = '';
    });

    // Show context menu
    function showContextMenu(text) {
        // Show preview (truncated)
        const previewText = text.length > 50 ? text.substring(0, 50) + '...' : text;
        contextPreview.textContent = previewText;
        
        contextMenu.classList.remove('hidden');
    }

    // Hide context menu
    function hideContextMenu() {
        contextMenu.classList.add('hidden');
        currentContextText = '';
    }

    // Handle context action
    function handleContextAction(action) {
        if (!currentContextText) return;
        
        let finalText = '';
        
        switch(action) {
            case 'explain':
                finalText = `Explain this:\n\n${currentContextText}`;
                break;
            case 'fix':
                finalText = `Fix the bug in this code:\n\n${currentContextText}`;
                break;
            case 'summarize':
                finalText = `Summarize this:\n\n${currentContextText}`;
                break;
            case 'send':
                finalText = currentContextText;
                break;
        }
        
        injectTextIntoActiveAI(finalText);
        hideContextMenu();
    }

    // Inject text into active AI's input field
    function injectTextIntoActiveAI(text) {
        const activeWebview = getActiveWebview();
        if (!activeWebview) {
            console.error('No active webview');
            return;
        }
        
        // Get current URL to determine AI
        const currentUrl = activeWebview.src;
        let domain;
        try {
            domain = new URL(currentUrl).hostname;
        } catch (e) {
            console.error('Invalid URL:', currentUrl);
            return;
        }
        
        // Determine selector based on domain
        // Strategy: Use specific selectors first, but ALWAYS append fallback default selectors
        // This ensures if a specific ID changes (e.g. ChatGPT update), we still try generic textareas
        
        let specificSelector = '';
        for (const [key, val] of Object.entries(AI_INPUT_SELECTORS)) {
            if (domain.includes(key) && key !== 'default') {
                specificSelector = val;
                break;
            }
        }
        
        // Combine specific + default
        // If specific is empty, just use default. If match, use "specific, default"
        let finalSelector = specificSelector 
            ? `${specificSelector}, ${AI_INPUT_SELECTORS['default']}`
            : AI_INPUT_SELECTORS['default'];
        
        console.log(`Injecting into ${domain} using selectors: ${finalSelector}`);

        // Escape text for safety
        const safeText = JSON.stringify(text); // Adds quotes and escapes

        // Construct script
        const script = `
            (() => {
                const selectors = ${JSON.stringify(finalSelector)}.split(',');
                let input = null;
                
                // Try to find the input element
                for (const s of selectors) {
                    const el = document.querySelector(s.trim());
                    if (el) {
                        input = el;
                        break;
                    }
                }
                
                if (!input) return false;
                
                // Focus and set value
                input.focus();
                
                // Handle different input types
                if (input.isContentEditable) {
                    input.innerText = ${safeText};
                } else {
                    input.value = ${safeText};
                }
                
                // Trigger input events to wake up React/Frameworks
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Enter key (optional, maybe user wants to review first?)
                // For 'send' action we might want to submit, but let's just fill for now.
                
                return true;
            })();
        `;
        
        activeWebview.executeJavaScript(script)
            .then(success => {
                if (success) console.log('Injection successful');
                else console.warn('Injection failed: Input not found');
            })
            .catch(err => {
                console.error('Injection error:', err);
            });
    }

    // Event listeners for context menu
    closeContextMenu.addEventListener('click', hideContextMenu);
    
    contextActions.forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            handleContextAction(action);
        });
    });
    
    // Keyboard shortcuts for context menu (1-4 and Esc)
    document.addEventListener('keydown', (e) => {
        if (!contextMenu.classList.contains('hidden')) {
            if (e.key === '1') handleContextAction('explain');
            else if (e.key === '2') handleContextAction('fix');
            else if (e.key === '3') handleContextAction('summarize');
            else if (e.key === '4') handleContextAction('send');
            else if (e.key === 'Escape') hideContextMenu();
        }
    });

    // (Duplicate Incognito logic removed)
    
    if (quickClearCookiesBtn) {
        quickClearCookiesBtn.addEventListener('click', async () => {
            const activeWebview = getActiveWebview();
            if (!activeWebview || activeWebview.src === 'about:blank') {
                alert('No AI loaded. Please select an AI first.');
                return;
            }
            
            const currentUrl = activeWebview.src;
            const confirm = window.confirm(`Clear cookies for ${new URL(currentUrl).hostname}?\n\nThis will sign you out of this AI.`);
            
            if (confirm) {
                try {
                    const success = await window.electronAPI.clearAISession(currentUrl);
                    if (success) {
                        activeWebview.reload();
                        alert('Cookies cleared! Page reloaded.');
                    } else {
                        alert('Failed to clear cookies.');
                    }
                } catch (err) {
                    console.error('Clear cookies error:', err);
                    alert('Error clearing cookies.');
                }
            }
        });
    }


    
    // Listen for AI switch commands from main process
    if (window.electronAPI) {
        window.electronAPI.onSwitchToAIIndex((index) => {
            console.log(`Switching to AI at index: ${index}`);
            if (index < currentAIs.length) {
                const ai = currentAIs[index];
                const aiButtons = document.querySelectorAll('.ai-item:not(.browser-mode)');
                const targetButton = aiButtons[index];
                if (targetButton) {
                    activateAI(targetButton, ai.url, false);
                    targetButton.classList.add('flash-highlight');
                    setTimeout(() => targetButton.classList.remove('flash-highlight'), 500);
                }
            }
        });
        
        window.electronAPI.onToggleCompareMode(() => {
             // Toggle Compare Mode
             if (isCompareActive) {
                 // Exit
                 const firstAI = currentAIs[0];
                 const aiButtons = document.querySelectorAll('.ai-item:not(.browser-mode)');
                 if (firstAI && aiButtons[0]) {
                     activateAI(aiButtons[0], firstAI.url);
                 }
             } else {
                 // Enter
                 const btn = document.getElementById('sidebar-compare-btn'); // Assuming there might be one, or just pass null
                 toggleComparePane(btn);
             }
        });


    }


    // Start Tour Logic
    setTimeout(initTour, 1000);

    // ============================================
    // AUTH STATE MANAGEMENT (SINGLE SOURCE OF TRUTH)
    // ============================================
    
    // Global auth state - THIS is the only thing we check
    window.appAuth = {
        loggedIn: false,
        token: null
    };
    
    // Load auth state on startup
    function loadAuthState() {
        const token = localStorage.getItem('app_token');
        if (token) {
            window.appAuth.loggedIn = true;
            window.appAuth.token = token;
            console.log('[Auth] App authenticated - token found');
        } else {
            window.appAuth.loggedIn = false;
            window.appAuth.token = null;
            console.log('[Auth] App not authenticated - no token');
        }
    }
    
    // Load auth state immediately
    loadAuthState();
    
    // ============================================
    // OAUTH CALLBACK HANDLERS
    // ============================================
    
    // Listen for successful OAuth from main process
    if (window.electronAPI && window.electronAPI.onAuthSuccess) {
        window.electronAPI.onAuthSuccess((token) => {
            console.log('[OAuth] Token received from main process');
            
            // Store token securely
            localStorage.setItem('app_token', token);
            
            // Update global auth state
            window.appAuth.loggedIn = true;
            window.appAuth.token = token;
            
            // Show success message
            showToast('✅ Successfully logged in!');
            
            // Reload active webview to apply login
            const activeWv = getActiveWebview();
            if (activeWv) {
                activeWv.reload();
            }
        });
    }
    
    // Listen for OAuth errors
    if (window.electronAPI && window.electronAPI.onAuthError) {
        window.electronAPI.onAuthError((error) => {
            console.error('[OAuth] Error from main process:', error);
            showToast('❌ Login failed. Please try again.');
        });
    }


    // ============================================
    // COMPARE MODE LOGIC
    // ============================================
    
    // Elements
    const comparePane = document.getElementById('pane-compare');
    const compareInput = document.getElementById('compare-input');
    const compareSendBtn = document.getElementById('compare-send-btn');
    const syncScrollToggle = document.getElementById('sync-scroll-toggle');
    const compareGrid = document.getElementById('compare-grid');
    const aiTogglesContainer = document.getElementById('ai-toggles');
    
    // Dynamic State
    let compareWebviews = []; 
    let isCompareActive = false;
    let isSyncScrollEnabled = true;

    // AI Color Helper
    function getAIColor(name) {
        const n = name.toLowerCase();
        if (n.includes('chatgpt')) return '#10a37f';
        if (n.includes('gemini')) return '#4b8bf5';
        if (n.includes('claude')) return '#d97757';
        if (n.includes('perplexity')) return '#22bfa5';
        if (n.includes('deepseek')) return '#4e61e6';
        if (n.includes('copilot')) return '#6f7ef7';
        if (n.includes('llama')) return '#fba01d';
        
        // Hash for random consistent color
        let hash = 0;
        for (let i = 0; i < n.length; i++) {
            hash = n.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    }

    // Persist Preferences
    function saveComparePrefs() {
        const checkboxes = document.querySelectorAll('#ai-toggles input[type="checkbox"]');
        const selectedIndices = [];
        checkboxes.forEach(cb => {
            if (cb.checked) selectedIndices.push(parseInt(cb.value));
        });
        
        const prefs = {
            selectedIndices,
            syncScroll: isSyncScrollEnabled
        };
        localStorage.setItem('compare_prefs', JSON.stringify(prefs));
    }

    // Render Dynamic Compare Grid
    function renderCompareView() {
        if (!compareGrid || !aiTogglesContainer) return;
        
        compareGrid.innerHTML = '';
        aiTogglesContainer.innerHTML = '';
        compareWebviews = []; // Reset references
        
        // Load Prefs
        let prefs = null;
        try {
            prefs = JSON.parse(localStorage.getItem('compare_prefs'));
        } catch (e) {}
        
        // Restore Sync Scroll State from prefs or default true
        if (prefs) {
            isSyncScrollEnabled = prefs.syncScroll;
            if (syncScrollToggle) syncScrollToggle.checked = isSyncScrollEnabled;
        } else {
             // Default
             isSyncScrollEnabled = true; 
             if (syncScrollToggle) syncScrollToggle.checked = true;
        }

        currentAIs.forEach((ai, index) => {
            // 1. Column Creation
            const col = document.createElement('div');
            col.className = 'ai-column';
            col.id = `col-${index}`;
            
            const color = getAIColor(ai.name);
            
            // Visibility Logic
            let isActive = false;
            
            if (prefs && prefs.selectedIndices) {
                // Use Saved
                isActive = prefs.selectedIndices.includes(index);
            } else {
                // Default: First 3
                isActive = index < 3;
            }

            if (!isActive) {
                col.classList.add('hidden');
                col.style.display = 'none';
            }
            
            col.innerHTML = `
                <div class="ai-col-header" style="border-top: 2px solid ${color};">
                    <div class="ai-badge" style="background-color: ${color};">${ai.name}</div>
                    <span class="response-time hidden" id="time-${index}">0.0s</span>
                </div>
                <webview 
                    id="wv-compare-${index}" 
                    src="${ai.url}" 
                    partition="persist:ai_session_v2" 
                    useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0"
                ></webview>
            `;
            compareGrid.appendChild(col);
            
            // Store reference
            const wv = col.querySelector('webview');
            compareWebviews.push(wv);
            setupWebviewListeners(wv); // Added to track loading progress in footer
            
            // 2. Toggle Creation
            const label = document.createElement('label');
            // Add a small colored dot to toggle too
            const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${color};margin-right:4px;"></span>`;
            
            label.innerHTML = `<input type="checkbox" value="${index}" ${isActive ? 'checked' : ''}> ${dot} ${ai.name}`;
            aiTogglesContainer.appendChild(label);
            
            // Toggle Logic
            const cb = label.querySelector('input');
            cb.addEventListener('change', () => {
                // Max 3 Limit Check
                const checkedCount = document.querySelectorAll('#ai-toggles input:checked').length;
                if (checkedCount > 3) {
                    cb.checked = false; // Revert
                    alert("Max 3 AIs in Compare Mode.");
                    return;
                }
                
                // Toggle Visibility
                if (cb.checked) {
                    col.classList.remove('hidden');
                    col.style.display = 'flex';
                } else {
                    col.classList.add('hidden');
                    col.style.display = 'none';
                }
                
                // Save State
                saveComparePrefs();
            });
        });
        
        // Setup Sync Scroll for new webviews
        setupSyncScrollListeners();
    }
    
    // Call on Init
    // We defer slightly to ensure 'currentAIs' is populated if loaded async, 
    // but here it's likely already loaded by main execution flow or loadAIs().
    setTimeout(renderCompareView, 500); 

    // Toggle Compare Mode
    function toggleComparePane(btnElement) {
        collapseSidebar(); // Auto-Collapse
        // 1. Deactivate other sidebar items
        document.querySelectorAll('.ai-item').forEach(i => i.classList.remove('active'));
        if (btnElement) btnElement.classList.add('active');
        
        // 2. Hide other views
        const wvContainer = document.getElementById('webview-container');
        if (wvContainer) wvContainer.classList.add('hidden');
        
        if (pane1) pane1.classList.add('hidden');
        if (pane2) pane2.classList.add('hidden');
        if (actionPane) actionPane.classList.add('hidden');

        
        // 3. Show Compare Pane
        if (comparePane) comparePane.classList.remove('hidden');
        if (browserToolbar) browserToolbar.classList.add('hidden');
        
        isCompareActive = true;
        isBrowserMode = false;
    }
    

    
    // Handle Compare Submit
    function handleCompareSubmit() {
        const text = compareInput.value.trim();
        if (!text) return;
        
        // Check active generated toggles
        const checkboxes = document.querySelectorAll('#ai-toggles input[type="checkbox"]');
        const indicesToTarget = [];
        checkboxes.forEach(cb => {
            if (cb.checked) indicesToTarget.push(parseInt(cb.value));
        });
        
        if (indicesToTarget.length === 0) {
            alert('Select at least one AI to compare.');
            return;
        }
        
        console.log(`Sending to Compare AIs [${indicesToTarget.join(',')}]: ${text}`);
        
        // Dispatch to selected webviews
        indicesToTarget.forEach(index => {
            if (index >= 0 && index < compareWebviews.length) {
                const wv = compareWebviews[index];
                if (wv) injectTextIntoWebview(wv, text);
            }
        });
        
        compareInput.value = '';
    }
    
    // Reuse injection logic but customized for generic webview
    function injectTextIntoWebview(wv, text) {
        // We reuse the valid selectors logic from `injectTextIntoActiveAI` but need to adapt it 
        // since that function uses `getActiveWebview()`.
        
        const currentUrl = wv.src;
        let domain;
        try { domain = new URL(currentUrl).hostname; } catch(e) { return; }
        
        let specificSelector = '';
        for (const [key, val] of Object.entries(AI_INPUT_SELECTORS)) {
            if (domain.includes(key) && key !== 'default') {
                specificSelector = val;
                break;
            }
        }
        
        let finalSelector = specificSelector 
            ? `${specificSelector}, ${AI_INPUT_SELECTORS['default']}`
            : AI_INPUT_SELECTORS['default'];
            
        const safeText = JSON.stringify(text);
        
        const script = `
            (() => {
                const selectors = ${JSON.stringify(finalSelector)}.split(',');
                let input = null;
                for (const s of selectors) {
                    const el = document.querySelector(s.trim());
                    if (el) { input = el; break; }
                }
                
                if (!input) return false;
                
                input.focus();
                
                 if (input.isContentEditable) {
                    input.innerText = ${safeText};
                } else {
                    input.value = ${safeText};
                }
                
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Wait a moment for UI to update (react state etc)
                setTimeout(() => {
                    // 1. Try Enter Key
                    const enterEvent = new KeyboardEvent('keydown', {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true,
                        cancelable: true
                    });
                    input.dispatchEvent(enterEvent);
                    
                    // 2. Try Generic Send Button (Fallback)
                    // Common selectors for send buttons
                    const btnSelectors = [
                        'button[data-testid="send-button"]', 
                        'button[aria-label="Send message"]',
                        'button[aria-label="Send"]',
                        '.send-button',
                        'button[type="submit"]'
                    ];
                    
                    for (const s of btnSelectors) {
                        const btn = document.querySelector(s);
                        if (btn && !btn.disabled) {
                            btn.click();
                            break; 
                        }
                    }
                }, 100);
                
                return true;
            })();
        `;
        
        wv.executeJavaScript(script).catch(err => console.error('Compare Injection Error:', err));
    }

    // AI Selection / Toggle Visibility
    const aiToggles = document.querySelectorAll('.ai-toggles input[type="checkbox"]');
    aiToggles.forEach(cb => {
        cb.addEventListener('change', () => {
            const index = parseInt(cb.value);
            const col = document.getElementById(`col-${index + 1}`);
            if (col) {
                if (cb.checked) {
                    col.classList.remove('hidden');
                    col.style.display = 'flex'; // Ensure flex restore
                } else {
                    col.classList.add('hidden');
                    col.style.display = 'none';
                }
            }
        });
    });

    // Sync Scroll Logic
    if (syncScrollToggle) {
        syncScrollToggle.addEventListener('change', (e) => {
            isSyncScrollEnabled = e.target.checked;
            saveComparePrefs(); // Save on toggle
        });
    }

    // Initialize Sync Scroll Listeners
    function setupSyncScrollListeners() {
        // Prevent Adding duplicate listeners if called multiple times (we clear webviews array on render)
        // But the event listeners attached to DOM elements (if recycled) might persist. 
        // Since we clear `compareGrid.innerHTML`, we get fresh webviews every time. 
        
        compareWebviews.forEach((wv, index) => {
            if (!wv) return;
            
            // 1. Inject Scroll Broadcaster
            // Using capture: true to catch inner scrolls (essential for SPAs)
            const script = `
                (() => {
                    let lastScroll = 0;
                    let lastTime = 0;
                    
                    window.addEventListener('scroll', (e) => {
                       const now = Date.now();
                       if (now - lastTime < 50) return; // Throttle 50ms
                       lastTime = now;

                       // Find the scrolling element
                       const target = e.target; 
                       // Check if it's the document or a specific element
                       const el = target === document ? document.documentElement : target;
                       
                       // We only care about vertical scroll
                       if (!el.scrollHeight) return;

                       const s = el.scrollTop || window.scrollY;
                       const h = (el.scrollHeight || document.documentElement.scrollHeight) - (el.clientHeight || window.innerHeight);
                       
                       if (h <= 0) return;
                       
                       const pct = s / h;
                       
                       // Only broadcast significant changes (>1%)
                       if (Math.abs(pct - lastScroll) > 0.01) {
                           lastScroll = pct;
                           // Use distinct prefix
                           console.log('__SYNC_SCROLL__:' + pct);
                       }
                    }, { capture: true, passive: true });
                })();
            `;
            
            const inject = () => {
                if (wv && wv.executeJavaScript) {
                    wv.executeJavaScript(script).catch(() => {});
                }
            };
            
            // robust injection hooks
            wv.addEventListener('dom-ready', inject);
            wv.addEventListener('did-finish-load', inject);
            // Try immediately if looks ready
            setTimeout(inject, 500); 
            
            // 2. Listen for 'console-message'
            wv.addEventListener('console-message', (e) => {
                if (!isSyncScrollEnabled) return;
                if (!e.message.startsWith('__SYNC_SCROLL__:')) return;
                
                const pct = parseFloat(e.message.split(':')[1]);
                if (isNaN(pct)) return;
                
                // Propagate to OTHERS
                compareWebviews.forEach((otherWv, otherIndex) => {
                    if (otherIndex !== index && otherWv) {
                        // Check visibility
                        if (otherWv.offsetParent === null) return;

                        // Scroll the main document AND generic large containers
                        try {
                             otherWv.executeJavaScript(`
                                 (() => {
                                     // 1. Scroll Window/Body
                                     const h = document.documentElement.scrollHeight - window.innerHeight;
                                     if (h > 0) window.scrollTo({ top: h * ${pct}, behavior: 'auto' });
                                     
                                     // 2. Scroll largest scrollable container (Heuristic for SPAs)
                                     // Find all scrollable divs
                                     const divs = document.querySelectorAll('div, main, section');
                                     let maxArea = 0;
                                     let bestEl = null;
                                     
                                     for (const el of divs) {
                                         if (el.scrollHeight > el.clientHeight && el.clientHeight > 300) {
                                             const area = el.clientWidth * el.clientHeight;
                                             if (area > maxArea) {
                                                 maxArea = area;
                                                 bestEl = el;
                                             }
                                         }
                                     }
                                     
                                     if (bestEl) {
                                         bestEl.scrollTop = (bestEl.scrollHeight - bestEl.clientHeight) * ${pct};
                                     }
                                 })();
                             `).catch(() => {});
                        } catch(err) {}
                    }
                });
            });
        });
    }
    



    
    // Listeners
    if (compareSendBtn) {
        compareSendBtn.addEventListener('click', handleCompareSubmit);
    }
    if (compareInput) {
        compareInput.addEventListener('keydown', (e) => {
             if (e.key === 'Enter') handleCompareSubmit();
        });
    }

    // ============================================
    // AI ACTION MODE LOGIC (Legacy - Keeping placeholder or clean?)
    // Request said "Compare Mode implementation", user previously removed Action Mode.
    // We can place it before or after.
    // ============================================
    
    // References
    const actionModeBtn = document.getElementById('sidebar-action-btn');
    const actionPane = document.getElementById('pane-action');
    
    // Step Elements
    const stepTarget = document.getElementById('step-target');
    const stepInput = document.getElementById('step-input');
    
    // Controls
    const appCards = document.querySelectorAll('.app-card');
    const currentTargetName = document.getElementById('current-target-name');
    const changeTargetBtn = document.getElementById('change-target-btn');
    const actionInput = document.getElementById('action-input');
    const sendActionBtn = document.getElementById('send-action-btn');
    const chatMessages = document.getElementById('chat-messages');
    
    // State
    // let currentActionTarget = null; // Already declared above


    // Helper: Trigger Action Mode (Called from Sidebar)
    function triggerActionMode(btnElement) {
         // 1. Deactivate other sidebar items
         document.querySelectorAll('.ai-item').forEach(i => i.classList.remove('active'));
         if (btnElement) btnElement.classList.add('active');
         
         // 2. Show Action Pane
         if (pane1) pane1.classList.add('hidden');
         if (pane2) pane2.classList.add('hidden');
         if (actionPane) actionPane.classList.remove('hidden');

         
         // Hide browser toolbar if visible
         if (browserToolbar) browserToolbar.classList.add('hidden');
         
         isBrowserMode = false;
    }
    
    // We also need to make sure regular AI activation hides action pane
    // Update the original activateAI function logic essentially by ensuring 
    // when we click other items, we revert the view.
    // The activateAI function handles setting active class, but doesn't handle hiding actionPane.
    // Let's hook into the global activateAI? 
    // Better: We add the 'hide action pane' logic to activateAI in the next step or patch it now if possible.
    // Actually, I can just modify activateAI above, or since I can't request multiple edits easily out of order...
    // I will use a MutationObserver or just accept that I need to edit `activateAI` separately.
    // OR: I can just attach a listener to `aiListContainer` that delegates clicks?
    // No, individual listeners are attached in `renderSidebar`.
    // I'll update `activateAI` via `replace_file_content` in a separate call or same turn.
    
    // Target Selection
    appCards.forEach(card => {
        card.addEventListener('click', () => {
            // Visual
            appCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            // Logic
            currentActionTarget = card.dataset.target;
            const appName = card.querySelector('.app-name').innerText;
            
            // Advance Step
            stepTarget.classList.add('hidden');
            stepInput.classList.remove('hidden');
            
            if (currentTargetName) currentTargetName.innerText = appName;
            
            // Add initial system message
            appendChatMessage('system', `Ready to control ${appName}. What shall we do?`);
            
            // Focus input
            if(actionInput) setTimeout(() => actionInput.focus(), 100);
        });
    });
    
    // Change Target
    if (changeTargetBtn) {
        changeTargetBtn.addEventListener('click', () => {
            stepInput.classList.add('hidden');
            stepTarget.classList.remove('hidden');
            // Clear history? maybe keep it.
        });
    }
    
    // Send Action
    function handleSendAction() {
        if (!actionInput) return;
        const text = actionInput.value.trim();
        if (!text) return;
        
        if (!currentActionTarget) {
            alert('Please select a target app first.');
            return;
        }
        
        // 1. Show User Message
        appendChatMessage('user', text);
        actionInput.value = '';
        
        // 2. Show "Thinking" state
        const loadingId = appendChatMessage('system', 'Thinking...');
        
        // 3. Send to Backend
        if (window.electronAPI && window.electronAPI.executeAIAction) {
            window.electronAPI.executeAIAction(currentActionTarget, text)
                .then(response => {
                    // Remove loading
                    const loadingMsg = document.getElementById(loadingId);
                    if (loadingMsg) loadingMsg.remove();
                    
                     if (response.success) {
                        if (response.isChat) {
                             appendChatMessage('system', response.message);
                        } else if (response.isActionPreview) {
                             // --- PROPOSAL / PREVIEW ---
                             const previewId = 'preview-' + Date.now();
                             
                             // Store plan globally to avoid specific escaping hell in HTML attributes
                             if (!window.pendingPlans) window.pendingPlans = {};
                             window.pendingPlans[previewId] = { target: response.target, plan: response.plan };

                             const previewHtml = `
                                <div class="action-preview" style="background:#222; border:1px solid #444; padding:12px; border-radius:8px; margin-top:8px;" id="${previewId}">
                                    <h4 style="margin:0 0 8px 0; color:#fff; font-size:14px;">Proposed Action</h4>
                                    <div style="font-family:monospace; font-size:12px; color:#aaa; margin-bottom:12px; white-space:pre-wrap; max-height:100px; overflow:auto;">
                                        ${JSON.stringify(response.plan, null, 2)}
                                    </div>
                                    <div style="display:flex; gap:8px;">
                                        <button onclick="window.confirmAction('${previewId}')" style="background:#10a37f; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Confirm & Execute</button>
                                        <button onclick="document.getElementById('${previewId}').remove(); delete window.pendingPlans['${previewId}'];" style="background:#444; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Cancel</button>
                                    </div>
                                </div>
                             `;
                             appendChatMessage('system', `I have a plan. Shall I proceed? ${previewHtml}`);
                        } else {
                             // Direct Execution (Legacy/Fallback)
                             appendChatMessage('system', `✅ Action executed successfully!`);
                        }
                    } else {
                        appendChatMessage('system', `❌ Error: ${response.message || 'Unknown error'}`);
                    }
                })
                .catch(err => {
                    const loadingMsg = document.getElementById(loadingId);
                    if (loadingMsg) loadingMsg.remove();
                    appendChatMessage('system', `❌ System Error: ${err.message}`);
                });
        }
    }

    // Global function for the confirm button
    window.confirmAction = (elementId) => {
        const entry = window.pendingPlans[elementId];
        if (!entry) {
            alert("Error: Plan not found.");
            return;
        }

        const { target, plan } = entry;
        
        // Disable button
        const btn = document.querySelector(`#${elementId} button`);
        if(btn) btn.innerText = "Executing...";

        window.electronAPI.confirmAIAction(target, plan)
            .then(res => {
                if (res.success) {
                     const el = document.getElementById(elementId);
                     if(el) el.innerHTML = `<div style="color:#10a37f;">✅ Executed!</div>`;
                } else {
                     alert("Execution Failed: " + res.message);
                     if(btn) btn.innerText = "Confirm & Execute"; // Reset
                }
                // Cleanup
                delete window.pendingPlans[elementId];
            });
    };
    
    if (sendActionBtn) {
        sendActionBtn.addEventListener('click', handleSendAction);
    }
    
    if (actionInput) {
        actionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendAction();
            }
        });
    }
    
    // Helper: Append Chat Message
    function appendChatMessage(role, htmlContent) {
        if (!chatMessages) return;
        
        const div = document.createElement('div');
        div.className = `message ${role}`;
        div.id = 'msg-' + Date.now();
        div.innerHTML = htmlContent;
        
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        return div.id;
    }

    // ============================================
    // ONBOARDING TOUR
    // ============================================
    
    // Initialize tour (triggers on first install or version update)
    initTour();

    // ============================================

    


    // ============================================
    // PUSH UPDATES (AUTO UPDATER UI)
    // ============================================
    if (window.electronAPI) {
            const updateBanner = document.getElementById('update-banner');
            const updateVersionText = document.getElementById('update-version-text');
            const updateNowBtn = document.getElementById('update-now');
            const updateLaterBtn = document.getElementById('update-later');
            const updateViewNotesBtn = document.getElementById('update-view-notes');
            const updateWarning = document.getElementById('update-warning');
            const updateProgressContainer = document.getElementById('update-progress-container');
            const updateProgressBar = document.getElementById('update-progress-bar');
            const updateProgressText = document.getElementById('update-progress-text');

            let latestUpdateInfo = null;

            // Update Available
            // [REMOVED] Old listener causing duplicates. See Global handler at bottom of file.
            // window.electronAPI.onUpdateAvailable((info) => { ... });

            // Update Error
            window.electronAPI.onUpdateError((message) => {
                console.error('Renderer: Update error', message);
                // Suppress toast for common "not an error" situations
                if (message && message.includes('No published versions on GitHub')) {
                    console.info('Updater: No releases found on GitHub yet (expected if in draft).');
                    return;
                }
                showToast(`Update error: ${message}`);
            });

            // Download Progress
            // [REMOVED] Old listener
            // window.electronAPI.onDownloadProgress((progress) => { ... });

            // Update Downloaded
            // [REMOVED] Old listener
            // window.electronAPI.onUpdateDownloaded((info) => { ... });

            // Button Listeners
            if (updateNowBtn) {
                updateNowBtn.addEventListener('click', async () => {
                    if (updateNowBtn.textContent === 'Restart & Install') {
                        window.electronAPI.quitAndInstall();
                    } else {
                        // Show SmartScreen Warning
                        if (updateWarning) updateWarning.classList.remove('hidden');
                        
                        // Start Download
                        updateNowBtn.textContent = 'Downloading...';
                        updateNowBtn.disabled = true;
                        window.electronAPI.startDownloadUpdate();
                    }
                });
            }

            if (updateLaterBtn) {
                updateLaterBtn.addEventListener('click', () => {
                    if (updateBanner) updateBanner.classList.add('hidden');
                });
            }

            if (updateViewNotesBtn) {
                updateViewNotesBtn.addEventListener('click', () => {
                    if (latestUpdateInfo && latestUpdateInfo.releaseNotes) {
                        // For now, just show a message or open browser
                        alert(`Release Notes:\n${latestUpdateInfo.releaseNotes}`);
                    } else if (latestUpdateInfo) {
                        // Fallback: Open GitHub release page
                        const repoUrl = "https://github.com/ankit3890/AI-Floating-Assistant/releases";
                        window.electronAPI.openExternal(repoUrl);
                    }
                });
            }

            // Quick Refresh Button
            const quickRefreshBtn = document.getElementById('quick-refresh-btn');
            if (quickRefreshBtn) {
                quickRefreshBtn.addEventListener('click', () => {
                   const wv = getActiveWebview();
                   if (wv) {
                       wv.reload();
                   } else if (isCompareActive) {
                       // Reload all compare webviews
                       compareWebviews.forEach(w => { if(w) w.reload() });
                   }
                });
            }

            // Settings Modal: Check Update & GitHub Buttons
            const checkUpdatesBtn = document.getElementById('check-updates-btn');
            const openGithubBtn = document.getElementById('open-github-btn');

            if (checkUpdatesBtn) {
                checkUpdatesBtn.addEventListener('click', () => {
                    checkUpdatesBtn.textContent = 'Checking...';
                    checkUpdatesBtn.disabled = true;
                    // Trigger main process check. Global listeners at end of file handle the UI response.
                    window.isManualUpdateCheck = true;
                    
                    // Safety Timeout
                    const safetyTimeout = setTimeout(() => {
                        if (checkUpdatesBtn.textContent === 'Checking...') {
                            checkUpdatesBtn.textContent = 'Check Timed Out';
                            checkUpdatesBtn.disabled = false;
                            window.isManualUpdateCheck = false;
                            if(window.showToast) window.showToast("⚠️ Check timed out. Verify connection.");
                            else alert("Check timed out.");
                        }
                    }, 15000); // 15 seconds

                    window.electronAPI.checkForUpdates()
                        .then(result => {
                             if (result && result.throttled) {
                                 clearTimeout(safetyTimeout);
                                 checkUpdatesBtn.textContent = 'Check for Updates';
                                 checkUpdatesBtn.disabled = false;
                                 window.isManualUpdateCheck = false;
                                 if(window.showToast) window.showToast("⚠️ Checked recently. Please wait a minute.");
                                 else alert("Checked recently. Please wait a minute.");
                             }
                        })
                        .catch(err => {
                            clearTimeout(safetyTimeout);
                            console.error("Check failed:", err);
                            checkUpdatesBtn.textContent = 'Check Failed';
                            checkUpdatesBtn.disabled = false;
                            window.isManualUpdateCheck = false;
                            if(window.showToast) window.showToast("❌ Check failed: " + err.message);
                            else alert("Check failed: " + err.message);
                        });
                });
            }

            if (openGithubBtn) {
                openGithubBtn.addEventListener('click', () => {
                    window.electronAPI.openExternal("https://github.com/ankit3890/AI-Floating-Assistant/releases");
                });
            }
        }
    }
);

// ============================================
// GLOBAL AUTO UPDATER HANDLERS
// ============================================

(function setupGlobalUpdateHandlers() {
    let updateBanner = null;
    let isDownloading = false;

    function createUpdateBanner() {
        if(updateBanner && document.body.contains(updateBanner)) return updateBanner;
        
        const div = document.createElement('div');
        div.className = 'update-banner';
        // Dark theme card
        div.style.background = '#111';
        div.style.border = '1px solid #333';
        div.style.borderRadius = '12px';
        div.style.padding = '20px';
        div.style.color = '#fff';
        div.style.position = 'fixed';
        div.style.bottom = '20px';
        div.style.right = '20px'; // Bottom Right
        // div.style.left = '20px'; // Removed Left positioning
        div.style.width = '380px';
        div.style.zIndex = '9999';
        div.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
        div.style.fontFamily = 'Inter, sans-serif';
        div.style.animation = 'slideIn 0.3s ease-out';
        
        document.body.appendChild(div);
        
        if (!document.getElementById('update-anim-style')) {
            const style = document.createElement('style');
            style.id = 'update-anim-style';
            style.textContent = `@keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`;
            document.head.appendChild(style);
        }
        
        updateBanner = div;
        return div;
    }

    function resetButton() {
        const btn = document.getElementById('check-updates-btn');
        if (btn) {
            btn.textContent = 'Check for Updates';
            btn.disabled = false;
        }
    }

    // Toast Notification Helper
    window.showToast = function(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.position = 'fixed';
        toast.style.bottom = '30px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        toast.style.background = 'rgba(30, 30, 30, 0.95)';
        toast.style.color = '#fff';
        toast.style.padding = '12px 24px';
        toast.style.borderRadius = '50px';
        toast.style.fontSize = '14px';
        toast.style.fontWeight = '500';
        toast.style.zIndex = '10000';
        toast.style.boxShadow = '0 5px 15px rgba(0,0,0,0.4)';
        toast.style.border = '1px solid #444';
        toast.style.opacity = '0';
        toast.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
        toast.style.fontFamily = 'Inter, sans-serif';
        toast.style.pointerEvents = 'none'; // Click through
        
        document.body.appendChild(toast);
        
        // Animate in
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    };

    // ---------------- Update Modal ----------------
    // ---------------- Update Modal ----------------
    const updateModal = document.getElementById('modal-update');
    const updateVersionTag = document.getElementById('update-version-tag');

    const updateActions = document.getElementById('update-actions');
    const downloadBtn = document.getElementById('download-update-btn');
    const skipBtn = document.getElementById('skip-update-btn');
    const closeBtn = document.getElementById('close-update-modal');
    const notesBtn = document.getElementById('notes-update-btn'); // Preserved

    const progressView = document.getElementById('update-progress-view');
    const progressBar = document.getElementById('update-progress-bar');
    const progressPercent = document.getElementById('update-percent');

    const restartBtn = document.getElementById('restart-install-btn');

    // ---------- Helpers ----------
    function resetButton() {
        const btn = document.getElementById('check-updates-btn');
        if (btn) {
            btn.textContent = 'Check for Updates';
            btn.disabled = false;
        }
    }

    // Manual Check Listener
    const checkUpdatesBtn = document.getElementById('check-updates-btn');
    if (checkUpdatesBtn) {
        checkUpdatesBtn.addEventListener('click', () => {
             checkUpdatesBtn.textContent = 'Checking...';
             checkUpdatesBtn.disabled = true;
             window.isManualUpdateCheck = true;
             
             // Timeout fail-safe
             setTimeout(() => {
                 if (checkUpdatesBtn.textContent === 'Checking...') {
                      resetButton();
                 }
             }, 15000);

             window.electronAPI.checkForUpdates().catch(err => {
                 console.error("Manual check failed", err);
                 alert("Check failed: " + err.message);
                 resetButton();
             });
        });
    }

    function showUpdateModal() {
        if (updateModal) updateModal.classList.remove('hidden');
    }

    function hideUpdateModal() {
        if (updateModal) updateModal.classList.add('hidden');
    }

    function resetUpdateUI() {
        if (progressView) progressView.classList.add('hidden');
        if (restartBtn) restartBtn.classList.add('hidden');
        if (updateActions) updateActions.classList.remove('hidden');
        if (progressBar) progressBar.style.width = '0%';
        if (progressPercent) progressPercent.textContent = '0%';
    }

    // ---------- Button Actions ----------
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            if (updateActions) updateActions.classList.add('hidden');
            if (progressView) progressView.classList.remove('hidden');

            // Use optional chaining for safety if API not ready
            const res = await window.electronAPI.startDownloadUpdate?.();
            if (res && res.success === false) {
                alert(res.error || 'Failed to start download');
                resetUpdateUI();
            }
        });
    }

    if (skipBtn) skipBtn.addEventListener('click', hideUpdateModal);
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
             // Optional: Disable close if downloading? User didn't request valid locking yet.
             hideUpdateModal();
        });
    }
    
    if (notesBtn) {
        notesBtn.addEventListener('click', () => {
             window.electronAPI.openExternal("https://github.com/ankit3890/AI-Floating-Assistant/releases");
        });
    }

    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            window.electronAPI.quitAndInstall();
        });
    }

    // ---------- IPC Events ----------
    if (window.electronAPI) {
        window.electronAPI.onUpdateAvailable((info) => {
            resetUpdateUI();
            if (updateVersionTag) updateVersionTag.textContent = `v${info.version}`;
            showUpdateModal();
        });

    // --- Toast Notification System ---
    function showToast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '⚠️';
        
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        
        container.appendChild(toast);
        
        // Trigger reflow for animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if(container.contains(toast)) container.removeChild(toast);
            }, 300);
        }, 3000);
    }
    
    // Convert old global alert usage if any
    window.showToast = showToast;

    // ... (rest of feature loading)
    
    // ---------------------------------------------------------------------- 
    
    // ... (start of Document Ready) ...

    // ... (Skip to Update Logic) ...

        window.electronAPI.onUpdateNotAvailable((info) => {
            console.log('Update not available');
            resetButton();
            if (window.isManualUpdateCheck) {
                showToast(`Up to date (v${info.version})`, 'success');
                window.isManualUpdateCheck = false;
            }
        });

        window.electronAPI.onDownloadProgress((progress) => {
            const percent = Math.round(progress.percent || 0);
            if (progressBar) progressBar.style.width = `${percent}%`;
            if (progressPercent) progressPercent.textContent = `${percent}%`;
        });

        window.electronAPI.onUpdateDownloaded(() => {
            if (progressView) progressView.classList.add('hidden');
            if (restartBtn) restartBtn.classList.remove('hidden');
            showToast('Update downloaded. Ready to install.', 'success');
        });

        window.electronAPI.onUpdateError((err) => {
            showToast(err || 'Update failed', 'error');
            resetUpdateUI();
        });
        

    }
})();
