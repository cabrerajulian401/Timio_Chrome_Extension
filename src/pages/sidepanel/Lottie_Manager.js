(function() {
    class LottieAnimationManager {
        constructor() {
            this.animations = new Map();
            this.lottieLoaded = false;
            this.initializationPromise = null;
        }

        async initialize() {
            if (this.lottieLoaded) return;
            
            // If initialization is already in progress, return the existing promise
            if (this.initializationPromise) {
                return this.initializationPromise;
            }

            this.initializationPromise = new Promise(async (resolve, reject) => {
                try {
                    // Load and inject Lottie library
                    const lottieUrl = chrome.runtime.getURL('lottie.min.js');
                    const response = await fetch(lottieUrl);
                    const lottieContent = await response.text();
                    
                    // Create a unique ID for the script
                    const scriptId = `lottie-script-${Date.now()}`;

                    // Remove any existing Lottie scripts
                    const existingScript = document.getElementById(scriptId);
                    if (existingScript) {
                        existingScript.remove();
                    }

                    // Create and inject the script
                    const script = document.createElement('script');
                    script.id = scriptId;
                    script.textContent = `
                        try {
                            var module = {};
                            ${lottieContent}
                            window.lottie = module.exports || module;
                            window.lottieInitialized = true;
                            document.dispatchEvent(new Event('lottieReady'));
                        } catch (error) {
                            console.error('Lottie initialization error:', error);
                        }
                    `;

                    // Add event listener for script load
                    const loadPromise = new Promise((resolveLoad) => {
                        document.addEventListener('lottieReady', resolveLoad, { once: true });
                    });

                    // Inject the script
                    document.head.appendChild(script);

                    // Wait for either the load event or timeout
                    await Promise.race([
                        loadPromise,
                        new Promise((_, rejectTimeout) => 
                            setTimeout(() => rejectTimeout(new Error('Script load timeout')), 3000)
                        )
                    ]);

                    // Double check that Lottie is actually available
                    if (!window.lottie) {
                        throw new Error('Lottie object not found after initialization');
                    }

                    this.lottieLoaded = true;
                    resolve();
                } catch (error) {
                    console.error('Failed to initialize Lottie:', error);
                    this.lottieLoaded = false;
                    this.initializationPromise = null;
                    reject(error);
                }
            });

            return this.initializationPromise;
        }

        async loadAnimationData(type) {
            try {
                const response = await fetch(chrome.runtime.getURL(`${type}.json`));
                if (!response.ok) {
                    throw new Error(`Failed to load ${type} animation data`);
                }
                return await response.json();
            } catch (error) {
                console.error(`Failed to load ${type} animation:`, error);
                throw error;
            }
        }

        async createAnimation(containerId, type) {
            let container = null;
            let retries = 3;
            
            while (retries > 0) {
                try {
                    await this.initialize();
                    
                    container = document.getElementById(containerId);
                    if (!container) {
                        throw new Error(`Container ${containerId} not found`);
                    }

                    // Set container styles
                    Object.assign(container.style, {
                        width: '100px',
                        height: '100px',
                        margin: '0 auto'
                    });

                    // Load animation data
                    const animationData = await this.loadAnimationData(type);

                    // Create animation instance
                    const animation = window.lottie.loadAnimation({
                        container,
                        renderer: 'svg',
                        loop: true,
                        autoplay: true,
                        animationData
                    });

                    // Store animation instance
                    this.animations.set(containerId, animation);

                    animation.addEventListener('DOMLoaded', () => {
                        console.log(`Animation ${type} DOM loaded`);
                    });

                    animation.addEventListener('data_ready', () => {
                        console.log(`Animation ${type} data ready`);
                    });

                    animation.addEventListener('error', (error) => {
                        console.error(`Animation ${type} error:`, error);
                        this.showFallbackSpinner(container);
                    });

                    return animation;

                } catch (error) {
                    console.error(`Animation creation attempt ${4 - retries} failed:`, error);
                    retries--;
                    
                    if (retries === 0) {
                        console.error('Failed to create animation after all retries');
                        if (container) {
                            this.showFallbackSpinner(container);
                        }
                        throw error;
                    }
                    
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    // Reset lottieLoaded flag to force reinitialization
                    this.lottieLoaded = false;
                    this.initializationPromise = null;
                }
            }
        }

        showFallbackSpinner(container) {
            if (!container) return;
            
            container.innerHTML = `
                <div class="timio-spinner-fallback"></div>
            `;
        }

        destroyAnimation(containerId) {
            const animation = this.animations.get(containerId);
            if (animation) {
                animation.destroy();
                this.animations.delete(containerId);
            }
        }

        destroyAllAnimations() {
            this.animations.forEach(animation => animation.destroy());
            this.animations.clear();
        }
    }

    // Create singleton instance
    const animationManager = new LottieAnimationManager();

    // Make functions available globally
    window.setupAnimation = async function(containerId, animationType) {
        console.log(`Setting up ${animationType} animation in ${containerId}`);
        
        try {
            const animation = await animationManager.createAnimation(containerId, animationType);
            return animation;
        } catch (error) {
            console.error('Animation setup failed:', error);
            // The fallback spinner will be shown by the animation manager
            throw error;
        }
    };

    window.cleanupAnimations = function() {
        animationManager.destroyAllAnimations();
    };
})();