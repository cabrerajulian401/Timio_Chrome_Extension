import React, { useState, useEffect } from 'react';
import { app } from './firebase.js';

import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  getAuth,
} from 'firebase/auth/web-extension';

import { Link, useHistory } from 'react-router-dom';
import './auth.css';

const Login = ({ setIsAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const history = useHistory();

  // Check if user is already logged in
  useEffect(() => {
    const checkExistingAuth = async () => {
      try {
        // Check chrome storage first
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['isLoggedIn', 'authToken'], (result) => {
            if (chrome.runtime.lastError) {
              console.log('Chrome storage access error:', chrome.runtime.lastError);
              checkLocalStorage();
              return;
            }
            
            if (result.isLoggedIn && result.authToken) {
              console.log('Auth found in chrome storage');
              setIsAuthenticated(true);
              history.push('/Main');
            } else {
              checkLocalStorage();
            }
          });
        } else {
          checkLocalStorage();
        }
      } catch (error) {
        console.error('Auth check error:', error);
        checkLocalStorage();
      }
    };

    const checkLocalStorage = () => {
      try {
        const userData = localStorage.getItem('timioUser');
        if (userData) {
          console.log('Auth found in localStorage');
          setIsAuthenticated(true);
          history.push('/Main');
        }
      } catch (e) {
        console.error('localStorage check error:', e);
      }
    };

    checkExistingAuth();
  }, [history, setIsAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        getAuth(),
        email,
        password
      );
      const user = userCredential.user;

      const token = await user.getIdToken();
      
      // Save to chrome storage if available
      try {
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({
            authToken: token,
            isLoggedIn: true,
            userId: user.uid,
          }, () => {
            if (chrome.runtime.lastError) {
              console.log('Error saving to Chrome storage:', chrome.runtime.lastError);
            } else {
              console.log('Auth data saved to Chrome storage');
              
              // Let the background script know about the auth state change
              try {
                chrome.runtime.sendMessage({
                  type: 'AUTH_STATE_CHANGED',
                  isLoggedIn: true,
                });
              } catch (err) {
                console.log('Error sending message to background:', err);
              }
            }
          });
        }
      } catch (chromeError) {
        console.error('Chrome storage error:', chromeError);
      }

      // ALWAYS save to localStorage as backup
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || ''
      };
      localStorage.setItem('timioUser', JSON.stringify(userData));
      console.log("User data saved to localStorage:", userData);

      // Update authentication state in parent component
      setIsAuthenticated(true);
      
      // Navigate to main page
      history.push('/Main');
    } catch (error) {
      let errorMessage = '';
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Invalid password';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        default:
          errorMessage = 'Failed to login. Please try again.';
      }
      setError(errorMessage);
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    try {
      await sendPasswordResetEmail(getAuth(), email);
      setResetSent(true);
      setError('');
    } catch (error) {
      setError('Failed to send reset email. Please try again.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Welcome to TIMIO</h2>
        {error && <div className="error-message">{error}</div>}
        {resetSent && (
          <div className="success-message">
            Password reset link sent! Please check your email.
          </div>
        )}
        <form onSubmit={handleLogin} className="auth-form">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="auth-input"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="auth-input"
          />
          <button type="submit" disabled={loading} className="auth-button">
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={() => history.push('/signup')}
            className="auth-button auth-button-secondary"
          >
            Create Account
          </button>
        </form>
        <div className="auth-links">
          <button onClick={handleForgotPassword} className="forgot-password">
            Forgot password?
          </button>
          <p className="signup-text">
            New user?{' '}
            <Link to="/signup" className="signup-link">
              Sign up at timio.news
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;