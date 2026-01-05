document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration & Constants ---
    
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
        planningBoard: true,
        fileConvert: true
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
    const collapseBtn = document.getElementById('collapse-btn');
    const bubbleView = document.getElementById('bubble-view');
    const expandBubbleBtn = document.getElementById('expand-btn');
    const bubblePill = document.querySelector('.bubble-pill');

    // Login Failure Modal Refs
    const loginFailedModal = document.getElementById('modal-login-failed');
    const closeLoginFailedModal = document.getElementById('close-login-failed-modal');
    const clearCacheRetryBtn = document.getElementById('clear-cache-retry-btn');
    const cancelLoginFailedBtn = document.getElementById('cancel-login-failed-btn');
    const openInSystemBrowserLink = document.getElementById('open-in-system-browser-link');

    
    // Split View State
    let isSplitMode = false;
    let activePane = 'pane-1'; // 'pane-1' or 'pane-2'

    function getActiveWebview() {
        return activePane === 'pane-2' ? webview2 : webview1;
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

    // --- Logic ---

    // Load AIs from Storage or Defaults
    function loadAIs() {
        const saved = localStorage.getItem('user-ais');
        if (saved) {
            try {
                currentAIs = JSON.parse(saved);
                // Schema migration check: if simple strings, ignore? No, strict object structure.
                if (!Array.isArray(currentAIs)) throw new Error("Invalid format");
            } catch (e) {
                console.error("Failed to load AIs, resetting", e);
                currentAIs = [...DEFAULT_AIS];
            }
        } else {
            currentAIs = [...DEFAULT_AIS];
        }
        
        renderSidebar();

        // Auto-select ChatGPT on startup (always, not conditional)
        // Increased delay to ensure sidebar is fully rendered
        setTimeout(() => {
            // Render Compare View immediately
            renderCompareView();
            
            let targetBtn = null;
            let targetUrl = '';
            
            // 1. Try to find ChatGPT directly by data-url or title
            // This is more robust than index matching which can be offset by other internal buttons
            const chatGPT = currentAIs.find(ai => ai.name.toLowerCase().includes('chatgpt'));
            
            if (chatGPT) {
                // Try finding by URL first (most precise)
                targetBtn = document.querySelector(`.ai-item[data-url="${chatGPT.url}"]`);
                if (targetBtn) {
                     targetUrl = chatGPT.url;
                     console.log('🤖 Auto-selecting ChatGPT on startup');
                }
            }
            
            // 2. Fallback: If no ChatGPT found or button missing, try first available custom AI
            if (!targetBtn && currentAIs.length > 0) {
                 // We need to find the DOM element for the first AI
                 const firstAI = currentAIs[0];
                 targetBtn = document.querySelector(`.ai-item[data-url="${firstAI.url}"]`);
                 if (targetBtn) {
                     targetUrl = firstAI.url;
                     console.log('🤖 Auto-selecting first AI fallback:', firstAI.name);
                 }
            }
            
            if (targetBtn) {
                activateAI(targetBtn, targetUrl);
            }
        }, 200);
    }

    // Save Logic
    function saveAIs() {
        localStorage.setItem('user-ais', JSON.stringify(currentAIs));
        renderSidebar();
    }

    // Save Logic
    function saveAIs() {
        localStorage.setItem('user-ais', JSON.stringify(currentAIs));
        renderSidebar();
    }

    // Feature Flags Logic
    function loadFeatureFlags() {
        const saved = localStorage.getItem('feature-flags');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                currentFeatureFlags = { ...DEFAULT_FEATURE_FLAGS, ...parsed };
            } catch (e) {
                console.error("Failed to load feature flags", e);
            }
        }
    }

    function saveFeatureFlags() {
        localStorage.setItem('feature-flags', JSON.stringify(currentFeatureFlags));
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
                'planningBoard': 'pane-planning-board',
                'planningBoard': 'pane-planning-board',
                'fileConvert': 'pane-file-convert',
                'screenLens': 'pane-screen-lens'
            };
            
            // Heuristic check: Is this feature currently "active"?
            // If browser disabled and isBrowserMode is true -> switch
            // If compare disabled and compare pane !hidden -> switch
            // etc.
            
            let shouldSwitch = false;
            
            if (featureKey === 'browser' && isBrowserMode) shouldSwitch = true;
            if (featureKey === 'compare' && !document.getElementById('pane-compare').classList.contains('hidden')) shouldSwitch = true;
            if (featureKey === 'planningBoard' && !document.getElementById('pane-planning-board').classList.contains('hidden')) shouldSwitch = true;
            if (featureKey === 'planningBoard' && !document.getElementById('pane-planning-board').classList.contains('hidden')) shouldSwitch = true;
            if (featureKey === 'fileConvert' && !document.getElementById('pane-file-convert').classList.contains('hidden')) shouldSwitch = true;
            
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
            'planningBoard': 'Planning Board',
            'planningBoard': 'Planning Board',
            'fileConvert': 'File Convert'
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
            browserLi.addEventListener('click', () => activateAI(browserLi, 'https://www.google.com', true));
            aiListContainer.appendChild(browserLi);
        }

        // Separator (only if features above are likely present)
        if (currentFeatureFlags.compare || currentFeatureFlags.browser) {
            const sep = document.createElement('div');
            sep.className = 'separator';
            aiListContainer.appendChild(sep);
        }

        // 3. Planning Board
        if (currentFeatureFlags.planningBoard) {
            const planningBoardLi = document.createElement('li');
            planningBoardLi.className = 'ai-item planning-board-item';
            planningBoardLi.title = 'Planning Board';
            planningBoardLi.innerHTML = `
              <svg class="icon" style="color: #a855f7;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <line x1="9" y1="9" x2="15" y2="9"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
               <span class="ai-name">Planning Board</span>
            `;
            planningBoardLi.addEventListener('click', () => togglePlanningBoard(planningBoardLi));
            aiListContainer.appendChild(planningBoardLi);
        }

        // 4. File Convert
        if (currentFeatureFlags.fileConvert) {
            const fileConvertLi = document.createElement('li');
            fileConvertLi.className = 'ai-item file-convert-item';
            fileConvertLi.title = 'File Convert';
            fileConvertLi.innerHTML = `
              <svg class="icon" style="color: #10b981;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <path d="M12 18v-6"></path>
                <path d="M9 15l3 3 3-3"></path>
              </svg>
               <span class="ai-name">File Convert</span>
            `;
            fileConvertLi.addEventListener('click', () => toggleFileConvert(fileConvertLi));
            aiListContainer.appendChild(fileConvertLi);
        }



        // Separator before Custom AIs (only if features above present)
        if (currentFeatureFlags.planningBoard || currentFeatureFlags.fileConvert) {
            const sep2 = document.createElement('div');
            sep2.className = 'separator';
            aiListContainer.appendChild(sep2);
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

            li.addEventListener('click', () => activateAI(li, ai.url));
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
        // Note: In split view, we might want to highlight ANY active AI, but simple active class is global.
        // For V1: Just toggle active class on sidebar item to show "last clicked".
        document.querySelectorAll('.ai-item').forEach(i => i.classList.remove('active'));
        if (item) item.classList.add('active');
        
        // 2. Hide other views
        const actionPane = document.getElementById('pane-action');
        const comparePane = document.getElementById('pane-compare');
        const planningPane = document.getElementById('pane-planning-board');
        const fileConvertPane = document.getElementById('pane-file-convert');
        const screenLensPane = document.getElementById('pane-screen-lens');
        const webviewContainer = document.getElementById('webview-container');
        const pane1 = document.getElementById('pane-1');
        const pane2 = document.getElementById('pane-2');
        
        if (actionPane) actionPane.classList.add('hidden');
        if (comparePane) comparePane.classList.add('hidden'); 
        if (planningPane) planningPane.classList.add('hidden');
        if (fileConvertPane) fileConvertPane.classList.add('hidden');
        if (webviewContainer) webviewContainer.classList.remove('hidden');
        
        if (pane1) pane1.classList.remove('hidden');
        if (pane2 && isSplitMode) pane2.classList.remove('hidden');
        
        isBrowserMode = isBrowser;

        if (browserToolbar) {
            if (isBrowserMode) {
                browserToolbar.classList.remove('hidden');
                if(addressBar) addressBar.value = url; 
            } else {
                browserToolbar.classList.add('hidden');
            }
        }
        
        const targetWebview = getActiveWebview();
        if (targetWebview && targetWebview.src !== url) {
            targetWebview.src = url;
        }
        
        // If in split mode and pane 2 was hidden/empty, now it has content.
        if (targetWebview === webview2) {
             const overlay = pane2.querySelector('.pane-overlay');
             if(overlay) overlay.style.display = 'none'; // Hide overlay
        }
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
        if(confirm('Are you sure you want to reset to the default AIs? Custom items will be lost.')) {
            currentAIs = [...DEFAULT_AIS];
            saveAIs();
            saveAIs();
            renderManageList();
            if (typeof renderCompareView === 'function') {
                renderCompareView();
            }
        }
    }

    // --- Event Listeners ---
    
    // Initial Load
    loadFeatureFlags(); // Load flags BEFORE rendering AIs (as renderSidebar uses them)
    loadAIs();
    renderFeatureSettings(); // Initial render of settings UI
    toggleTopBtn.classList.add('active'); // Default to pinned

    // Sidebar
    addListener(menuBtn, 'click', () => {
        if(sidebar) sidebar.classList.toggle('expanded');
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

    addListener(clearCacheBtn, 'click', async () => {
        if (confirm('This will log you out of all AI services and clear cache. Continue?')) {
            await clearAllCache();
        }
    });

    async function clearAllCache() {
        if (window.electronAPI && window.electronAPI.clearSessionData) {
            const success = await window.electronAPI.clearSessionData();
            if (success) {
                alert('Data cleared. The app will reload.');
                if (webview) webview.reload();
                if (webview2) webview2.reload();
            } else {
                alert('Failed to clear data.');
            }
        } else {
            alert('API not available.');
        }
    }

    // Login Failure Modal Handlers
    addListener(closeLoginFailedModal, 'click', () => loginFailedModal.classList.add('hidden'));
    addListener(cancelLoginFailedBtn, 'click', () => loginFailedModal.classList.add('hidden'));
    
    addListener(clearCacheRetryBtn, 'click', async () => {
        loginFailedModal.classList.add('hidden');
        if (window.electronAPI && window.electronAPI.clearSessionData) {
            const success = await window.electronAPI.clearSessionData();
            if (success) {
                const targetWv = getActiveWebview();
                if (targetWv) targetWv.reload();
                showToast('Cache cleared. Retrying login...');
            } else {
                alert('Failed to clear cache.');
            }
        }
    });

    addListener(openInSystemBrowserLink, 'click', (e) => {
        e.preventDefault();
        const targetWv = getActiveWebview();
        if (targetWv && window.electronAPI && window.electronAPI.openExternal) {
            window.electronAPI.openExternal(targetWv.src);
            loginFailedModal.classList.add('hidden');
        }
    });

    // Simple Toast implementation
    function showToast(message) {
        let toast = document.getElementById('app-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'app-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 60px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 13px;
                z-index: 3000;
                transition: opacity 0.3s;
                backdrop-filter: blur(10px);
                border: 1px solid #444;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
        }, 3000);
    }

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

    // Internal Webview Logic (Unified handler)
    function attachWebviewListeners(wv) {
        if (!wv) return;
        
        wv.addEventListener('did-navigate', (e) => {
             // Only update bar if this is the active browser view
             if (isBrowserMode && addressBar && wv === getActiveWebview()) addressBar.value = e.url;
        });

        wv.addEventListener('did-start-navigation', (e) => {
            const url = e.url.toLowerCase();
            const tracker = getLoginTracker(wv);
            
            // 1. Immediate rejection detection (Matches user report: signin/rejected)
            const isRejectionUrl = url.includes('rejected') || 
                                   url.includes('denied') || 
                                   url.includes('errors/') ||
                                   url.includes('error-page');
            
            if (isRejectionUrl && (url.includes('google') || url.includes('openai') || url.includes('anthropic'))) {
                console.log('Immediate login rejection detected via URL:', url);
                showLoginFailedModal();
                return;
            }

            // 2. Default login page detection
            const isLoginUrl = url.includes('accounts.google.com') || 
                               url.includes('signin') || 
                               url.includes('login') || 
                               url.includes('auth');
            
            if (isLoginUrl) {
                // If we're reloading the same login page rapidly, increment retry count
                if (tracker.lastUrl === url) {
                    tracker.retryCount++;
                    console.log(`Login retry detected (${tracker.retryCount}) for ${url}`);
                    
                    if (tracker.retryCount >= 5) {
                        showLoginFailedModal();
                        tracker.retryCount = 0; // Reset after showing
                    }
                } else {
                    tracker.retryCount = 1;
                }
                tracker.lastUrl = url;

                // Start or reset timeout timer
                if (tracker.timer) clearTimeout(tracker.timer);
                tracker.timer = setTimeout(() => {
                    // If still on a login URL after 30s, suggest cache clear
                    const currentUrl = wv.getURL().toLowerCase();
                    if (currentUrl.includes('accounts.google.com') || currentUrl.includes('signin')) {
                        console.log('Login timeout detected');
                        showLoginFailedModal();
                    }
                }, 30000); // 30 seconds
            } else {
                // Not a login URL, reset tracking
                if (tracker.timer) {
                    clearTimeout(tracker.timer);
                    tracker.timer = null;
                }
                tracker.retryCount = 0;
                tracker.lastUrl = '';
            }
        });

        wv.addEventListener('did-navigate-in-page', (e) => {
            if (isBrowserMode && addressBar && wv === getActiveWebview()) addressBar.value = e.url;
        });
        
        wv.addEventListener('will-navigate', (e) => {
            const url = new URL(e.url);
            if (isBrowserMode) return;
            
            // Re-calc allowed list relative to global context (simplification)
            const allowedHostnames = currentAIs.map(ai => {
                try { return new URL(ai.url).hostname; } catch(e){ return ''; }
            }).filter(h => h);
            
            const baseAllowed = ['google.com', 'microsoft.com', 'openai.com', 'anthropic.com'];
            const isAllowed = [...allowedHostnames, ...baseAllowed].some(domain => url.hostname.includes(domain));
            
            // if (!isAllowed) e.preventDefault();
        });

        wv.addEventListener('did-finish-load', () => {
            // Optional: Check for specific Google error text via executeJavaScript
            const url = wv.getURL().toLowerCase();
            if (url.includes('google.com')) {
                wv.executeJavaScript(`
                    (function() {
                        const content = document.body.innerText.toLowerCase();
                        const patterns = [
                            'this browser or app may not be secure',
                            'couldn\\'t sign you in',
                            'something went wrong',
                            'try using a different browser',
                            'your browser is not supported'
                        ];
                        return patterns.some(p => content.includes(p.toLowerCase()));
                    })()
                `).then(isErrorPage => {
                    if (isErrorPage) {
                        console.log('Detected Google security error page via text matching');
                        showLoginFailedModal();
                    }
                }).catch(err => console.error('Error checking error page:', err));
            }
        });

        wv.addEventListener('did-fail-load', (e) => {
            // Handle specific navigation failures
            if (e.isMainFrame && e.errorCode < 0 && e.errorCode !== -3) { // Ignore aborted
                console.log(`Navigation failed: ${e.errorDescription} (${e.errorCode})`);
                // If it's a login-related domain, show the helper
                const url = wv.getURL().toLowerCase();
                if (url.includes('google') || url.includes('openai') || url.includes('anthropic')) {
                    showLoginFailedModal();
                }
            }
        });
        
        // Click to focus pane
        // Webviews swallow clicks, so we need a wrapper listener or use blur/focus on webview?
        // Actually Electron webviews don't propagate clicks to parent easily.
        // We might need to listen to 'focus' event on webview.
    }

    function showLoginFailedModal() {
        if (loginFailedModal) {
            loginFailedModal.classList.remove('hidden');
        }
    }

    attachWebviewListeners(webview1);
    attachWebviewListeners(webview2);

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

    addListener(collapseBtn, 'click', () => setCompactMode(true));
    
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
        let currentVersion = '1.0.0';
        try {
             currentVersion = await window.electronAPI.getAppVersion();
        } catch (e) { console.error(e); }

        const TOUR_VERSION_KEY = 'ai_pin_tour_seen_v3'; // Bumped version for new features
        const savedVersion = localStorage.getItem(TOUR_VERSION_KEY); 

        // Steps Configuration
        const rawSteps = [
            {
                element: null, 
                title: "Welcome to AI Assistant 2.5",
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
                element: document.querySelector('.planning-board-item'),
                title: "Planning Board",
                text: "An infinite whiteboard to draw, plan, and organize your thoughts visually.",
                position: 'right'
            },
            {
                element: document.querySelector('.file-convert-item'),
                title: "File Converter",
                text: "<b>New!</b> Convert, merge, and edit PDFs instantly using iLovePDF.",
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

    // ===== Incognito Mode =====
    
    if (incognitoToggleBtn) {
        incognitoToggleBtn.addEventListener('click', () => {
            isIncognitoMode = !isIncognitoMode;
            
            // Update UI
            if (incognitoStatus) {
                incognitoStatus.textContent = isIncognitoMode ? 'ON' : 'OFF';
                incognitoToggleBtn.style.background = isIncognitoMode ? 'rgba(147, 51, 234, 0.2)' : '';
                incognitoToggleBtn.style.borderColor = isIncognitoMode ? '#9333ea' : '';
            }
            
            // Update webview partitions
            const partition = isIncognitoMode ? 'temp:incognito' : 'persist:ai_session';
            if (webview1) webview1.partition = partition;
            if (webview2) webview2.partition = partition;
            
            // Reload current pages to apply new partition
            if (webview1 && webview1.src !== 'about:blank') webview1.reload();
            if (webview2 && webview2.src !== 'about:blank') webview2.reload();
            
            console.log(`Incognito mode: ${isIncognitoMode ? 'ON' : 'OFF'}`);
        });
    }

    // Quick Access Button Handlers
    if (quickIncognitoBtn) {
        quickIncognitoBtn.addEventListener('click', () => {
            // Same logic as settings button
            isIncognitoMode = !isIncognitoMode;
            
            // Update visual state
            if (isIncognitoMode) {
                quickIncognitoBtn.classList.add('active');
            } else {
                quickIncognitoBtn.classList.remove('active');
                // Remove inline styles if they existed from previous sessions legacy code
                quickIncognitoBtn.style.background = '';
                quickIncognitoBtn.style.borderColor = '';
            }
            
            // Also update settings modal if it exists
            if (incognitoStatus) incognitoStatus.textContent = isIncognitoMode ? 'ON' : 'OFF';
            if (incognitoToggleBtn) {
                incognitoToggleBtn.style.background = isIncognitoMode ? 'rgba(147, 51, 234, 0.2)' : '';
                incognitoToggleBtn.style.borderColor = isIncognitoMode ? '#9333ea' : '';
            }
            
            // Update webview partitions
            const partition = isIncognitoMode ? 'temp:incognito' : 'persist:ai_session';
            if (webview1) webview1.partition = partition;
            if (webview2) webview2.partition = partition;
            
            // Reload current pages
            if (webview1 && webview1.src !== 'about:blank') webview1.reload();
            if (webview2 && webview2.src !== 'about:blank') webview2.reload();
            
            console.log(`Quick Incognito: ${isIncognitoMode ? 'ON' : 'OFF'}`);
        });
    }
    
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
    window.electronAPI.onSwitchToAIIndex((index) => {
        console.log(`Switching to AI at index: ${index}`);
        
        if (index < currentAIs.length) {
            const ai = currentAIs[index];
            
            // Find the corresponding AI button in the sidebar
            // Note: index+1 because Browser is at index 0
            const aiButtons = document.querySelectorAll('.ai-item:not(.browser-mode)');
            const targetButton = aiButtons[index];
            
            if (targetButton) {
                // Call activateAI with the button element and URL
                activateAI(targetButton, ai.url, false);
                
                // Visual feedback: Flash the button
                targetButton.classList.add('flash-highlight');
                setTimeout(() => {
                    targetButton.classList.remove('flash-highlight');
                }, 500);
                
                console.log(`Switched to: ${ai.name}`);
            } else {
                console.warn(`Button not found for AI at index ${index}`);
            }
        } else {
            console.warn(`No AI at index ${index}`);
        }
    });

    // Start Tour Logic
    setTimeout(initTour, 1000);


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
                    partition="persist:ai_session" 
                    useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0"
                ></webview>
            `;
            compareGrid.appendChild(col);
            
            // Store reference
            const wv = col.querySelector('webview');
            compareWebviews.push(wv);
            
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
        // 1. Deactivate other sidebar items
        document.querySelectorAll('.ai-item').forEach(i => i.classList.remove('active'));
        if (btnElement) btnElement.classList.add('active');
        
        // 2. Hide other views
        if (pane1) pane1.classList.add('hidden');
        if (pane2) pane2.classList.add('hidden');
        if (actionPane) actionPane.classList.add('hidden');
        const planningPane = document.getElementById('pane-planning-board');
        if (planningPane) planningPane.classList.add('hidden');
        
        // 3. Show Compare Pane
        if (comparePane) comparePane.classList.remove('hidden');
        if (browserToolbar) browserToolbar.classList.add('hidden');
        
        isCompareActive = true;
        isBrowserMode = false;
    }
    
    // Toggle Planning Board
    function togglePlanningBoard(btnElement) {
        // 1. Deactivate other sidebar items
        document.querySelectorAll('.ai-item').forEach(i => i.classList.remove('active'));
        if (btnElement) btnElement.classList.add('active');
        
        // 2. Hide other views
        const webviewContainer = document.getElementById('webview-container');
        const fileConvertPane = document.getElementById('pane-file-convert'); // FIX: Get reference

        if (webviewContainer) webviewContainer.classList.add('hidden');
        if (pane1) pane1.classList.add('hidden');
        if (pane2) pane2.classList.add('hidden');
        if (comparePane) comparePane.classList.add('hidden');
        if (actionPane) actionPane.classList.add('hidden');
        if (browserToolbar) browserToolbar.classList.add('hidden');
        if (fileConvertPane) fileConvertPane.classList.add('hidden'); // FIX: Hide it
        
        // 3. Show Planning Board
        const planningPane = document.getElementById('pane-planning-board');
        if (planningPane) {
            planningPane.classList.remove('hidden');
            // Activate board if initialized
            if (window.planningBoard) {
                window.planningBoard.activate();
            }
        }
        
        isCompareActive = false;
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
         const planningPane = document.getElementById('pane-planning-board');
         if (planningPane) planningPane.classList.add('hidden');
         
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
    // FILE CONVERT FUNCTIONALITY (iLovePDF)
    // ============================================
    
    // Toggle File Convert Pane
    function toggleFileConvert(item) {
        // Hide other panes
        const actionPane = document.getElementById('pane-action');
        const comparePane = document.getElementById('pane-compare');
        const planningPane = document.getElementById('pane-planning-board');
        const webviewContainer = document.getElementById('webview-container');
        const fileConvertPane = document.getElementById('pane-file-convert');
        
        if (actionPane) actionPane.classList.add('hidden');
        if (comparePane) comparePane.classList.add('hidden');
        if (planningPane) planningPane.classList.add('hidden');
        if (webviewContainer) webviewContainer.classList.add('hidden');
        
        // Show File Convert pane
        if (fileConvertPane) {
            fileConvertPane.classList.remove('hidden');
        }
        
        // Update sidebar active state
        document.querySelectorAll('.ai-item').forEach(i => i.classList.remove('active'));
        if (item) item.classList.add('active');
    }
    
    // Inject CSS to hide iLovePDF header and footer, and apply dark theme
    const ilovepdfWebview = document.getElementById('ilovepdf-webview');
    if (ilovepdfWebview) {
        ilovepdfWebview.addEventListener('dom-ready', () => {
            ilovepdfWebview.insertCSS(`
                /* Hide global header (Logo, Login, Menu) and Footer */
                header,
                .header,
                .main-header,
                #header,
                [class*="header__main"],
                [class*="header-main"],
                footer,
                .footer,
                .main-footer,
                #footer,
                [class*="footer"],
                /* Hide 'Trusted by millions' promotional section */
                .homepage-promotion,
                .main__content + div,
                [class*="trust"],
                [class*="trusted"],
                .block--grey,
                /* Hide 'Workflows' related elements (Filter and Card) */
                [data-filter="workflows"],
                a[href*="/workflows"],
                div[class*="workflows"],
                .tool__item--workflows,
                /* Hide promotional banners (offline app, social sharing) */
                .app-banner,
                .social-share,
                .share-buttons,
                [class*="banner"],
                [class*="social"],
                [class*="thank"],
                [class*="spread"],
                .promo-container,
                /* Hide 'Secure. Private.' info block */
                .block--blue,
                .security-block,
                [class*="secure"],
                [class*="privacy"],
                .feature--security {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    overflow: hidden !important;
                }

                /* Safe Visual Integration Strategy */
                /* 1. Neutral background normalization */
                body {
                    background-color: #121212 !important; /* Dark background base */
                    
                    /* 2. Gentle visual blending via filters */
                    /* Invert lightness but preserve hues roughly by rotating back */
                    filter: invert(0.9) hue-rotate(180deg) brightness(0.9) contrast(1.1);
                    
                    /* Remove top padding since header is hidden */
                    padding-top: 0 !important;
                    margin-top: 0 !important;
                }
                
                /* Re-invert media so images/icons look correct */
                img, video, [role="img"], canvas, svg {
                    filter: invert(1) hue-rotate(180deg);
                }
                
                /* Ensure main content takes accessible width */
                .main, #main, main {
                    margin-top: 0 !important;
                    padding-top: 20px !important;
                }

                /* Custom scrollbar */
                ::-webkit-scrollbar {
                    width: 10px;
                    height: 10px;
                }
                ::-webkit-scrollbar-track {
                    background: #2a2a2a;
                }
                ::-webkit-scrollbar-thumb {
                    background: #4a4a4a;
                    border-radius: 5px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #60a5fa;
                }
            `);
        });
        
        // Navigation controls
        const backBtn = document.getElementById('webview-back');
        const forwardBtn = document.getElementById('webview-forward');
        const homeBtn = document.getElementById('webview-home');
        const reloadBtn = document.getElementById('webview-reload');
        
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (ilovepdfWebview.canGoBack()) {
                    ilovepdfWebview.goBack();
                }
            });
        }
        
        if (forwardBtn) {
            forwardBtn.addEventListener('click', () => {
                if (ilovepdfWebview.canGoForward()) {
                    ilovepdfWebview.goForward();
                }
            });
        }
        
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                ilovepdfWebview.loadURL('https://www.ilovepdf.com/');
            });
        }
        
        if (reloadBtn) {
            reloadBtn.addEventListener('click', () => {
                ilovepdfWebview.reload();
            });
        }
        
        // Update button states based on navigation history
        ilovepdfWebview.addEventListener('did-navigate', () => {
            if (backBtn) backBtn.disabled = !ilovepdfWebview.canGoBack();
            if (forwardBtn) forwardBtn.disabled = !ilovepdfWebview.canGoForward();
        });
        
        ilovepdfWebview.addEventListener('did-navigate-in-page', () => {
            if (backBtn) backBtn.disabled = !ilovepdfWebview.canGoBack();
            if (forwardBtn) forwardBtn.disabled = !ilovepdfWebview.canGoForward();
        });
    }
    
    // Make toggleFileConvert available globally
    window.toggleFileConvert = toggleFileConvert;

    // ============================================
    // PLANNING BOARD INITIALIZATION
    // ============================================
    
    // Initialize Planning Board (non-destructive, isolated module)
    if (typeof PlanningBoard !== 'undefined') {
        window.planningBoard = new PlanningBoard('planning-board-canvas');
        console.log('Planning Board initialized');
        
        // Handle Board Capture Image Insertion
        if (window.electronAPI && window.electronAPI.onBoardInsertImage) {
            window.electronAPI.onBoardInsertImage((dataUrl) => {
                const planningPane = document.getElementById('pane-planning-board');
                if (planningPane && !planningPane.classList.contains('hidden') && window.planningBoard) {
                    // Center of current viewport
                    const canvas = window.planningBoard.canvas;
                    const view = window.planningBoard.viewState;
                    // Center logic is already in duplicate logic inside class somewhat, 
                    // or paste. Let's calculate center manually to be safe.
                    // Actually, let's use a safe coordinate like (100, 100) or current center.
                    
                    const centerX = (canvas.width / 2 - view.offsetX) / view.scale;
                    const centerY = (canvas.height / 2 - view.offsetY) / view.scale;

                    window.planningBoard.addImageBlock(dataUrl, centerX - 100, centerY - 100);
                }
            });
        }
        
        // Bind Capture Button (defined in HTML later)
        const captureBtn = document.getElementById('board-capture-btn');
        if (captureBtn) {
            captureBtn.addEventListener('click', () => {
                 if (window.electronAPI) window.electronAPI.startCaptureBoard();
            });
        }
        
        // Bind Undo/Redo Buttons
        const undoBtn = document.getElementById('board-undo-btn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                if (window.planningBoard) window.planningBoard.undo();
            });
        }
        
        const redoBtn = document.getElementById('board-redo-btn');
        if (redoBtn) {
            redoBtn.addEventListener('click', () => {
                if (window.planningBoard) window.planningBoard.redo();
            });
        }
        
        // Listen for Capture Shortcut (Ctrl+Alt+S)
        document.addEventListener('keydown', (e) => {
             // Only if board is active
             const planningPane = document.getElementById('pane-planning-board');
             if (planningPane && !planningPane.classList.contains('hidden')) {
                  // Use e.code to handle layouts where Ctrl+Alt modifies the character (e.g. AltGr)
                  if (e.ctrlKey && e.altKey && e.code === 'KeyS') {
                      e.preventDefault();
                      console.log('📸 Shortcut Triggered: Ctrl+Alt+S');
                      if (window.electronAPI) window.electronAPI.startCaptureBoard();
                  }
             }
        });

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
            window.electronAPI.onUpdateAvailable((info) => {
                console.log('Renderer: Update available', info);
                latestUpdateInfo = info;
                if (updateVersionText) updateVersionText.textContent = `v${info.version}`;
                if (updateBanner) updateBanner.classList.remove('hidden');
            });

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
            window.electronAPI.onDownloadProgress((progress) => {
                console.log('Renderer: Progress', progress);
                if (updateProgressContainer) updateProgressContainer.classList.remove('hidden');
                if (updateProgressBar) updateProgressBar.style.width = `${progress.percent}%`;
                if (updateProgressText) updateProgressText.textContent = `Downloading: ${Math.round(progress.percent)}%`;
            });

            // Update Downloaded
            window.electronAPI.onUpdateDownloaded((info) => {
                console.log('Renderer: Update downloaded', info);
                if (updateProgressText) updateProgressText.textContent = 'Update ready to install!';
                if (updateProgressBar) updateProgressBar.style.width = '100%';
                if (updateNowBtn) {
                    updateNowBtn.textContent = 'Restart & Install';
                    updateNowBtn.classList.remove('loading');
                }
            });

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
        }
    }
});

