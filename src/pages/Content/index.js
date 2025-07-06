// src/pages/Content/index.js

import Readability from './Readability.js'; 

console.log('Hello, world!');
console.log('Content script loaded');

(() => {
    let timioFloatingMenu = null;
    let timioModal = null;
    let isExtensionContextValid = true;
    let loadingSequenceCleanup = null;

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
                        handleExtensionReload();
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

    function handleExtensionReload() {
        if (!timioModal) return;

        const spinner = timioModal.querySelector('.timio-spinner');
        const content = timioModal.querySelector('.timio-insights-content');
        const pivotContent = timioModal.querySelector('.timio-pivot-content');

        if (spinner) spinner.style.display = 'none';

        const errorContainer = content || pivotContent;
        if (errorContainer) {
            errorContainer.style.display = 'block';
            errorContainer.innerHTML = `
                <div class="timio-error-message">
                    <svg class="timio-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p class="timio-error-title">Extension Updated</p>
                    <p class="timio-error-text">Please refresh the page to continue using the extension.</p>
                    <button class="timio-refresh-button" onclick="window.location.reload()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M21 12a9 9 0 11-9-9c2.52 0 4.85.99 6.57 2.57L21 8"></path>
                            <path d="M21 3v5h-5"></path>
                        </svg>
                        Refresh Page
                    </button>
                </div>
            `;
        }
    }

    function formatInsights(insights) {
        if (!insights) return '<p>No insights available</p>';

        let insightContent = insights;
        if (typeof insights === 'object' && insights.article_insight) {
            insightContent = insights.article_insight;
        }

        // Clean up the content
        insightContent = insightContent
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .replace(/\\'/g, "'")
            .trim();

        const sections = insightContent
            .split(/\n\s*\n/)
            .filter(section => section.trim().length > 0)
            .map(section => section.trim());

        if (sections.length === 0) {
            return '<p>No structured insights available</p>';
        }

        return `
            <div style="padding: 16px;">
                ${sections
                    .map((section) => {
                        const lines = section.split('\n').filter(line => line.trim());
                        if (lines.length === 0) return '';

                        const title = lines[0].replace(/^\*\*|\*\*$/g, '').replace(/^#+\s*/, '').trim();
                        const points = lines.slice(1).filter(line => line.trim());

                        return `
                            <div class="timio-insight-section">
                                <h3 class="timio-insight-title">${title}</h3>
                                <ul class="timio-insight-list">
                                    ${points
                                        .map(point => {
                                            const cleanPoint = point
                                                .replace(/^[•\-\*]\s*/, '')
                                                .replace(/^\d+\.\s*/, '')
                                                .replace(/^\s*[\-\*]\s*/, '')
                                                .trim();
                                            
                                            if (cleanPoint.length === 0) return '';
                                            
                                            return `
                                                <li class="timio-insight-item">
                                                    ${cleanPoint}
                                                </li>
                                            `;
                                        })
                                        .filter(item => item.trim().length > 0)
                                        .join('')}
                                </ul>
                            </div>
                        `;
                    })
                    .filter(section => section.trim().length > 0)
                    .join('')}
            </div>
            <div style="text-align: center;">
                <button class="timio-copy-button">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Analysis
                </button>
            </div>
        `;
    }

    function formatPivotArticles(articles) {
        console.log('Received articles:', articles);

        if (!articles || articles.length === 0) {
            return `
                <div class="timio-error-message">
                    <svg class="timio-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                    <p class="timio-error-title">No Results Found</p>
                    <p class="timio-error-text">Unable to find related articles. Please try a different article.</p>
                </div>
            `;
        }

        const formatDate = (dateString) => {
            if (!dateString) return 'Recent';
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return 'Recent';
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                });
            } catch (e) {
                console.warn('Error formatting date:', e);
                return 'Recent';
            }
        };

        const getDomain = (url) => {
            try {
                return new URL(url).hostname.replace('www.', '');
            } catch (e) {
                console.warn('Error parsing URL:', e);
                return 'Unknown source';
            }
        };

        const truncateText = (text, maxLength = 150) => {
            if (!text) return 'No description available';
            text = text.replace(/&nbsp;/g, ' ').replace(/<[^>]*>/g, '');
            return text.length > maxLength ? 
                text.substring(0, maxLength).trim() + '...' : 
                text;
        };

        const articlesHTML = articles
            .map((article, index) => {
                console.log(`Processing article ${index + 1}:`, article);

                if (!article.url) {
                    console.warn('Article missing URL:', article);
                    return '';
                }

                const domain = article.source?.domain || getDomain(article.url);
                const description = article.description || article.summary || 'No description available';
                const date = formatDate(article.pubDate);
                const imageUrl = article.imageUrl || '';
                const title = article.title || 'Untitled';
                const authorsByline = article.authorsByline
                    ? article.authorsByline.split(',')[0]
                    : '';

                return `
                    <a href="${article.url}"
                        class="timio-pivot-article"
                        target="_blank"
                        rel="noopener noreferrer">
                        ${imageUrl ? `
                            <div class="timio-pivot-image">
                                <div class="timio-image-placeholder"></div>
                                <img src="${imageUrl}"
                                    alt="${title}"
                                    onload="this.previousElementSibling.style.display='none'"
                                    onerror="this.previousElementSibling.style.display='block';this.style.display='none'"
                                    loading="lazy">
                            </div>
                        ` : `
                            <div class="timio-pivot-image">
                                <div class="timio-image-placeholder"></div>
                            </div>
                        `}

                        <div class="timio-pivot-text">
                            <h3 class="timio-pivot-title">${title}</h3>
                            <p class="timio-pivot-description">${truncateText(description)}</p>
                            <div class="timio-pivot-meta">
                                <span class="timio-pivot-source">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path d="M21 2H3v16h5v4l4-4h5l4-4V2z"></path>
                                    </svg>
                                    ${domain}
                                </span>
                                <span class="timio-pivot-date">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <path d="M12 6v6l4 2"></path>
                                    </svg>
                                    ${date}
                                </span>
                                ${
                                    authorsByline
                                        ? `<span class="timio-pivot-author">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                                <circle cx="12" cy="7" r="4"></circle>
                                            </svg>
                                            ${authorsByline}
                                        </span>`
                                        : ''
                                }
                            </div>
                        </div>
                    </a>
                `;
            })
            .join('');

        return `
            <div class="timio-pivot-container">
                ${articlesHTML}
            </div>
        `;
    }

    function addCopyButtonListener() {
        const copyButton = document.querySelector('.timio-copy-button');
        if (!copyButton) return;

        copyButton.addEventListener('click', async () => {
            const insightsContent = document.querySelector('.timio-insights-content');
            const textToCopy = insightsContent.textContent.trim();

            try {
                await navigator.clipboard.writeText(textToCopy);
                copyButton.classList.add('copied');
                copyButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                `;

                setTimeout(() => {
                    copyButton.classList.remove('copied');
                    copyButton.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Analysis
                    `;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy text:', err);
            }
        });
    }

    function createModal() {
        if (timioModal) {
            return timioModal;
        }

        timioModal = document.createElement('div');
        timioModal.id = 'timio-modal';
        timioModal.className = 'timio-modal';
        
        timioModal.innerHTML = `
            <div class="timio-modal-content">
                <div class="timio-modal-header">
                    <h2 class="timio-modal-title">
                        <span class="timio-title-text">Torch's Insights</span>
                    </h2>
                    <button class="timio-modal-close">×</button>
                </div>
                <div class="timio-modal-body">
                    <div class="timio-spinner">
                        <div id="animation-container" class="timio-lottie-container"></div>
                        <p style="margin-top: 16px; color: #9ca3af;">Analyzing article...</p>
                    </div>
                    <div class="timio-insights-content" style="display: none;"></div>
                    <div class="timio-pivot-content" style="display: none;"></div>
                </div>
                <div class="timio-modal-footer">
                    <div class="timio-footer-content">
                        <a href="https://timio.news" class="timio-brand-link" target="_blank">
                            Powered by TIMIO
                        </a>
                        <div class="timio-footer-links">
                            <a href="https://timio.news/support" class="timio-support-link" target="_blank">Support</a>
                            <span class="timio-divider">•</span>
                            <a href="https://timio.news/privacy" class="timio-privacy-link" target="_blank">Privacy</a>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(timioModal);

        // Add close button listener
        const closeButton = timioModal.querySelector('.timio-modal-close');
        closeButton.addEventListener('click', () => {
            closeModal();
        });

        // Close on outside click
        timioModal.addEventListener('click', (e) => {
            if (e.target === timioModal) {
                closeModal();
            }
        });

        return timioModal;
    }

    function openModal() {
        if (!timioModal) {
            createModal();
        }
        timioModal.classList.add('active');
    }

    function closeModal() {
        if (timioModal) {
            timioModal.classList.remove('active');
            if (loadingSequenceCleanup) {
                loadingSequenceCleanup();
                loadingSequenceCleanup = null;
            }
        }
    }

    function startLoadingSequence(type) {
        const spinner = timioModal.querySelector('.timio-spinner');
        const progressBar = spinner.querySelector('.timio-progress-bar');
        const statusText = spinner.querySelector('.timio-status-text');

        const sequences = {
            torch: [
                { message: 'Scanning article...', progress: 15, duration: 1500 },
                { message: 'Analyzing content structure...', progress: 30, duration: 2000 },
                { message: 'Extracting key arguments...', progress: 45, duration: 2500 },
                { message: 'Evaluating evidence quality...', progress: 60, duration: 2000 },
                { message: 'Finding supporting references...', progress: 70, duration: 1800 },
                { message: 'Identifying main claims...', progress: 80, duration: 1500 },
                { message: 'Generating comprehensive insights...', progress: 90, duration: 3000 },
                { message: 'Finalizing analysis...', progress: 95, duration: 1500 },
            ],
            pivot: [
                { message: 'Scanning current article...', progress: 15, duration: 1500 },
                { message: 'Identifying key topics...', progress: 30, duration: 2000 },
                { message: 'Finding diverse viewpoints...', progress: 45, duration: 2200 },
                { message: 'Searching across publications...', progress: 60, duration: 2500 },
                { message: 'Filtering for relevance...', progress: 70, duration: 1800 },
                { message: 'Evaluating information quality...', progress: 80, duration: 2000 },
                { message: 'Finding trusted sources...', progress: 85, duration: 1500 },
                { message: 'Preparing alternative perspectives...', progress: 90, duration: 2000 },
                { message: 'Organizing recommendations...', progress: 95, duration: 1500 },
            ],
        };

        const steps = sequences[type];
        let currentStep = 0;

        let stuckTimeout = null;
        let waitInterval = null;

        if (loadingSequenceCleanup) {
            loadingSequenceCleanup();
        }

        stuckTimeout = setTimeout(() => {
            if (statusText) statusText.textContent = 'Almost there...';
            const stuckContainer = spinner.querySelector('.timio-stuck-container');
            if (stuckContainer) {
                stuckContainer.style.display = 'block';
            }
        }, 60000);

        function updateStep() {
            if (!progressBar || !statusText || currentStep >= steps.length) {
                return;
            }

            const step = steps[currentStep];
            progressBar.style.width = `${step.progress}%`;
            statusText.textContent = step.message;

            currentStep++;

            if (currentStep < steps.length) {
                setTimeout(updateStep, step.duration);
            } else {
                setTimeout(() => {
                    let waitingIndex = 0;
                    const waitingMessages = ['Almost there...', 'Finalizing results...'];

                    waitInterval = setInterval(() => {
                        if (statusText) {
                            statusText.textContent = waitingMessages[waitingIndex];
                            waitingIndex = (waitingIndex + 1) % waitingMessages.length;
                        } else {
                            clearInterval(waitInterval);
                        }
                    }, 5000);
                }, 1000);
            }
        }

        updateStep();

        loadingSequenceCleanup = () => {
            if (stuckTimeout) {
                clearTimeout(stuckTimeout);
                stuckTimeout = null;
            }
            if (waitInterval) {
                clearInterval(waitInterval);
                waitInterval = null;
            }
            const stuckContainer = spinner.querySelector('.timio-stuck-container');
            if (stuckContainer) {
                stuckContainer.style.display = 'none';
            }
        };
        return loadingSequenceCleanup;
    }

    // Load Lottie library if not available
    function loadLottieLibrary() {
        return new Promise((resolve, reject) => {
            if (typeof lottie !== 'undefined') {
                resolve();
                return;
            }

            console.log('Loading Lottie library...');
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
            script.onload = () => {
                console.log('Lottie library loaded successfully');
                resolve();
            };
            script.onerror = () => {
                console.error('Failed to load Lottie library');
                reject(new Error('Failed to load Lottie library'));
            };
            document.head.appendChild(script);
        });
    }

    function showLoadingInModal(title, animationType) {
        openModal();
        
        const modalTitle = timioModal.querySelector('.timio-modal-title');
        const spinner = timioModal.querySelector('.timio-spinner');
        const content = timioModal.querySelector('.timio-insights-content');
        const pivotContent = timioModal.querySelector('.timio-pivot-content');

        // Update title with icon
        const iconUrl = animationType === 'torch' 
            ? chrome.runtime.getURL('Torch_Icon.png')
            : chrome.runtime.getURL('Pivot_Icon.png');
        
        modalTitle.innerHTML = `
            <img src="${iconUrl}" alt="${animationType}" class="timio-title-icon">
            <span class="timio-title-text">${title}</span>
        `;

        // Create unique container for animation
        const containerId = `lottie-container-${Date.now()}`;

        spinner.innerHTML = `
            <div class="timio-loading-container">
                <div class="timio-loading-header">
                    <h3 class="timio-loading-title">${
                        animationType === 'torch'
                            ? 'Analyzing Article'
                            : 'Finding Related Articles'
                    }</h3>
                </div>
                
                <div class="timio-animation-wrapper">
                    <div id="${containerId}" class="timio-lottie-container">
                        <!-- Fallback will be removed when Lottie loads -->
                    </div>
                </div>

                <div class="timio-progress-section">
                    <div class="timio-progress">
                        <div class="timio-progress-bar" style="width: 0%;"></div>
                    </div>
                    <p class="timio-status-text">
                        ${
                            animationType === 'torch'
                                ? 'Scanning article...'
                                : 'Finding related articles...'
                        }
                    </p>
                </div>

                <div class="timio-stuck-container" style="display: none;">
                    <div class="timio-stuck-content">
                        <div class="timio-stuck-icon">⏰</div>
                        <p>Taking longer than expected?</p>
                        <div class="timio-stuck-actions">
                            <button class="timio-refresh-button" type="button">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 12a9 9 0 11-9-9c2.52 0 4.85.99 6.57 2.57L21 8"></path>
                                    <path d="M21 3v5h-5"></path>
                                </svg>
                                Try Again
                            </button>
                            <a href="https://timio.news/support" class="timio-help-link" target="_blank">
                                Get Help
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;

        spinner.style.display = 'flex';
        content.style.display = 'none';
        pivotContent.style.display = 'none';

        // Add refresh button listener
        const refreshButton = spinner.querySelector('.timio-refresh-button');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => {
                window.location.reload();
            });
        }

        // Load Lottie library first, then try to load animation
        loadLottieLibrary()
            .then(() => {
                const animationContainer = document.getElementById(containerId);
                if (animationContainer) {
                    // Add initial loading spinner
                    animationContainer.innerHTML = '<div class="timio-spinner-fallback"></div>';
                    
                    try {
                        console.log('Attempting to load Lottie animation...');
                        console.log('Lottie available:', typeof lottie !== 'undefined');
                        
                        if (typeof lottie !== 'undefined') {
                            const animationPath = chrome.runtime.getURL(`assets/animations/${animationType}.json`);
                            console.log('Animation path:', animationPath);
                            
                            // Test if the file exists by fetching it first
                            fetch(animationPath)
                                .then(response => {
                                    console.log('Animation file fetch response:', response.status);
                                    if (response.ok) {
                                        return response.json();
                                    } else {
                                        throw new Error(`Failed to fetch animation: ${response.status}`);
                                    }
                                })
                                .then(animationData => {
                                    console.log('Animation data loaded, creating Lottie animation...');
                                    // Clear any fallback content
                                    animationContainer.innerHTML = '';
                                    
                                    lottie.loadAnimation({
                                        container: animationContainer,
                                        renderer: 'svg',
                                        loop: true,
                                        autoplay: true,
                                        animationData: animationData,
                                        onComplete: () => {
                                            console.log(`${animationType} animation loaded successfully`);
                                        },
                                        onError: (error) => {
                                            console.error(`${animationType} animation error:`, error);
                                            animationContainer.innerHTML = `<div class="timio-spinner-fallback"></div>`;
                                        }
                                    });
                                })
                                .catch(error => {
                                    console.error('Failed to load animation file:', error);
                                    console.log('Falling back to spinner...');
                                    animationContainer.innerHTML = `<div class="timio-spinner-fallback"></div>`;
                                });
                        } else {
                            console.warn('Lottie library still not available after loading attempt');
                            animationContainer.innerHTML = `<div class="timio-spinner-fallback"></div>`;
                        }
                    } catch (error) {
                        console.error('Animation setup failed:', error);
                        animationContainer.innerHTML = `<div class="timio-spinner-fallback"></div>`;
                    }
                }
            })
            .catch(error => {
                console.error('Failed to load Lottie library:', error);
                const animationContainer = document.getElementById(containerId);
                if (animationContainer) {
                    animationContainer.innerHTML = `<div class="timio-spinner-fallback"></div>`;
                }
            });

        // Start the loading sequence
        loadingSequenceCleanup = startLoadingSequence(animationType);
    }

    function showResultsInModal(results) {
        if (loadingSequenceCleanup) {
            loadingSequenceCleanup();
            loadingSequenceCleanup = null;
        }

        const spinner = timioModal.querySelector('.timio-spinner');
        const content = timioModal.querySelector('.timio-insights-content');
        const pivotContent = timioModal.querySelector('.timio-pivot-content');

        spinner.style.display = 'none';

        if (results.insights) {
            pivotContent.style.display = 'none';
            content.style.display = 'block';
            content.innerHTML = formatInsights(results.insights);
            setTimeout(() => {
                addCopyButtonListener();
            }, 100);
        } else if (results.articles) {
            content.style.display = 'none';
            pivotContent.style.display = 'block';
            pivotContent.innerHTML = formatPivotArticles(results.articles);
        } else if (results.error) {
            const errorContainer = (pivotContent && pivotContent.style.display === 'block') ? pivotContent : content;
            const otherContainer = (errorContainer === content) ? pivotContent : content;

            if (otherContainer) otherContainer.style.display = 'none';
            if (errorContainer) {
                errorContainer.style.display = 'block';
                errorContainer.innerHTML = `
                    <div class="timio-error-message">
                        <svg class="timio-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <p class="timio-error-title">Error</p>
                        <p class="timio-error-text">${results.error}</p>
                        <button class="timio-refresh-button" onclick="window.location.reload()">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M21 12a9 9 0 11-9-9c2.52 0 4.85.99 6.57 2.57L21 8"></path>
                                <path d="M21 3v5h-5"></path>
                            </svg>
                            Refresh Page
                        </button>
                    </div>
                `;
            }
        }
    }

    // FULLSCREEN HANDLERS
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
                closeModal();
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

    // MESSAGE LISTENER SETUP
    if (checkExtensionContext() && chrome.runtime && chrome.runtime.onMessage) {
        try {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                try {
                    logInfo('Content script received message:', request);
                    
                    if (request.type === 'TOGGLE_FLOATING_MENU') {
                        applyFloatingMenuVisibility(request.isVisible);
                        sendResponse({ status: 'success' });
                    } else if (request.type === 'SHOW_LOADING') {
                        showLoadingInModal(request.title, request.animationType);
                        sendResponse({ status: 'loading displayed' });
                    } else if (request.type === 'SHOW_RESULTS') {
                        showResultsInModal(request);
                        sendResponse({ status: 'results displayed' });
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

    // STORAGE CHANGE LISTENER SETUP
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

                // Show loading immediately in modal
                showLoadingInModal(title, animationType);

                const articleText = extractArticleText();
                logInfo('Extracted article text for sending:', articleText.slice(0, 200));

                // Send message to background for processing
                const success = safeChromeSend({
                    type: 'PROCESS_ARTICLE',
                    action: action,
                    title: title,
                    animationType: animationType,
                    content: articleText,
                    url: window.location.href,
                    userGesture: true,
                    useContentScript: true
                }, (response) => {
                    logInfo('Response from background:', response);
                    if (response && response.error) {
                        showResultsInModal({ error: response.error });
                    }
                });

                if (!success) {
                    logError('Failed to send message to background - extension context may be invalid');
                    showResultsInModal({ error: 'Extension error. Please refresh the page and try again.' });
                }

            } catch (error) {
                logError('Content script button click handler failed', error, {
                    action,
                    title,
                    animationType,
                });
                
                showResultsInModal({ error: `Failed to process article: ${error.message}` });
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

            if (dragHandle) {
                dragHandle.addEventListener('mousedown', dragMouseDown);
                dragHandle.addEventListener('touchstart', dragTouchStart, { passive: false });
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

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (loadingSequenceCleanup) {
            loadingSequenceCleanup();
        }
    });

})();