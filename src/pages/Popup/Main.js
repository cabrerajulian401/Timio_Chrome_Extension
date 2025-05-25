import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { app } from './firebase.js';
// import { getAuth, signOut } from 'firebase/auth/web-extension'; // Removed for no-auth version
import Lottie from 'react-lottie';
import torchAnimationData from '../../assets/animations/torch.json';
import pivotAnimationData from '../../assets/animations/pivot.json';
import './main.css';

const Main = ({ setIsAuthenticated }) => {
  const [email, setEmail] = useState('user@example.com'); // Default email for no-auth
  const [showToolTip, setShowToolTip] = useState(false);
  const [isMounted, setIsMounted] = useState(true);
  const history = useHistory();
  // const auth = getAuth(); // Removed for no-auth version

  // Use refs to safely reference animations
  const torchAnimationRef = useRef(null);
  const pivotAnimationRef = useRef(null);

  // Lottie animation options
  const torchOptions = {
    loop: true,
    autoplay: true,
    animationData: torchAnimationData,
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid slice'
    }
  };

  const pivotOptions = {
    loop: true,
    autoplay: true,
    animationData: pivotAnimationData,
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid slice'
    }
  };

  useEffect(() => {
    // Set mounted flag to true
    setIsMounted(true);
    
    // Show tooltip on first visit
    try {
      const hasSeenTooltip = localStorage.getItem('hasSeenTooltip');
      if (!hasSeenTooltip && isMounted) {
        setShowToolTip(true);
        localStorage.setItem('hasSeenTooltip', 'true');
      }
    } catch (error) {
      console.log('Error with tooltip:', error);
    }

    // Cleanup function
    return () => {
      setIsMounted(false);
    };
  }, []);

  // Logout function removed - no authentication needed


  return (
    <div className="extension-container">
      {/* Header */}
      <header className="extension-header">
        <h1 className="logo">TIMIO</h1>
        <div className="header-buttons">
          {/* Logout button removed - no authentication */}
        </div>
      </header>

      {/* Main Content */}
      <main className="extension-main">
        {/* Welcome Message */}
        <div className="welcome-message">
          <h2>Welcome to TIMIO</h2>
          <p>Your intelligent news analysis companion that helps you uncover media bias and discover diverse perspectives.</p>
        </div>

        {/* Quote Container */}
        <div className="quote-container">
          <p>"In the era of information overload, true insight comes from seeing multiple perspectives."</p>
          <div className="quote-author">TIMIO Team</div>
          <a href="https://timio.news/support" className="support-link" target="_blank" rel="noopener noreferrer">Need help? Click here for support.</a>
        </div>

        {/* Get Started Section with + Icon */}
        <div className="instruction-box">
          <div className="instruction-header">
            <h3 className="get-started-header">Get Started</h3>
            <div className="step-indicator">Step 1</div>
          </div>
          <p className="instruction-text">
            While reading any news article, click the
          </p>

          <div className="plus-sign-container">
            <svg
              className="plus-sign"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </div>

          <p className="instruction-text">
            button at the bottom right corner to access TIMIO's powerful analysis tools
          </p>
          <p className="instruction-text" style={{ marginTop: '12px', fontStyle: 'italic', color: '#9ca3af' }}>
            Pro tip: The + button is draggable, so you can position it anywhere on your screen for easier access!
          </p>

          {showToolTip && (
            <div className="instruction-tooltip">
              <span>
                👋 First time? Try clicking the + icon on any news website to start analyzing with TIMIO's tools!
              </span>
              
              <button
                className="tooltip-close"
                onClick={() => setShowToolTip(false)}
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Individual Tool Showcase */}
        <div className="tools-showcase">
          <h3 className="tools-title">Our Analysis Tools</h3>
          
          <div className="animation-showcase">
            {/* Torch Tool with Animation */}
            <div className="animation-item torch">
              {isMounted && (
                <Lottie 
                options={{
                  ...torchOptions,
                  rendererSettings: {
                    preserveAspectRatio: 'xMidYMid meet' // Change to 'meet' instead of 'slice'
                  }
                }}
                height={120} // Try a larger height
                width={100}  // Keep width proportional
                isClickToPauseDisabled={true} // Prevent accidental pausing
                isStopped={false}
                isPaused={false}
                ref={torchAnimationRef}
              />
              )}
              <span className="tool-name">Torch</span>
              <p className="tool-description">
                Shine a light on media bias and credibility issues in any news article
              </p>
              
              <div className="tool-details">
                <div className="tool-detail-item">
                  <svg className="detail-icon" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                  <span className="detail-text">Detect political bias and slant</span>
                </div>
                <div className="tool-detail-item">
                  <svg className="detail-icon" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                  <span className="detail-text">Identify emotional language and framing</span>
                </div>
                <div className="tool-detail-item">
                  <svg className="detail-icon" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                  <span className="detail-text">Evaluate source credibility and track record</span>
                </div>
              </div>
            </div>
            
            {/* Pivot Tool with Animation */}
            <div className="animation-item pivot">
              {isMounted && (
                <Lottie 
                  options={pivotOptions} 
                  height={80} 
                  width={80} 
                  isStopped={false}
                  isPaused={false}
                  ref={pivotAnimationRef}
                />
              )}
              <span className="tool-name">Pivot</span>
              <p className="tool-description">
                Discover alternative perspectives and broaden your understanding
              </p>
              
              <div className="tool-details">
                <div className="tool-detail-item">
                  <svg className="detail-icon" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                  <span className="detail-text">Find articles with different viewpoints</span>
                </div>
                <div className="tool-detail-item">
                  <svg className="detail-icon" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                  <span className="detail-text">Compare coverage across media outlets</span>
                </div>
                <div className="tool-detail-item">
                  <svg className="detail-icon" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                  <span className="detail-text">Explore the full context of any story</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <footer className="extension-footer">
          <nav className="footer-nav">
          </nav>
        </footer>
      </main>
    </div>
  );
};

export default Main;