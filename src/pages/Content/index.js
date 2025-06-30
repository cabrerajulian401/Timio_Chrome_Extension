// src/pages/Content/index.js

import Readability from './Readability.js'; 

console.log('Hello, world!');
console.log('Content script loaded');

(() => {
    let timioFloatingMenu = null;
    let isExtensionContextValid = true;

    // Enhanced error logging utility
    function logError(message, error = null, context = {}) {
        const timestamp = new Date().toISOString();
        const errorInfo = {
            timestamp,
            message,
            context,
            url: window.location.href,
            userAgent: navigator.userAgent,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : null
        };
        
        console.error('[TIMIO ERROR]:', errorInfo);
        
        // Try to send error to background if extension context is valid
        if (isExtensionContextValid && chrome.runtime && chrome.runtime.sendMessage) {
            try {
                chrome.runtime.sendMessage({
                    type: 'ERROR_LOG',
                    errorInfo: errorInfo
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('[TIMIO] Could not send error log to background:', chrome.runtime.lastError.message);
                        isExtensionContextValid = false;
                    }
                });
            } catch (e) {
                console.warn('[TIMIO] Exception sending error log:', e.message);
                isExtensionContextValid = false;
            }
        }
    }

    function logInfo(message, data = null) {
        console.log(`[TIMIO INFO] ${message}`, data || '');
    }

    // Check if extension context is still valid
    function checkExtensionContext() {
        try {
            if (!chrome.runtime || !chrome.runtime.getURL) {
                isExtensionContextValid = false;
                return false;
            }
            // Try to access runtime URL as a test
            chrome.runtime.getURL('test');
            return true;
        } catch (error) {
            isExtensionContextValid = false;
            logError('Extension context invalidated', error);
            return false;
        }
    }

    // Safe Chrome API wrapper
    function safeChromeSend(message, callback = null) {
        if (!checkExtensionContext()) {
            logError('Attempted to send message with invalid extension context', null, { message });
            return false;
        }

        try {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
                        isExtensionContextValid = false;
                        logError('Extension context invalidated during message send', new Error(chrome.runtime.lastError.message));
                    } else {
                        logError('Chrome runtime error', new Error(chrome.runtime.lastError.message), { message });
                    }
                } else if (callback) {
                    callback(response);
                }
            });
            return true;
        } catch (error) {
            isExtensionContextValid = false;
            logError('Exception sending Chrome message', error, { message });
            return false;
        }
    }

    function shouldInjectTIMIO() {
        const hostname = window.location.hostname.toLowerCase();

        const excludedSites = [
            'youtube.com', 'netflix.com', 'hulu.com', 'vimeo.com', 'twitch.tv',
            'primevideo.com', 'disneyplus.com', 'hbomax.com', 'peacocktv.com',
            'paramountplus.com', 'discoveryplus.com', 'dailymotion.com',
            'facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com', 'pinterest.com',
            'reddit.com', 'linkedin.com', 'snapchat.com', 'whatsapp.com', 'telegram.org',
            'discord.com', 'tumblr.com',
            'gmail.com', 'outlook.com', 'mail.yahoo.com', 'protonmail.com', 'zoho.com',
            'drive.google.com', 'sheets.google.com', 'slides.google.com',
            'office.com', 'notion.so', 'trello.com', 'asana.com', 'monday.com',
            'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'replit.com',
            'codepen.io', 'codesandbox.io', 'jsfiddle.net',
            'amazon.com', 'ebay.com', 'walmart.com', 'target.com', 'etsy.com',
            'bestbuy.com', 'aliexpress.com',
            'wikipedia.org', 'quora.com', 'maps.google.com', 'meet.google.com',
            'zoom.us', 'calendar.google.com'
        ];

        for (const site of excludedSites) {
            if (hostname.includes(site)) {
                logInfo(`Excluded site detected: ${hostname}`);
                return false;
            }
        }

        if (document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement) {
            logInfo('Fullscreen mode detected, not injecting');
            return false;
        }

        return true;
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    function handleFullscreenChange() {
        try {
            const menu = document.getElementById('timio-floating-menu');
            if (document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement) {
                if (menu) menu.style.display = 'none';
            } else {
                if (shouldInjectTIMIO()) {
                    if (checkExtensionContext()) {
                        chrome.storage.local.get(['isFloatingMenuVisible'], (result) => {
                            if (chrome.runtime.lastError) {
                                logError('Storage access error in fullscreen handler', new Error(chrome.runtime.lastError.message));
                                return;
                            }
                            const isVisible = typeof result.isFloatingMenuVisible !== 'undefined' ? result.isFloatingMenuVisible : true;
                            if (menu) {
                                menu.style.display = isVisible ? 'block' : 'none';
                            }
                        });
                    }
                }
            }
        } catch (error) {
            logError('Error in fullscreen change handler', error);
        }
    }

    function applyFloatingMenuVisibility(isVisible) {
        try {
            if (timioFloatingMenu) {
                logInfo(`Setting floating menu visibility to: ${isVisible}`);
                timioFloatingMenu.style.display = isVisible ? 'block' : 'none';
                if (isVisible) {
                    timioFloatingMenu.style.visibility = 'visible';
                    timioFloatingMenu.style.opacity = '1';
                }
            } else {
                logError('Floating menu element not found when trying to apply visibility');
            }
        } catch (error) {
            logError('Error applying floating menu visibility', error, { isVisible });
        }
    }

    // Safe message listener setup
    if (checkExtensionContext() && chrome.runtime && chrome.runtime.onMessage) {
        try {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                try {
                    logInfo('Content script received message:', request);
                    if (request.type === 'TOGGLE_FLOATING_MENU') {
                        applyFloatingMenuVisibility(request.isVisible);
                        sendResponse({ status: 'success' });
                    }
                } catch (error) {
                    logError('Error in message listener', error, { request });
                    sendResponse({ status: 'error', message: error.message });
                }
                return true;
            });
        } catch (error) {
            logError('Error setting up message listener', error);
        }
    }

    // Safe storage change listener setup
    if (checkExtensionContext() && chrome.storage && chrome.storage.onChanged) {
        try {
            chrome.storage.onChanged.addListener((changes, namespace) => {
                try {
                    if (namespace === 'local' && changes.isFloatingMenuVisible) {
                        logInfo('Storage change detected for isFloatingMenuVisible:', changes.isFloatingMenuVisible.newValue);
                        applyFloatingMenuVisibility(changes.isFloatingMenuVisible.newValue);
                    }
                } catch (error) {
                    logError('Error in storage change listener', error, { changes, namespace });
                }
            });
        } catch (error) {
            logError('Error setting up storage change listener', error);
        }
    }

    function ensureMenuVisibility() {
        try {
            if (timioFloatingMenu) {
                timioFloatingMenu.style.zIndex = '2147483647';
                if (checkExtensionContext()) {
                    chrome.storage.local.get(['isFloatingMenuVisible'], (result) => {
                        if (chrome.runtime.lastError) {
                            logError('Storage access error in ensureMenuVisibility', new Error(chrome.runtime.lastError.message));
                            return;
                        }
                        const isVisible = typeof result.isFloatingMenuVisible !== 'undefined' ? result.isFloatingMenuVisible : true;
                        applyFloatingMenuVisibility(isVisible);
                    });
                }
            }
        } catch (error) {
            logError('Error ensuring menu visibility', error);
        }
    }

    function handleButtonClick(action, title, animationType) {
        return async () => {
            try {
                logInfo(`Floating menu button clicked - Action: ${action}, Title: ${title}, Animation: ${animationType}`);

                // Check extension context before proceeding
                if (!checkExtensionContext()) {
                    logError('Cannot proceed with button click - extension context invalid');
                    alert('Extension needs to be reloaded. Please refresh the page.');
                    return;
                }

                const articleText = extractArticleText();
                logInfo('Extracted article text for sending:', articleText.slice(0, 200));

                // 🔥 FIXED: Send message with user gesture context preserved
                const success = safeChromeSend({
                    type: 'PROCESS_ARTICLE',
                    action: action,
                    title: title,
                    animationType: animationType,
                    content: articleText,
                    url: window.location.href,
                    userGesture: true // Flag to indicate this is from user gesture
                }, (response) => {
                    logInfo('Response from background:', response);
                });

                if (!success) {
                    logError('Failed to send message to background - extension context may be invalid');
                    alert('Extension error. Please refresh the page and try again.');
                }

            } catch (error) {
                logError('Content script button click handler failed', error, {
                    action,
                    title,
                    animationType,
                });
                
                // Try to send error to background
                safeChromeSend({
                    type: 'PROCESS_ARTICLE_ERROR',
                    error: `Failed to process article: ${error.message}`
                });
            }
        };
    }

    function makeDraggable(element) {
        try {
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
            let isDragging = false;
            let hasMoved = false;
            let startTime = 0;

            const dragHandle = element.querySelector('.timio-menu-button');
            const dragIndicator = element.querySelector('.timio-drag-indicator');

            if (dragHandle) {
                dragHandle.addEventListener('mousedown', dragMouseDown);
                dragHandle.addEventListener('touchstart', dragTouchStart, { passive: false });
            }
            if (dragIndicator) {
                dragIndicator.addEventListener('mousedown', dragMouseDown);
                dragIndicator.addEventListener('touchstart', dragTouchStart, { passive: false });
            }

            function dragMouseDown(e) {
                try {
                    if (e.target.classList.contains('timio-action-button') ||
                        e.target.closest('.timio-action-button') ||
                        e.target.closest('.timio-menu-items.active')) {
                        return;
                    }

                    e.preventDefault();
                    startTime = Date.now();
                    hasMoved = false;
                    pos3 = e.clientX;
                    pos4 = e.clientY;
                    isDragging = true;
                    element.classList.add('dragging');

                    document.addEventListener('mouseup', closeDragElement);
                    document.addEventListener('mousemove', elementDrag);
                } catch (error) {
                    logError('Error in dragMouseDown', error);
                }
            }

            function dragTouchStart(e) {
                try {
                    if (e.target.classList.contains('timio-action-button') ||
                        e.target.closest('.timio-action-button') ||
                        e.target.closest('.timio-menu-items.active')) {
                        return;
                    }

                    e.preventDefault();
                    startTime = Date.now();
                    hasMoved = false;
                    const touch = e.touches[0];
                    pos3 = touch.clientX;
                    pos4 = touch.clientY;
                    isDragging = true;
                    element.classList.add('dragging');

                    document.addEventListener('touchend', closeTouchDragElement);
                    document.addEventListener('touchmove', elementTouchDrag, { passive: false });
                } catch (error) {
                    logError('Error in dragTouchStart', error);
                }
            }

            function elementDrag(e) {
                try {
                    if (!isDragging) return;
                    e.preventDefault();

                    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
                    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

                    const moveX = Math.abs(pos3 - clientX);
                    const moveY = Math.abs(pos4 - clientY);

                    if (moveX > 5 || moveY > 5) {
                        hasMoved = true;
                    }

                    pos1 = pos3 - clientX;
                    pos2 = pos4 - clientY;
                    pos3 = clientX;
                    pos4 = clientY;

                    updateElementPosition();
                } catch (error) {
                    logError('Error in elementDrag', error);
                }
            }

            function elementTouchDrag(e) {
                elementDrag(e);
            }

            function updateElementPosition() {
                try {
                    const newTop = element.offsetTop - pos2;
                    const newLeft = element.offsetLeft - pos1;

                    element.style.top = newTop + "px";
                    element.style.left = newLeft + "px";
                    element.style.right = "auto";
                    element.style.bottom = "auto";

                    checkBoundaries(element);
                } catch (error) {
                    logError('Error updating element position', error);
                }
            }

            function checkBoundaries(element) {
                try {
                    const rect = element.getBoundingClientRect();

                    if (rect.left < 0) {
                        element.style.left = "0px";
                    }
                    if (rect.top < 0) {
                        element.style.top = "0px";
                    }
                    if (rect.right > window.innerWidth) {
                        element.style.left = (window.innerWidth - rect.width) + "px";
                    }
                    if (rect.bottom > window.innerHeight) {
                        element.style.top = (window.innerHeight - rect.height) + "px";
                    }
                } catch (error) {
                    logError('Error checking boundaries', error);
                }
            }

            function closeDragElement(e) {
                try {
                    const endTime = Date.now();
                    const timeDiff = endTime - startTime;

                    isDragging = false;
                    element.classList.remove('dragging');

                    document.removeEventListener('mouseup', closeDragElement);
                    document.removeEventListener('mousemove', elementDrag);

                    if (timeDiff < 200 && !hasMoved) {
                        if (e.target.classList.contains('timio-menu-button') || e.target.closest('.timio-menu-button')) {
                            const toggle = document.getElementById('timio-toggle');
                            const menuItems = document.querySelector('.timio-menu-items');
                            toggle.classList.toggle('active');
                            menuItems.classList.toggle('active');
                        }
                    } else if (hasMoved) {
                        savePosition();
                    }
                } catch (error) {
                    logError('Error in closeDragElement', error);
                }
            }

            function closeTouchDragElement(e) {
                try {
                    const endTime = Date.now();
                    const timeDiff = endTime - startTime;

                    isDragging = false;
                    element.classList.remove('dragging');

                    document.removeEventListener('touchend', closeTouchDragElement);
                    document.removeEventListener('touchmove', elementTouchDrag);

                    if (timeDiff < 200 && !hasMoved) {
                        if (e.target.classList.contains('timio-menu-button') || e.target.closest('.timio-menu-button')) {
                            const toggle = document.getElementById('timio-toggle');
                            const menuItems = document.querySelector('.timio-menu-items');
                            toggle.classList.toggle('active');
                            menuItems.classList.toggle('active');
                        }
                    } else if (hasMoved) {
                        savePosition();
                    }
                } catch (error) {
                    logError('Error in closeTouchDragElement', error);
                }
            }

            function savePosition() {
                try {
                    const position = {
                        top: element.style.top,
                        left: element.style.left,
                        timestamp: Date.now()
                    };

                    localStorage.setItem('timio-menu-position', JSON.stringify(position));
                    logInfo('Position saved:', position);
                } catch (e) {
                    logError('Could not save menu position', e);
                }
            }
        } catch (error) {
            logError('Error making element draggable', error);
        }
    }

    function restorePosition(element) {
        try {
            const savedPositionString = localStorage.getItem('timio-menu-position');

            if (savedPositionString) {
                const position = JSON.parse(savedPositionString);
                logInfo('Restoring position:', position);

                if (position.top && position.left) {
                    element.style.top = position.top;
                    element.style.left = position.left;
                    element.style.right = "auto";
                    element.style.bottom = "auto";

                    setTimeout(() => {
                        const rect = element.getBoundingClientRect();

                        if (rect.right <= 0 || rect.bottom <= 0 ||
                            rect.left >= window.innerWidth || rect.top >= window.innerHeight) {
                            logInfo('Menu was positioned off-screen, resetting position');
                            element.style.top = "auto";
                            element.style.left = "auto";
                            element.style.right = "24px";
                            element.style.bottom = "24px";
                        }
                    }, 100);
                } else {
                    element.style.top = "auto";
                    element.style.left = "auto";
                    element.style.right = "24px";
                    element.style.bottom = "24px";
                }
            }
        } catch (e) {
            logError('Could not restore menu position', e);
            element.style.top = "auto";
            element.style.left = "auto";
            element.style.right = "24px";
            element.style.bottom = "24px";
        }
    }

    function injectFloatingMenu() {
        try {
            if (document.getElementById('timio-floating-menu')) {
                ensureMenuVisibility();
                return;
            }

            if (!checkExtensionContext()) {
                logError('Cannot inject floating menu - extension context invalid');
                return;
            }

            logInfo('Injecting floating menu');

            timioFloatingMenu = document.createElement('div');
            timioFloatingMenu.id = 'timio-floating-menu';
            timioFloatingMenu.style.cssText = 'position: fixed !important; bottom: 24px !important; right: 24px !important; z-index: 2147483647 !important; visibility: visible !important; opacity: 1 !important;';
            
            const torchIconUrl = chrome.runtime.getURL('Torch_Icon.png');
            const pivotIconUrl = chrome.runtime.getURL('Pivot_Icon.png');
            
            timioFloatingMenu.innerHTML = `
                <div class="timio-menu-container">
                    <div class="timio-drag-indicator"></div>
                    <div class="timio-menu-items">
                        <button class="timio-action-button" id="timio-insights">
                            <div class="button-image">
                                <img src="${torchIconUrl}" alt="Torch">
                            </div>
                            <span class="timio-tooltip">Torch</span>
                        </button>
                        <button class="timio-action-button" id="timio-pivot">
                            <div class="button-image">
                                <img src="${pivotIconUrl}" alt="Pivot">
                            </div>
                            <span class="timio-tooltip">Pivot</span>
                        </button>
                    </div>
                    <button class="timio-menu-button" id="timio-toggle">
                        <svg class="menu-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                            <g class="plus-icon">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </g>
                            <g class="arrow-icon">
                                <path d="M6 9l6 6 6-6"></path>
                            </g>
                        </svg>
                    </button>
                </div>
            `;

            document.body.appendChild(timioFloatingMenu);

            makeDraggable(timioFloatingMenu);
            restorePosition(timioFloatingMenu);
            
            if (checkExtensionContext()) {
                chrome.storage.local.get(['isFloatingMenuVisible'], (result) => {
                    if (chrome.runtime.lastError) {
                        logError('Storage access error after menu injection', new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    const isVisible = typeof result.isFloatingMenuVisible !== 'undefined' ? result.isFloatingMenuVisible : true;
                    applyFloatingMenuVisibility(isVisible);
                });
            }

            const toggle = document.getElementById('timio-toggle');
            const menuItems = document.querySelector('.timio-menu-items');
            const insightsButton = document.getElementById('timio-insights');
            const pivotButton = document.getElementById('timio-pivot');
            let isOpen = false;

            if (toggle) {
                toggle.addEventListener('click', (e) => {
                    try {
                        if (timioFloatingMenu.classList.contains('dragging')) {
                            return;
                        }
                        isOpen = !isOpen;
                        toggle.classList.toggle('active', isOpen);
                        menuItems.classList.toggle('active', isOpen);
                    } catch (error) {
                        logError('Error in toggle click handler', error);
                    }
                });
            }

            document.addEventListener('click', (e) => {
                try {
                    if (timioFloatingMenu && !timioFloatingMenu.contains(e.target) && isOpen) {
                        isOpen = false;
                        if (toggle) toggle.classList.remove('active');
                        if (menuItems) menuItems.classList.remove('active');
                    }
                } catch (error) {
                    logError('Error in document click handler', error);
                }
            });

            insightsButton.addEventListener(
                'click',
                handleButtonClick('getInsights', "Torch's Insights", 'torch')
            );
            pivotButton.addEventListener(
                'click',
                handleButtonClick('getPivotArticles', 'Alternate Views', 'pivot')
            );

            const visibilityObserver = new MutationObserver(() => {
                try {
                    ensureMenuVisibility();
                } catch (error) {
                    logError('Error in visibility observer', error);
                }
            });
            visibilityObserver.observe(document.body, {
                attributes: true,
                subtree: true,
                childList: true
            });

            logInfo('Floating menu injection complete');
        } catch (error) {
            logError('Error injecting floating menu', error);
        }
    }

    let injectionAttempts = 0;
    const maxAttempts = 5;

    function tryInjectFloatingMenu() {
        try {
            if (document.body && !document.getElementById('timio-floating-menu')) {
                logInfo(`Attempt ${injectionAttempts + 1} to inject floating menu`);
                injectFloatingMenu();
                return true;
            }
            return false;
        } catch (error) {
            logError('Error in tryInjectFloatingMenu', error);
            return false;
        }
    }

    function attemptInjection() {
        try {
            injectionAttempts++;

            if (!shouldInjectTIMIO()) {
                logInfo('TIMIO will not be injected on this site');
                return;
            }

            if (tryInjectFloatingMenu()) {
                logInfo('Menu injected successfully');
            } else if (injectionAttempts < maxAttempts) {
                logInfo(`Menu injection attempt ${injectionAttempts} failed, trying again...`);
                setTimeout(attemptInjection, injectionAttempts * 300);
            } else {
                logInfo('Maximum injection attempts reached');
            }
        } catch (error) {
            logError('Error in attemptInjection', error);
        }
    }

    // Initialize injection
    try {
        if (document.body) {
            if (shouldInjectTIMIO()) {
                attemptInjection();
            }
        } else {
            const bodyObserver = new MutationObserver(() => {
                try {
                    if (document.body) {
                        bodyObserver.disconnect();
                        if (shouldInjectTIMIO()) {
                            attemptInjection();
                        }
                    }
                } catch (error) {
                    logError('Error in body observer', error);
                }
            });

            bodyObserver.observe(document.documentElement, {
                childList: true,
                subtree: true
            });

            document.addEventListener('DOMContentLoaded', () => {
                try {
                    if (!document.getElementById('timio-floating-menu') && shouldInjectTIMIO()) {
                        attemptInjection();
                    }
                } catch (error) {
                    logError('Error in DOMContentLoaded handler', error);
                }
            });
        }

        window.addEventListener('load', () => {
            try {
                if (!document.getElementById('timio-floating-menu') && shouldInjectTIMIO()) {
                    attemptInjection();
                }
            } catch (error) {
                logError('Error in window load handler', error);
            }
        });
    } catch (error) {
        logError('Error in initialization', error);
    }

    function extractArticleText() {
        try {
            if (typeof Readability !== 'undefined') {
                const docClone = document.cloneNode(true);
                const reader = new Readability(docClone);
                const article = reader.parse();
                if (article && article.textContent && article.textContent.trim().length > 0) {
                    logInfo('Readability extracted article:', article.title);
                    return article.textContent;
                }
            }
        } catch (e) {
            logError('Readability extraction failed', e);
        }
        return document.body.innerText || '';
    }

    // Global error handler for the content script
    window.addEventListener('error', (event) => {
        logError('Unhandled error in content script', event.error, {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    });

    // Listen for extension context invalidation
    if (chrome.runtime) {
        try {
            chrome.runtime.onConnect.addListener(() => {
                // This will throw if context is invalid
            });
        } catch (error) {
            isExtensionContextValid = false;
            logError('Extension context invalidated on startup', error);
        }
    }

})();