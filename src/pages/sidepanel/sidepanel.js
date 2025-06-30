// src/pages/sidepanel/sidepanel.js
// Import the CSS file so webpack processes it
import './sidepanel.css';

// This script runs within the Side Panel HTML.

let loadingSequenceCleanup = null; // To store the cleanup function from startSimpleLoadingSequence

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('timio-modal');
  const spinner = modal.querySelector('.timio-spinner');
  const content = modal.querySelector('.timio-insights-content');
  const pivotContent = modal.querySelector('.timio-pivot-content');
  const modalTitle = modal.querySelector('.timio-modal-title');

  // Initialize header animation
  initializeHeaderAnimation();

  // Utility functions (copied from content/index.js - keep consistent)
  function formatInsights(insights) {
    if (!insights) return '<p>No insights available</p>';

    let insightContent = insights;
    if (typeof insights === 'object' && insights.article_insight) {
      insightContent = insights.article_insight;
    }

    // Clean up the content - this addresses the formatting inconsistency issue
    insightContent = insightContent
      .replace(/\\n/g, '\n')           // Convert literal \n to actual newlines
      .replace(/\\"/g, '"')            // Convert escaped quotes
      .replace(/\\\\/g, '\\')          // Convert double backslashes
      .replace(/\\'/g, "'")            // Convert escaped single quotes
      .trim();                         // Remove leading/trailing whitespace

    // Split content into sections more reliably
    const sections = insightContent
      .split(/\n\s*\n/)                // Split on double newlines (paragraph breaks)
      .filter(section => section.trim().length > 0) // Remove empty sections
      .map(section => section.trim()); // Clean each section

    if (sections.length === 0) {
      return '<p>No structured insights available</p>';
    }

    return `
      <div style="padding: 16px;">
        ${sections
          .map((section) => {
            // More robust section parsing
            const lines = section.split('\n').filter(line => line.trim());
            if (lines.length === 0) return '';

            // First line is likely the title
            const title = lines[0].replace(/^\*\*|\*\*$/g, '').replace(/^#+\s*/, '').trim();
            const points = lines.slice(1).filter(line => line.trim());

            return `
              <div class="timio-insight-section">
                <h3 class="timio-insight-title">${title}</h3>
                <ul class="timio-insight-list">
                  ${points
                    .map(point => {
                      // Clean up bullet points and formatting
                      const cleanPoint = point
                        .replace(/^[•\-\*]\s*/, '')    // Remove bullet characters
                        .replace(/^\d+\.\s*/, '')      // Remove numbered list markers
                        .replace(/^\s*[\-\*]\s*/, '')  // Remove dash/asterisk bullets
                        .trim();
                      
                      if (cleanPoint.length === 0) return '';
                      
                      return `
                        <li class="timio-insight-item">
                          ${cleanPoint}
                        </li>
                      `;
                    })
                    .filter(item => item.trim().length > 0) // Remove empty items
                    .join('')}
                </ul>
              </div>
            `;
          })
          .filter(section => section.trim().length > 0) // Remove empty sections
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

    const articlesHTML = articles
      .map((article, index) => {
        console.log(`Processing article ${index + 1}:`, article);

        if (!article.url) {
          console.warn('Article missing URL:', article);
          return '';
        }

        const domain = article.source?.domain || getDomain(article.url);
        const date = formatDate(article.pubDate);
        const fallbackImageUrl = `https://api.microlink.io/?url=${encodeURIComponent(
          article.url
        )}&meta=false&embed=image.url`;
        const imageUrl = article.imageUrl || fallbackImageUrl;
        const title = article.title || 'Untitled';
        const authorsByline = article.authorsByline
          ? article.authorsByline.split(',')[0]
          : '';

        return `
          <a href="${article.url}"
            class="timio-pivot-article"
            target="_blank"
            rel="noopener noreferrer">
            <div class="timio-pivot-image">
              <div class="timio-image-placeholder"></div>
              <img src="${imageUrl}"
                alt="${title}"
                onerror="this.style.display='none'; this.previousElementSibling.style.display='block'"
                onload="this.previousElementSibling.style.display='none'"
                loading="lazy"
                crossorigin="anonymous">
            </div>

            <div class="timio-pivot-text">
              <h3 class="timio-pivot-title">${title}</h3>
              <div class="timio-pivot-meta">
                <span class="timio-pivot-date">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 6v6l4 2"></path>
                  </svg>
                  ${date}
                </span>
                <span class="timio-pivot-source">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 2H3v16h5v4l4-4h5l4-4V2z"></path>
                  </svg>
                  ${domain}
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

  function initializeHeaderAnimation() {
    const headerAnimation = document.getElementById('header-animation');
    if (!headerAnimation) return;

    // Create animated logo using CSS animation instead of Lottie for the header
    headerAnimation.innerHTML = `
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="url(#logoGradient)" stroke-width="2.5">
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#60a5fa"/>
            <stop offset="100%" style="stop-color:#3b82f6"/>
          </linearGradient>
        </defs>
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    `;
    
    // Apply the pulsing animation
    headerAnimation.style.animation = 'logoPulse 2s ease-in-out infinite';
  }

  function startSimpleLoadingSequence(type) {
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

    console.log('Setting stuck timeout for 60 seconds');
    let stuckContainer = spinner.querySelector('.timio-stuck-container');
    if (!stuckContainer) {
      stuckContainer = document.createElement('div');
      stuckContainer.className = 'timio-stuck-container';
      stuckContainer.innerHTML = `
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
      `;
      spinner.appendChild(stuckContainer);
      const refreshButton = stuckContainer.querySelector('.timio-refresh-button');
      refreshButton.addEventListener('click', () => {
        console.log('Refresh button clicked from sidepanel');
        chrome.runtime.sendMessage({ action: 'reloadActiveTab' });
      });
    }
    stuckContainer.style.display = 'none';

    stuckTimeout = setTimeout(() => {
      console.log('Stuck timeout triggered');
      if (statusText) statusText.textContent = 'Almost there...';
      const currentStuckContainer = spinner.querySelector('.timio-stuck-container');
      if (currentStuckContainer) {
        currentStuckContainer.style.display = 'block';
        console.log('Showing stuck container:', currentStuckContainer);
      } else {
        console.log('Stuck container not found at timeout');
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
      const currentStuckContainer = spinner.querySelector('.timio-stuck-container');
      if (currentStuckContainer) {
        currentStuckContainer.style.display = 'none';
      }
      // Stop Lottie animation if any
      if (window.lottie && window.lottie.destroy) {
        window.lottie.destroy();
      }
    };
    return loadingSequenceCleanup;
  }

  // Listener for messages from the background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Side Panel received message:', request);

    if (request.type === 'SHOW_LOADING') {
      modalTitle.textContent = request.title;

      spinner.innerHTML = `
        <div class="timio-loading-container">
          <div class="timio-loading-header">
            <div class="timio-pulse-indicator"></div>
            <h3 class="timio-loading-title">${
              request.animationType === 'torch'
                ? 'Analyzing Article'
                : 'Finding Related Articles'
            }</h3>
          </div>
          
          <div class="timio-animation-wrapper">
            <div id="animation-container" class="timio-lottie-container">
              <div class="timio-fallback-animation">
                <div class="timio-orbit">
                  <div class="timio-planet"></div>
                  <div class="timio-moon"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="timio-progress-section">
            <div class="timio-progress">
              <div class="timio-progress-bar" style="width: 0%;">
                <div class="timio-progress-glow"></div>
              </div>
            </div>
            <p class="timio-status-text">
              ${
                request.animationType === 'torch'
                  ? 'Scanning article...'
                  : 'Finding related articles...'
              }
            </p>
          </div>

          <div class="timio-features-preview">
            <div class="timio-feature-item">
              <div class="timio-feature-icon">🔍</div>
              <span>Deep Content Analysis</span>
            </div>
            <div class="timio-feature-item">
              <div class="timio-feature-icon">🧠</div>
              <span>AI-Powered Insights</span>
            </div>
            <div class="timio-feature-item">
              <div class="timio-feature-icon">📊</div>
              <span>Bias Detection</span>
            </div>
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

      const refreshButton = spinner.querySelector('.timio-refresh-button');
      if (refreshButton) {
        refreshButton.addEventListener('click', () => {
          console.log('Refresh button clicked from dynamically created element (sidepanel)');
          chrome.runtime.sendMessage({ action: 'reloadActiveTab' });
        });
      }

      spinner.style.display = 'flex';
      content.style.display = 'none';
      pivotContent.style.display = 'none';

      // Load Lottie animation (removed container background styling)
      const animationContainer = document.getElementById('animation-container');
      if (animationContainer && typeof window.lottie !== 'undefined') {
        const animationPath = chrome.runtime.getURL(
          `assets/animations/${request.animationType}.json`
        );

        if (window.lottie.destroy) {
          window.lottie.destroy();
        }

        window.lottie.loadAnimation({
          container: animationContainer,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: animationPath,
          onComplete: () => {
            console.log(`${request.animationType} animation loaded successfully`);
          },
          onError: (error) => {
            console.error(`${request.animationType} animation error:`, error);
            // Show fallback animation if Lottie fails
            animationContainer.innerHTML = `
              <div class="timio-fallback-animation">
                <div class="timio-orbit">
                  <div class="timio-planet"></div>
                  <div class="timio-moon"></div>
                </div>
              </div>
            `;
          },
        });
      } else if (animationContainer) {
        console.error('Lottie library not loaded or animation container not found.');
        // Show fallback animation
        animationContainer.innerHTML = `
          <div class="timio-fallback-animation">
            <div class="timio-orbit">
              <div class="timio-planet"></div>
              <div class="timio-moon"></div>
            </div>
          </div>
        `;
      }

      loadingSequenceCleanup = startSimpleLoadingSequence(request.animationType);
      sendResponse({ status: 'loading displayed' });

    } else if (request.type === 'SHOW_RESULTS') {
      if (loadingSequenceCleanup) {
        loadingSequenceCleanup();
        loadingSequenceCleanup = null;
      }

      spinner.style.display = 'none';

      if (request.insights) {
        pivotContent.style.display = 'none';
        content.style.display = 'block';
        content.innerHTML = formatInsights(request.insights);
        setTimeout(() => {
          addCopyButtonListener();
        }, 100);
      } else if (request.articles) {
        content.style.display = 'none';
        pivotContent.style.display = 'block';
        pivotContent.innerHTML = formatPivotArticles(request.articles);
      } else if (request.error) {
        const errorContainer =
          (pivotContent && pivotContent.style.display === 'block') ? pivotContent : content;
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
              <p class="timio-error-text">${request.error}</p>
              <button class="timio-refresh-button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M21 12a9 9 0 11-9-9c2.52 0 4.85.99 6.57 2.57L21 8"></path>
                  <path d="M21 3v5h-5"></path>
                </svg>
                Refresh Page
              </button>
            </div>
          `;
          const refreshButton = errorContainer.querySelector('.timio-refresh-button');
          if (refreshButton) {
            refreshButton.addEventListener('click', () => {
              chrome.runtime.sendMessage({ action: 'reloadActiveTab' });
            });
          }
        }
      }
      sendResponse({ status: 'results displayed' });
    }
    return true;
  });

  window.addEventListener('beforeunload', () => {
    if (loadingSequenceCleanup) {
      loadingSequenceCleanup();
    }
  });
});