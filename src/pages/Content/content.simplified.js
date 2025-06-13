import Readability from './Readability.js';

(() => {
    // Check if the menu already exists to avoid injecting it multiple times
    if (document.getElementById('summarizer-menu-container')) {
        return;
    }

    const container = document.createElement('div');
    container.id = 'summarizer-menu-container';

    // --- Create the HTML for the menu ---
    container.innerHTML = `
        <div class="summarizer-menu-items" id="summarizer-menu-items">
            <button class="summarizer-menu-button" id="pivot-btn" title="Find Opposing Viewpoints">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m5 12 7-7 7 7"/><path d="M12 2v20"/></svg>
            </button>
            <button class="summarizer-menu-button" id="insights-btn" title="Get Deeper Insights">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/><path d="M18 9h2a2 2 0 0 1 2 2v9l-4-4h-2a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/></svg>
            </button>
            <button class="summarizer-menu-button" id="summarize-btn" title="Get Quick Summary">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M12 4v2"/><path d="M12 20v-2"/><path d="m19.071 4.929-.828.828"/><path d="m5.757 19.071-.828.828"/><path d="M4 12H2"/><path d="M22 12h-2"/><path d="m18.243 19.071.828.828"/><path d="m4.929 4.929.828.828"/></svg>
            </button>
        </div>

        <button class="summarizer-menu-button" id="summarizer-toggle-btn" title="Open Analyzer Menu">
            <img src="${chrome.runtime.getURL('summarize-icon.png')}" alt="Menu"/>
        </button>
    `;

    // --- Add the CSS for the new menu ---
    const style = document.createElement('style');
    style.textContent = `
        #summarizer-menu-container {
            position: fixed;
            bottom: 25px;
            right: 25px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .summarizer-menu-button {
            width: 50px; height: 50px; border-radius: 50%; background-color: #007bff;
            border: none; box-shadow: 0 4px 8px rgba(0,0,0,0.2); cursor: pointer;
            display: flex; justify-content: center; align-items: center; transition: all 0.2s ease-in-out;
            color: white;
        }
        .summarizer-menu-button:hover { transform: scale(1.1); }
        .summarizer-menu-button img { width: 28px; height: 28px; }

        .summarizer-menu-items {
            display: flex; flex-direction: column; gap: 15px; margin-bottom: 15px;
            align-items: center;
            /* Hidden by default */
            visibility: hidden; opacity: 0; transform: translateY(10px);
            transition: all 0.2s ease-in-out;
        }
        .summarizer-menu-items.visible {
            visibility: visible; opacity: 1; transform: translateY(0);
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(container);

    // --- Add Event Listeners ---
    const toggleBtn = document.getElementById('summarizer-toggle-btn');
    const menuItems = document.getElementById('summarizer-menu-items');
    const summarizeBtn = document.getElementById('summarize-btn');
    const insightsBtn = document.getElementById('insights-btn');
    const pivotBtn = document.getElementById('pivot-btn');

    // Toggle the menu's visibility
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menuItems.classList.toggle('visible');
    });

    // A helper function to handle button clicks
    const handleActionClick = (action, title) => {
        menuItems.classList.remove('visible'); // Hide menu after click
        let articleContent = '';

        // We now ALWAYS extract the article text for ANY action,
        // because our new fast pivot endpoint needs it for analysis.
        try {
            // We clone the document to avoid altering the original page
            const documentClone = document.cloneNode(true);
            const reader = new Readability(documentClone);
            const article = reader.parse();
            // Use the readable content if available, otherwise fall back to the whole body's text
            articleContent = article ? article.textContent : document.body.innerText;
        } catch (e) {
            console.error("Readability failed:", e);
            articleContent = document.body.innerText; // Fallback
        }

        // Send the message to the background script.
        chrome.runtime.sendMessage({ action, content: articleContent, title });
    };

    summarizeBtn.addEventListener('click', () => handleActionClick("getSummary", "Article Summary"));
    insightsBtn.addEventListener('click', () => handleActionClick("getInsights", "Deeper Insights"));
    pivotBtn.addEventListener('click', () => handleActionClick("getOpposingViews", "Opposing Viewpoints"));

    // Hide menu if user clicks anywhere else on the page
    document.addEventListener('click', () => {
        if (menuItems.classList.contains('visible')) {
            menuItems.classList.remove('visible');
        }
    });
})();
