import Readability from './Readability.js';

console.log('Hello, world!');
// Add this at the start of your content.js, before the IIFE
console.log('Content script loaded');

(() => {

  function shouldInjectTIMIO() {
    const hostname = window.location.hostname.toLowerCase();
    
    // List of sites to exclude (social media, video streaming, email, productivity)
    const excludedSites = [
      // Video platforms
      'youtube.com', 'netflix.com', 'hulu.com', 'vimeo.com', 'twitch.tv',
      'primevideo.com', 'disneyplus.com', 'hbomax.com', 'peacocktv.com',
      'paramountplus.com', 'discoveryplus.com', 'dailymotion.com',
      
      // Social media
      'facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com', 'pinterest.com',
      'reddit.com', 'linkedin.com', 'snapchat.com', 'whatsapp.com', 'telegram.org',
      'discord.com', 'tumblr.com',
      
      // Email & productivity
      'gmail.com', 'outlook.com', 'mail.yahoo.com', 'protonmail.com', 'zoho.com',
      'drive.google.com', 'docs.google.com', 'sheets.google.com', 'slides.google.com',
      'office.com', 'notion.so', 'trello.com', 'asana.com', 'monday.com',
      
      // Development & code
      'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'replit.com',
      'codepen.io', 'codesandbox.io', 'jsfiddle.net',
      
      // Shopping
      'amazon.com', 'ebay.com', 'walmart.com', 'target.com', 'etsy.com',
      'bestbuy.com', 'aliexpress.com',
      
      // Other common sites
      'wikipedia.org', 'quora.com', 'maps.google.com', 'meet.google.com',
      'zoom.us', 'calendar.google.com'
    ];
    
    // Check if current site matches any in the exclusion list
    for (const site of excludedSites) {
      if (hostname === site || hostname.endsWith('.' + site)) {
        console.log(`TIMIO: Excluded site detected: ${hostname}`);
        return false;
      }
    }
    
    // Also check for fullscreen mode
    if (document.fullscreenElement || 
        document.webkitFullscreenElement || 
        document.mozFullScreenElement ||
        document.msFullscreenElement) {
      console.log('TIMIO: Fullscreen mode detected, not injecting');
      return false;
    }
    
    return true;
  }

  // Add the fullscreen event listeners right after the function
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);

  function handleFullscreenChange() {
    const menu = document.getElementById('timio-floating-menu');
    const modal = document.getElementById('timio-modal');
    
    if (document.fullscreenElement || 
        document.webkitFullscreenElement || 
        document.mozFullScreenElement ||
        document.msFullscreenElement) {
      // Hide UI during fullscreen
      if (menu) menu.style.display = 'none';
      if (modal) modal.classList.remove('active');
    } else {
      // Show UI again after exiting fullscreen (but only if we should show on this site)
      if (shouldInjectTIMIO()) {
        if (menu) menu.style.display = 'block';
      }
    }
  }

  let port = null;

  function createPort() {
    console.log('Starting port creation process');

    try {
      if (port) {
        console.log('Existing port found, attempting cleanup');
        try {
          port.disconnect();
          console.log('Existing port disconnected successfully');
        } catch (e) {
          console.warn('Port cleanup error:', e);
        }
      }

      console.log('Creating new port connection');
      const newPort = chrome.runtime.connect({ name: 'timio-extension' });
      console.log('New port created successfully:', newPort);

      newPort.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError;
        console.log('Port disconnected. Error:', error);

        if (error && error.message === 'Extension context invalidated.') {
          console.log('Extension context invalidated, showing reload message');
          handleExtensionReload();
        } else {
          console.log('Attempting to reconnect port in 1 second');
          setTimeout(() => {
            port = createPort();
          }, 1000);
        }
      });

      newPort.onMessage.addListener((msg) => {
        console.log('Port received message:', msg);
      });

      return newPort;
    } catch (error) {
      console.error('Port creation failed:', {
        error,
        stack: error.stack,
        lastError: chrome.runtime.lastError,
      });

      if (error.message.includes('Extension context invalidated')) {
        console.log('Extension context invalidated during port creation');
        handleExtensionReload();
      }
      return null;
    }
  }

  // Define the ensureMenuVisibility function
function ensureMenuVisibility() {
  const menu = document.getElementById('timio-floating-menu');
  if (menu) {
    // Force highest z-index
    menu.style.zIndex = '2147483647';
    menu.style.visibility = 'visible';
    menu.style.opacity = '1';
    menu.style.display = 'block';
  }
}

  function handleExtensionReload() {
    const modal = document.getElementById('timio-modal');
    if (!modal) return;

    const spinner = modal.querySelector('.timio-spinner');
    const content = modal.querySelector('.timio-insights-content');
    const pivotContent = modal.querySelector('.timio-pivot-content');

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

    insightContent = insightContent
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\/g, '');

    const sections = insightContent
      .split('\n\n')
      .filter((section) => section.trim());

    return `
            <div style="padding: 16px;">
                ${sections
                  .map((section) => {
                    const [title, ...points] = section.split('\n');

                    return `
                        <div class="timio-insight-section">
                            <h3 class="timio-insight-title">${title.replace(
                              /\*\*/g,
                              ''
                            )}</h3>
                            <ul class="timio-insight-list">
                                ${points
                                  .map(
                                    (point) => `
                                    <li class="timio-insight-item">
                                        ${point.replace(/^[•\-]\s*/, '').trim()}
                                    </li>
                                `
                                  )
                                  .join('')}
                            </ul>
                        </div>
                    `;
                  })
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
    console.log('Received articles:', articles); // Log the received articles for debugging

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

    // Helper functions for fallback values
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

    

    // Generate HTML for each article
    const articlesHTML = articles
      .map((article, index) => {
        console.log(`Processing article ${index + 1}:`, article); // Log each article for debugging
        console.log('Article data:', article);

        if (!article.url) {
          console.warn('Article missing URL:', article);
          return ''; // Skip articles without a URL
        }

        const domain = article.source?.domain || getDomain(article.url);
        // Show the article description/summary, or nothing if not available
        
        const date = formatDate(article.pubDate);
        const fallbackImageUrl = `https://api.microlink.io/?url=${encodeURIComponent(article.url)}&meta=false&embed=image.url`;
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

  function startSimpleLoadingSequence(type, progressBar, statusText) {
    const sequences = {
      torch: [
        { message: "Scanning article...", progress: 15, duration: 1500 },
        { message: "Analyzing content structure...", progress: 30, duration: 2000 },
        { message: "Extracting key arguments...", progress: 45, duration: 2500 },
        { message: "Evaluating evidence quality...", progress: 60, duration: 2000 },
        { message: "Finding supporting references...", progress: 70, duration: 1800 },
        { message: "Identifying main claims...", progress: 80, duration: 1500 },
        { message: "Generating comprehensive insights...", progress: 90, duration: 3000 },
        { message: "Finalizing analysis...", progress: 95, duration: 1500 }
      ],
      pivot: [
        { message: "Scanning current article...", progress: 15, duration: 1500 },
        { message: "Identifying key topics...", progress: 30, duration: 2000 },
        { message: "Finding diverse viewpoints...", progress: 45, duration: 2200 },
        { message: "Searching across publications...", progress: 60, duration: 2500 },
        { message: "Filtering for relevance...", progress: 70, duration: 1800 },
        { message: "Evaluating information quality...", progress: 80, duration: 2000 },
        { message: "Finding trusted sources...", progress: 85, duration: 1500 },
        { message: "Preparing alternative perspectives...", progress: 90, duration: 2000 },
        { message: "Organizing recommendations...", progress: 95, duration: 1500 }
      ]
    };
    
    const steps = sequences[type];
    let currentStep = 0;
    
    // Get the modal element to help with locating elements
    const modal = document.getElementById('timio-modal');
    const spinner = modal.querySelector('.timio-spinner');
    
    // Find or create the loading column
    let loadingColumn = progressBar.closest('.timio-loading-column');
    if (!loadingColumn) {
      console.log('Loading column not found, creating one');
      loadingColumn = document.createElement('div');
      loadingColumn.className = 'timio-loading-column';
      spinner.appendChild(loadingColumn);
      // Move the existing elements into the column
      const lottieContainer = spinner.querySelector('.timio-lottie-container');
      const progressContainer = spinner.querySelector('.timio-progress');
      const statusTextElement = spinner.querySelector('.timio-status-text');
      if (lottieContainer) loadingColumn.appendChild(lottieContainer);
      if (progressContainer) loadingColumn.appendChild(progressContainer);
      if (statusTextElement) loadingColumn.appendChild(statusTextElement);
    }
    
    // Create or find the stuck container
    let stuckContainer = loadingColumn.querySelector('.timio-stuck-container');
    if (!stuckContainer) {
      console.log('Creating stuck container');
      stuckContainer = document.createElement('div');
      stuckContainer.className = 'timio-stuck-container';
      stuckContainer.style.display = 'none';
      stuckContainer.innerHTML = `
        <p>Stuck loading?</p>
        <button class="timio-refresh-button">Try refreshing</button>
        <a href="https://timio.news/support" class="timio-troubleshooting-link" target="_blank">View our troubleshooting page</a>
      `;
      loadingColumn.appendChild(stuckContainer);
      
      // Add click event to the refresh button
      const refreshButton = stuckContainer.querySelector('.timio-refresh-button');
      refreshButton.addEventListener('click', () => {
        console.log('Refresh button clicked');
        window.location.reload();
      });
    }
    
    // Set a timeout to show the stuck message after 60 seconds
    console.log('Setting stuck timeout for 60 seconds');
    const stuckTimeout = setTimeout(() => {
      console.log('Stuck timeout triggered');
      if (statusText) statusText.textContent = "Almost there...";
      if (stuckContainer) {
        stuckContainer.style.display = 'block';
        console.log('Showing stuck container:', stuckContainer);
      } else {
        console.log('Stuck container not found at timeout');
      }
    }, 60000); // Changed from 40000 to 60000 milliseconds
    
    // Store the timeout ID to clear it if loading completes normally
    if (progressBar) {
      progressBar.stuckTimeout = stuckTimeout;
    }
    
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
        // When done with all steps, show waiting animation
        setTimeout(() => {
          let waitingIndex = 0;
          const waitingMessages = [
            "Almost there...",
            "Finalizing results...",
            "Just a moment longer...",
            "Processing final data...",
            "Preparing your results..."
          ];
          
          // Start waiting animation
          const waitInterval = setInterval(() => {
            if (statusText) {
              statusText.textContent = waitingMessages[waitingIndex];
              waitingIndex = (waitingIndex + 1) % waitingMessages.length;
            } else {
              clearInterval(waitInterval);
            }
          }, 3000);
          
          // Store interval reference in a property to clear it when needed
          progressBar.waitInterval = waitInterval;
        }, 1000);
      }
    }
    
    // Start the sequence
    updateStep();
    
    // Return a cleanup function
    return {
      cleanup: () => {
        // Clear the stuck timeout if it exists
        if (progressBar && progressBar.stuckTimeout) {
          clearTimeout(progressBar.stuckTimeout);
        }
        
        // Clear the waiting interval if it exists
        if (progressBar && progressBar.waitInterval) {
          clearInterval(progressBar.waitInterval);
        }
        
        // Hide the stuck container if it's showing
        if (stuckContainer) {
          stuckContainer.style.display = 'none';
        }
      }
    };
  }

  function handleButtonClick(action, title, animationType) {
    return async () => {
      console.log(
        `Button clicked - Action: ${action}, Title: ${title}, Animation: ${animationType}`
      );
  
      try {
        // Ensure port connection
        if (!port) {
          console.log('No port found, creating new port...');
          port = createPort();
          if (!port) {
            console.error('Failed to create port');
            handleExtensionReload();
            return;
          }
        }
  
        const modal = document.getElementById('timio-modal');
        if (!modal) {
          console.error('Modal element not found');
          return;
        }
  
        const spinner = modal.querySelector('.timio-spinner');
        const content = modal.querySelector('.timio-insights-content');
        const pivotContent = modal.querySelector('.timio-pivot-content');
  
        // Update modal title and show it
        modal.querySelector('.timio-modal-title').textContent = title;
        modal.classList.add('active');
  
        // Create unique container for animation
        const containerId = `lottie-container-${Date.now()}`;
  
        // Setup spinner with a SINGLE container for animation, progress and text
        spinner.innerHTML = `
          <div class="timio-loading-column">
            <!-- Animation container -->
            <div id="${containerId}" class="timio-lottie-container"></div>
            
            <!-- Progress bar -->
            <div class="timio-progress">
              <div class="timio-progress-bar" style="width: 0%;"></div>
            </div>
            
            <!-- Status text -->
            <p class="timio-status-text">
              ${animationType === 'torch' ? 'Scanning article...' : 'Finding related articles...'}
            </p>
          </div>
        `;
  
        // Show spinner, hide content
        spinner.style.display = 'flex';
        content.style.display = 'none';
        pivotContent.style.display = 'none';
  
        // Ensure the container exists before trying to set up animation
        const animationContainer = document.getElementById(containerId);
        if (!animationContainer) {
          console.error('Animation container not found');
          return;
        }
  
        // Load animation directly using Lottie
        try {
          const animationPath = chrome.runtime.getURL(`${animationType}.json`);
          lottie.loadAnimation({
            container: animationContainer,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: animationPath,
            onComplete: () => {
              console.log(`${animationType} animation loaded successfully`);
            },
            onError: (error) => {
              console.error(`${animationType} animation error:`, error);
              animationContainer.innerHTML = `
                <div class="timio-spinner-fallback"></div>
              `;
            },
          });
        } catch (error) {
          console.error('Animation setup failed:', error);
          animationContainer.innerHTML = `
            <div class="timio-spinner-fallback"></div>
          `;
        }
  
        // Create and start a simplified loading sequence that updates the existing elements
        // instead of creating new ones
        const progressBar = spinner.querySelector('.timio-progress-bar');
        const statusText = spinner.querySelector('.timio-status-text');
        
        // Start loading sequence
        startSimpleLoadingSequence(animationType, progressBar, statusText);
  
        // Extract the article text from the page
        const articleText = extractArticleText();
        console.log('[TIMIO] Extracted article text:', articleText.slice(0, 200)); // Log first 200 chars
        let message = { action, title };
  
        if (action === 'getInsights') {
          message.content = articleText;
        } else if (action === 'getPivotArticles') {
          message.url = window.location.href;
        }
  
        console.log('[TIMIO] Sending message through port:', message);
        // Send message through port
        port.postMessage(message);
        
        // Add a message listener for completion
        const messageListener = (response) => {
          if (response.insights || response.articles || response.error) {
            // Complete animation
            if (progressBar) progressBar.style.width = "100%";
            if (statusText) statusText.textContent = animationType === 'torch' ? 
              "Analysis complete!" : "Related articles found!";
            
            // Clear the stuck timeout if it exists
            if (progressBar && progressBar.stuckTimeout) {
              clearTimeout(progressBar.stuckTimeout);
              // Hide the stuck container if it was already showing
              const stuckContainer = spinner.querySelector('.timio-stuck-container');
              if (stuckContainer) stuckContainer.style.display = 'none';
            }
            
            // Clear any waiting interval
            if (progressBar && progressBar.waitInterval) {
              clearInterval(progressBar.waitInterval);
            }
            
            // Remove this listener to avoid duplication
            port.onMessage.removeListener(messageListener);
          }
        };
        
        port.onMessage.addListener(messageListener);
        
      } catch (error) {
        console.error('Button click handler failed:', {
          error,
          stack: error.stack,
          action,
          title,
          animationType,
        });
        handleExtensionReload();
      }
    };
  }
  

  function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let isDragging = false;
    let hasMoved = false;
    let startTime = 0;
    
    const dragHandle = element.querySelector('.timio-menu-button');
    const dragIndicator = element.querySelector('.timio-drag-indicator');
    
    // Mouse events
    if (dragHandle) {
      dragHandle.addEventListener('mousedown', dragMouseDown);
    }
    if (dragIndicator) {
      dragIndicator.addEventListener('mousedown', dragMouseDown);
    }
    
    // Touch events
    if (dragHandle) {
      dragHandle.addEventListener('touchstart', dragTouchStart, { passive: false });
    }
    if (dragIndicator) {
      dragIndicator.addEventListener('touchstart', dragTouchStart, { passive: false });
    }
  
    function dragMouseDown(e) {
      // Don't start drag if clicked on an action button
      if (e.target.classList.contains('timio-action-button') || 
          e.target.closest('.timio-action-button') ||
          e.target.closest('.timio-menu-items.active')) {
        return;
      }
      
      e.preventDefault();
      
      // Record start time for distinguishing between click and drag
      startTime = new Date().getTime();
      hasMoved = false;
      
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      isDragging = true;
      element.classList.add('dragging');
      
      document.addEventListener('mouseup', closeDragElement);
      document.addEventListener('mousemove', elementDrag);
    }
    
    function dragTouchStart(e) {
      // Don't start drag if touched on an action button
      if (e.target.classList.contains('timio-action-button') || 
          e.target.closest('.timio-action-button') ||
          e.target.closest('.timio-menu-items.active')) {
        return;
      }
      
      e.preventDefault();
      
      // Record start time for distinguishing between tap and drag
      startTime = new Date().getTime();
      hasMoved = false;
      
      const touch = e.touches[0];
      pos3 = touch.clientX;
      pos4 = touch.clientY;
      
      isDragging = true;
      element.classList.add('dragging');
      
      document.addEventListener('touchend', closeTouchDragElement);
      document.addEventListener('touchmove', elementTouchDrag, { passive: false });
    }
  
    function elementDrag(e) {
      if (!isDragging) return;
      
      e.preventDefault();
      
      // Calculate distance moved to differentiate between click and drag
      const moveX = Math.abs(pos3 - e.clientX);
      const moveY = Math.abs(pos4 - e.clientY);
      
      // If moved more than 5px in any direction, consider it a drag
      if (moveX > 5 || moveY > 5) {
        hasMoved = true;
      }
      
      // Calculate new position
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      updateElementPosition();
    }
    
    function elementTouchDrag(e) {
      if (!isDragging) return;
      
      e.preventDefault();
      
      const touch = e.touches[0];
      
      // Calculate distance moved to differentiate between tap and drag
      const moveX = Math.abs(pos3 - touch.clientX);
      const moveY = Math.abs(pos4 - touch.clientY);
      
      // If moved more than 5px in any direction, consider it a drag
      if (moveX > 5 || moveY > 5) {
        hasMoved = true;
      }
      
      pos1 = pos3 - touch.clientX;
      pos2 = pos4 - touch.clientY;
      pos3 = touch.clientX;
      pos4 = touch.clientY;
      
      updateElementPosition();
    }
    
    function updateElementPosition() {
      // Calculate new position
      const newTop = element.offsetTop - pos2;
      const newLeft = element.offsetLeft - pos1;
      
      // Update position
      element.style.top = newTop + "px";
      element.style.left = newLeft + "px";
      element.style.right = "auto";
      element.style.bottom = "auto";
      
      // Keep within viewport
      checkBoundaries(element);
    }
    
    function checkBoundaries(element) {
      const rect = element.getBoundingClientRect();
      
      // Ensure the menu stays within viewport bounds
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
    }
  
    function closeDragElement(e) {
      // Stop moving when mouse button is released
      const endTime = new Date().getTime();
      const timeDiff = endTime - startTime;
      
      isDragging = false;
      element.classList.remove('dragging');
      
      document.removeEventListener('mouseup', closeDragElement);
      document.removeEventListener('mousemove', elementDrag);
      
      // If it's a short interaction (< 200ms) and hasn't moved significantly, 
      // treat it as a click on the menu button
      if (timeDiff < 200 && !hasMoved) {
        // Handle as a click on the menu button - but only if we're clicking on the button itself
        if (e.target.classList.contains('timio-menu-button') || e.target.closest('.timio-menu-button')) {
          const toggle = document.getElementById('timio-toggle');
          const menuItems = document.querySelector('.timio-menu-items');
          const isOpen = menuItems.classList.contains('active');
          
          toggle.classList.toggle('active');
          menuItems.classList.toggle('active');
        }
      } else if (hasMoved) {
        // Only save position if we actually moved
        savePosition();
      }
    }
    
    function closeTouchDragElement(e) {
      // Stop moving when touch ends
      const endTime = new Date().getTime();
      const timeDiff = endTime - startTime;
      
      isDragging = false;
      element.classList.remove('dragging');
      
      document.removeEventListener('touchend', closeTouchDragElement);
      document.removeEventListener('touchmove', elementTouchDrag);
      
      // If it's a short interaction (< 200ms) and hasn't moved significantly, 
      // treat it as a tap on the menu button
      if (timeDiff < 200 && !hasMoved) {
        // Handle as a tap on the menu button - but only if we're tapping on the button itself
        if (e.target.classList.contains('timio-menu-button') || e.target.closest('.timio-menu-button')) {
          const toggle = document.getElementById('timio-toggle');
          const menuItems = document.querySelector('.timio-menu-items');
          const isOpen = menuItems.classList.contains('active');
          
          toggle.classList.toggle('active');
          menuItems.classList.toggle('active');
        }
      } else if (hasMoved) {
        // Only save position if we actually moved
        savePosition();
      }
    }
    
    function savePosition() {
      try {
        const position = {
          top: element.style.top,
          left: element.style.left,
          timestamp: Date.now() // Add timestamp for debugging
        };
        
        localStorage.setItem('timio-menu-position', JSON.stringify(position));
        console.log('Position saved:', position);
      } catch (e) {
        console.warn('Could not save menu position', e);
      }
    }
  }
  
  function restorePosition(element) {
    try {
      const savedPositionString = localStorage.getItem('timio-menu-position');
      
      if (savedPositionString) {
        const position = JSON.parse(savedPositionString);
        console.log('Restoring position:', position);
        
        // Validate position values before applying
        if (position.top && position.left) {
          // Apply the saved position
          element.style.top = position.top;
          element.style.left = position.left;
          element.style.right = "auto";
          element.style.bottom = "auto";
          
          // Verify the menu is visible after positioning
          setTimeout(() => {
            const rect = element.getBoundingClientRect();
            
            // If menu is off-screen, reset it
            if (rect.right <= 0 || rect.bottom <= 0 || 
                rect.left >= window.innerWidth || rect.top >= window.innerHeight) {
              console.log('Menu was positioned off-screen, resetting position');
              element.style.top = "auto";
              element.style.left = "auto";
              element.style.right = "24px";
              element.style.bottom = "24px";
            }
          }, 100);
        } else {
          // If position data is invalid, use default position
          element.style.top = "auto";
          element.style.left = "auto";
          element.style.right = "24px";
          element.style.bottom = "24px";
        }
      }
    } catch (e) {
      console.warn('Could not restore menu position', e);
      // Reset to default position on error
      element.style.top = "auto";
      element.style.left = "auto";
      element.style.right = "24px";
      element.style.bottom = "24px";
    }
  }

  function injectFloatingMenu() {
    // If already injected, just ensure visibility
    if (document.getElementById('timio-floating-menu')) {
      ensureMenuVisibility();
      return;
    }
    
    console.log('Injecting floating menu');
    
    // Create menu container with important inline styles for visibility
    const menuContainer = document.createElement('div');
    menuContainer.id = 'timio-floating-menu';
    menuContainer.style.cssText = 'position: fixed !important; bottom: 24px !important; right: 24px !important; z-index: 2147483647 !important; visibility: visible !important; opacity: 1 !important; display: block !important;';
    menuContainer.innerHTML = `
      <div class="timio-menu-container">
        <div class="timio-drag-indicator"></div>
        <div class="timio-menu-items">
          <button class="timio-action-button" id="timio-insights">
            <div class="button-image">
              <img src="${chrome.runtime.getURL('Torch_Icon.png')}" alt="Torch">
            </div>
            <span class="timio-tooltip">Torch</span>
          </button>
          <button class="timio-action-button" id="timio-pivot">
            <div class="button-image">
              <img src="${chrome.runtime.getURL('Pivot_Icon.png')}" alt="Pivot">
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
    
    // Initialize modal
    const modal = document.createElement('div');
    modal.id = 'timio-modal';
    modal.className = 'timio-modal';
    modal.innerHTML = `
      <div class="timio-modal-content">
        <div class="timio-modal-header">
          <h2 class="timio-modal-title">Torch's Insights</h2>
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
          <a href="https://timio.news/support" class="timio-support-link" target="_blank">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="timio-support-icon">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Need help? Visit our support page
          </a>
        </div>
      </div>
    `;
    const style = document.createElement('style');
    style.textContent = `
        #timio-floating-menu {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    user-select: none; /* Prevent text selection during drag */
    touch-action: none; /* Better touch handling */
    visibility: visible !important; /* Ensure menu is always visible */
    opacity: 1 !important; /* Ensure menu is always visible */
    transform: none !important; /* Prevent transform issues */
  }
  
     #timio-floating-menu.dragging {
    opacity: 0.8 !important;
    transition: opacity 0.2s ease;
    cursor: grabbing;
  }
      .timio-menu-container {
        position: relative;
      }
  
      .timio-menu-items {
        position: absolute;
        bottom: 80px;
        right: 8px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        opacity: 0;
        visibility: hidden;
        transform: translateY(20px);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
  
      .timio-menu-items.active {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }
  
      .timio-menu-button {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #3b82f6;
    border: none;
    cursor: grab; /* Change to grab cursor to indicate draggable */
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.5);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 0;
    position: relative;
    visibility: visible !important; /* Ensure button is always visible */
  }
  
      .timio-menu-button svg {
        width: 24px;
        height: 24px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
  
      .timio-menu-button .plus-icon {
        opacity: 1;
        transition: opacity 0.3s ease;
      }
  
      .timio-menu-button .arrow-icon {
        opacity: 0;
        position: absolute;
        transition: opacity 0.3s ease;
      }
  
      .timio-menu-button.active .plus-icon {
        opacity: 0;
      }
  
      .timio-menu-button.active .arrow-icon {
        opacity: 1;
      }
  
      .timio-menu-button:hover {
        transform: scale(1.05);
        background: #2563eb;
        box-shadow: 0 6px 16px rgba(59, 130, 246, 0.6);
      }
  
      /* Hide the drag indicator completely */
      .timio-drag-indicator {
        display: none !important;
      }
  
      .timio-action-button {
        width: 48px;
        height: 48px;
        padding: 0;          /* Explicitly remove padding */
        margin: 0;          /* Explicitly remove margin */
        border: none;
        cursor: pointer;
        position: relative;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        background: none;
        display: flex;       /* Changed to flex */
        align-items: center; /* Center vertically */
        justify-content: center; /* Center horizontally */
        outline: none;
      }
       
      .timio-loading-spinner {
        display: inline-block;
        width: 50px;
        height: 50px;
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: #3b82f6;
        animation: spin 1s ease-in-out infinite;
      }
  
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
  
      .button-image {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;       /* Added flex display */
        align-items: center;
        justify-content: center;
      }
  
      .timio-action-button img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: contain;
        padding: 0;
        margin: 0;
      }
  
      .timio-action-button:hover {
        transform: scale(1.1);
      }
  
      .timio-action-button:hover .button-image {
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
      }
  
      .timio-tooltip {
        position: absolute;
        right: 64px;
        top: 50%;
        transform: translateY(-50%);
        background: #1f2937;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        white-space: nowrap;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }
  
      .timio-tooltip::after {
        content: '';
        position: absolute;
        right: -6px;
        top: 50%;
        transform: translateY(-50%);
        border-width: 6px;
        border-style: solid;
        border-color: transparent transparent transparent #1f2937;
      }
  
      .timio-action-button:hover .timio-tooltip {
        opacity: 1;
        visibility: visible;
        right: 60px;
      }
  
      .timio-modal {
        display: none;
        position: fixed;
        top: 0;
        right: 0;
        height: 100vh;
        width: 400px;
        background: #1a1a1a;
        box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
        z-index: 2147483646;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border-left: 1px solid rgba(255, 255, 255, 0.1);
      }
  
      .timio-modal.active {
        display: block;
        transform: translateX(0);
      }
  
      .timio-modal-content {
        background: #1a1a1a;
        height: 100%;
        width: 100%;
        display: flex;
        flex-direction: column;
      }
  
      .timio-modal-header {
        padding: 20px;
        background: #1a1a1a;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        position: relative;
      }
  
      .timio-modal-title {
        font-size: 18px;
        font-weight: 600;
        color: white;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 12px;
      }
  
      .timio-modal-close {
        position: absolute;
        top: 50%;
        right: 20px;
        transform: translateY(-50%);
        background: transparent;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        padding: 8px;
        font-size: 24px;
        border-radius: 6px;
        transition: all 0.2s ease;
      }
  
      .timio-modal-close:hover {
        color: white;
        background: rgba(255, 255, 255, 0.1);
      }
  
      .timio-modal-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        background: #1a1a1a;
        color: white;
      }
  
      /* Updated spinner styles for centered layout */
      .timio-spinner {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 200px;
        padding: 40px 20px;
        width: 100%;
        background: #1a1a1a;
      }
  
      /* Loading column layout styles */
      .timio-loading-column {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
      }
  
      /* Animation container */
      .timio-lottie-container {
        width: 300px;
        height: 300px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
      }
  
      /* Updated progress bar styles */
      .timio-progress {
        width: 80%;
        height: 4px;
        background: #2d2d2d;
        border-radius: 2px;
        margin-top: 24px;
        overflow: hidden;
      }
  
      .timio-progress-bar {
        height: 100%;
        background: #3b82f6;
        width: 0%;
        transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      }
  
      /* Updated status text styles */
      .timio-status-text {
        margin-top: 12px;
        color: #9ca3af;
        text-align: center;
        font-size: 14px;
        transition: opacity 0.3s ease;
        width: 80%;
      }
  
      /* Spinner fallback */
      .timio-spinner-fallback {
        width: 48px;
        height: 48px;
        border: 3px solid #3b82f6;
        border-radius: 50%;
        border-top-color: transparent;
        animation: spinner-rotate 1s linear infinite;
        margin: 0 auto;
      }
  
      @keyframes spinner-rotate {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
  
      @keyframes pulse {
        0% { opacity: 0.8; }
        50% { opacity: 1; }
        100% { opacity: 0.8; }
      }
  
      .timio-error-message {
        text-align: center;
        padding: 24px;
        color: #ef4444;
      }
  
      .timio-error-icon {
        width: 48px;
        height: 48px;
        stroke: currentColor;
        margin-bottom: 16px;
      }
  
      .timio-error-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 8px 0;
      }
  
      .timio-error-text {
        font-size: 14px;
        color: #9ca3af;
        margin: 0 0 20px 0;
      }
  
      .timio-refresh-button {
        background: #3b82f6;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
      }
  
      .timio-refresh-button:hover {
        background: #2563eb;
        transform: translateY(-1px);
      }
  
      .timio-refresh-button svg {
        width: 16px;
        height: 16px;
        stroke: currentColor;
      }
  
      /* Insights styles */
      .timio-insight-section {
        background: #2d2d2d;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        transition: transform 0.2s ease;
      }
  
      .timio-insight-section:hover {
        transform: translateY(-2px);
        border-color: rgba(59, 130, 246, 0.5);
      }
  
      .timio-insight-title {
        color: #3b82f6;
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 16px 0;
        letter-spacing: -0.01em;
      }
  
      .timio-insight-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
  
      .timio-insight-item {
        color: #e5e5e5;
        font-size: 14px;
        line-height: 1.6;
        padding-left: 20px;
        position: relative;
      }
  
      .timio-insight-item:before {
        content: "";
        position: absolute;
        left: 0;
        top: 8px;
        width: 6px;
        height: 6px;
        background: #3b82f6;
        border-radius: 50%;
      }
  
      /* Pivot styles */
      .timio-pivot-container {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
  
      .timio-pivot-article {
        background: #2d2d2d;
        border-radius: 12px;
        padding: 20px;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid rgba(255, 255, 255, 0.1);
        text-decoration: none;
        display: block;
      }
  
      .timio-pivot-article:hover {
        transform: translateX(4px);
        background: #363636;
        border-color: rgba(59, 130, 246, 0.5);
      }
  
      .timio-pivot-image {
        width: 100%;
        height: 200px;
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 16px;
        background: #1a1a1a;
        position: relative;
      }
  
      .timio-pivot-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s ease;
      }
  
      .timio-pivot-article:hover .timio-pivot-image img {
        transform: scale(1.05);
      }
  
      .timio-pivot-title {
        color: #3b82f6;
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 12px 0;
        line-height: 1.4;
        letter-spacing: -0.01em;
      }
  
      .timio-pivot-meta {
        display: flex;
        align-items: center;
        gap: 16px;
        color: #9ca3af;
        font-size: 13px;
      }
  
      .timio-pivot-source,
      .timio-pivot-date,
      .timio-pivot-author {
        display: flex;
        align-items: center;
        gap: 6px;
      }
  
      .timio-pivot-meta svg {
        width: 14px;
        height: 14px;
        stroke-width: 2;
      }
  
      .timio-image-placeholder {
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #2d2d2d 25%, #363636 50%, #2d2d2d 75%);
        background-size: 200% 200%;
        animation: shimmer 2s infinite;
        position: absolute;
        top: 0;
        left: 0;
      }
  
      @keyframes shimmer {
        0% {
          background-position: 200% 200%;
        }
        100% {
          background-position: -200% -200%;
        }
      }
  
      .timio-copy-button {
        background: #2d2d2d;
        color: #e5e5e5;
        border: 1px solid rgba(59, 130, 246, 0.5);
        border-radius: 8px;
        padding: 12px 24px;
        width: auto;
        max-width: 180px;
        margin: 24px auto 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
      }
  
      .timio-copy-button:hover {
        background: #363636;
        border-color: #3b82f6;
        transform: translateY(-1px);
      }
  
      .timio-copy-button.copied {
        background: #065f46;
        border-color: #059669;
        color: white;
      }
  
      .timio-copy-button svg {
        width: 16px;
        height: 16px;
        stroke-width: 2;
      }
  
      /* Scrollbar styles */
      .timio-modal-body::-webkit-scrollbar {
        width: 8px;
        background-color: #1a1a1a;
      }
  
      .timio-modal-body::-webkit-scrollbar-thumb {
        background-color: #4b5563;
        border-radius: 4px;
      }
  
      .timio-modal-body::-webkit-scrollbar-thumb:hover {
        background-color: #6b7280;
      }
  
      /* Mobile responsiveness */
      @media (max-width: 768px) {
        .timio-modal {
          width: 100%;
          max-width: 100%;
        }
  
        .timio-pivot-meta {
          flex-wrap: wrap;
        }
      }
       .timio-stuck-container {
      margin-top: 20px;
      text-align: center;
      width: 100%;
    }

    .timio-stuck-container p {
      color: #9ca3af;
      margin-bottom: 12px;
      font-size: 14px;
    }

    .timio-refresh-button {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
      transition: all 0.2s ease;
    }

    .timio-refresh-button:hover {
      background: #2563eb;
      transform: translateY(-1px);
    }

    .timio-troubleshooting-link {
      display: block;
      color: #3b82f6;
      font-size: 13px;
      text-decoration: underline;
      margin-top: 8px;
    }

    .timio-troubleshooting-link:hover {
      color: #2563eb;
    }

            .timio-modal-footer {
        padding: 16px 20px;
        background: #1a1a1a;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        text-align: center;
        position: sticky;
        bottom: 0;
      }

      .timio-support-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        color: #9ca3af;
        text-decoration: none;
        font-size: 14px;
        transition: color 0.2s ease;
      }

      .timio-support-link:hover {
        color: #3b82f6;
      }

      .timio-support-icon {
        width: 16px;
        height: 16px;
      }

      /* Add this to the existing @media query for mobile */
      @media (max-width: 768px) {
        .timio-modal-footer {
          padding: 12px 16px;
        }
        
        .timio-support-link {
          font-size: 13px;
        }
      }
    `;
    document.head.appendChild(style);
  
   // Insert the elements
  document.body.appendChild(menuContainer);
  document.body.appendChild(modal);
  document.head.appendChild(style);
  
  // Make the menu draggable
  makeDraggable(menuContainer);
  
  // Restore position from previous session
  restorePosition(menuContainer);
  
  // Create port
  port = createPort();
  
  // Setup event handlers
  const toggle = document.getElementById('timio-toggle');
  const menuItems = document.querySelector('.timio-menu-items');
  const insightsButton = document.getElementById('timio-insights');
  const pivotButton = document.getElementById('timio-pivot');
  let isOpen = false;
  
  document.addEventListener('click', (e) => {
    if (!menuContainer.contains(e.target) && isOpen) {
      isOpen = false;
      toggle.classList.remove('active');
      menuItems.classList.remove('active');
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
  
  const closeButton = modal.querySelector('.timio-modal-close');
  closeButton.addEventListener('click', () => {
    modal.classList.remove('active');
    if (window.cleanupAnimations) {
      window.cleanupAnimations();
    }
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
  
  // Setup message listener
  if (port) {
    port.onMessage.addListener((response) => {
      console.log('Received response:', response);
      if (!modal) return;
      
      const spinner = modal.querySelector('.timio-spinner');
      const content = modal.querySelector('.timio-insights-content');
      const pivotContent = modal.querySelector('.timio-pivot-content');
      
      // Use the cleanup function from lottie-manager.js
      if (window.cleanupAnimations) {
        window.cleanupAnimations();
      }
      
      spinner.style.display = 'none';
      
      // Handle response
      if (response.insights) {
        pivotContent.style.display = 'none';
        content.style.display = 'block';
        content.innerHTML = formatInsights(response.insights);
        setTimeout(() => {
          addCopyButtonListener();
        }, 100);
      } else if (response.articles) {
        // Use the articles array directly
        const articlesArray = response.articles;
        console.log('Extracted articles array:', articlesArray);
        content.style.display = 'none';
        pivotContent.style.display = 'block';
        if (!articlesArray || articlesArray.length === 0) {
          pivotContent.innerHTML = `
            <div class="timio-error-message">
              <svg class="timio-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              <p class="timio-error-title">No Results Found</p>
              <p class="timio-error-text">Unable to find related articles. Please try a different article.</p>
            </div>
          `;
        } else {
          pivotContent.innerHTML = formatPivotArticles(articlesArray);
        }
      } else if (response.error) {
        const errorContainer = 
          pivotContent.style.display === 'block' ? pivotContent : content;
        const otherContainer = 
          errorContainer === content ? pivotContent : content;
        
        otherContainer.style.display = 'none';
        errorContainer.style.display = 'block';
        errorContainer.innerHTML = `
          <div class="timio-error-message">
            <svg class="timio-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p class="timio-error-title">Error</p>
            <p class="timio-error-text">${response.error}</p>
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
    });
  }
  
  // Set up a visibility monitor to ensure the menu stays visible
  const visibilityObserver = new MutationObserver(() => {
    ensureMenuVisibility();
  });
  
  visibilityObserver.observe(document.body, {
    attributes: true, 
    subtree: true, 
    childList: true
  });
  
  console.log('Floating menu injection complete');
}

 // Modify the initialization logic to ensure early loading
let injectionAttempts = 0;
const maxAttempts = 5;

function tryInjectFloatingMenu() {
  if (document.body && !document.getElementById('timio-floating-menu')) {
    console.log(`Attempt ${injectionAttempts + 1} to inject floating menu`);
    injectFloatingMenu();
    return true;
  }
  return false;
}

function attemptInjection() {
  injectionAttempts++;
  
  // Check if we should inject TIMIO on this site
  if (!shouldInjectTIMIO()) {
    console.log('TIMIO will not be injected on this site');
    return;
  }
  
  if (tryInjectFloatingMenu()) {
    console.log('Menu injected successfully');
  } else if (injectionAttempts < maxAttempts) {
    // Try again with increasing delays
    console.log(`Menu injection attempt ${injectionAttempts} failed, trying again...`);
    setTimeout(attemptInjection, injectionAttempts * 300);
  } else {
    console.log('Maximum injection attempts reached');
  }
}

// Modify your existing initialization code
if (document.body) {
  if (shouldInjectTIMIO()) {
    attemptInjection();
  }
} else {
  // If body isn't available yet, use MutationObserver
  const bodyObserver = new MutationObserver(() => {
    if (document.body) {
      bodyObserver.disconnect();
      if (shouldInjectTIMIO()) {
        attemptInjection();
      }
    }
  });
  
  bodyObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  // Fallback in case MutationObserver doesn't trigger
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('timio-floating-menu') && shouldInjectTIMIO()) {
      attemptInjection();
    }
  });
}

// Final fallback
window.addEventListener('load', () => {
  if (!document.getElementById('timio-floating-menu') && shouldInjectTIMIO()) {
    attemptInjection();
  }
});

// Also add listeners for fullscreen changes to hide/show the menu appropriately
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);

function handleFullscreenChange() {
  const menu = document.getElementById('timio-floating-menu');
  const modal = document.getElementById('timio-modal');
  
  if (document.fullscreenElement || 
      document.webkitFullscreenElement || 
      document.mozFullScreenElement ||
      document.msFullscreenElement) {
    // Hide UI during fullscreen
    if (menu) menu.style.display = 'none';
    if (modal) modal.classList.remove('active');
  } else {
    // Show UI again after exiting fullscreen (but only if we should show on this site)
    if (shouldInjectTIMIO()) {
      if (menu) menu.style.display = 'block';
    }
  }
}

// Start injection process with MutationObserver
if (document.body) {
  attemptInjection();
} else {
  // If body isn't available yet, use MutationObserver
  const bodyObserver = new MutationObserver(() => {
    if (document.body) {
      bodyObserver.disconnect();
      attemptInjection();
    }
  });
  
  bodyObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  // Fallback in case MutationObserver doesn't trigger
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('timio-floating-menu')) {
      attemptInjection();
    }
  });
}

// Final fallback
window.addEventListener('load', () => {
  if (!document.getElementById('timio-floating-menu')) {
    attemptInjection();
  }
});

function extractArticleText() {
  try {
    // If Readability is available (should be if you include it in your content script)
    if (typeof Readability !== 'undefined') {
      const docClone = document.cloneNode(true);
      const reader = new Readability(docClone);
      const article = reader.parse();
      if (article && article.textContent && article.textContent.trim().length > 0) {
        console.log('[TIMIO] Readability extracted article:', article.title, article.textContent.slice(0, 200));
        return article.textContent;
      }
    }
  } catch (e) {
    console.warn('[TIMIO] Readability extraction failed:', e);
  }
  // Fallback: return all visible text
  return document.body.innerText || '';
}
})();
