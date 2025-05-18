import React, { useState, useEffect } from 'react';
import {
  MemoryRouter as Router,
  Route,
  Switch,
  Redirect,
} from 'react-router-dom';
import LandingPage from './LandingPage';
import Login from './login';
import Signup from './signup';
import Main from './Main';
import ProfilePage from './profilePage';
import './App.css';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for user authentication when component mounts
    const checkAuthState = async () => {
      console.log('Checking authentication state...');
      try {
        // First check Chrome storage
        if (chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['isLoggedIn', 'authToken'], function(result) {
            if (chrome.runtime.lastError) {
              console.log('Error accessing chrome storage:', chrome.runtime.lastError);
              checkLocalStorage();
              return;
            }
            
            console.log('Chrome storage auth check:', result);
            if (result.isLoggedIn === true && result.authToken) {
              console.log('User is authenticated via Chrome storage');
              setIsAuthenticated(true);
              setIsLoading(false);
            } else {
              // If not in Chrome storage, check localStorage
              checkLocalStorage();
            }
          });
        } else {
          // If Chrome storage is not available, check localStorage
          checkLocalStorage();
        }
      } catch (error) {
        console.error('Auth check error:', error);
        // Fallback to localStorage if Chrome APIs fail
        checkLocalStorage();
      }
    };

    const checkLocalStorage = () => {
      try {
        // Check localStorage as fallback
        const userData = localStorage.getItem('timioUser');
        console.log('LocalStorage check:', userData);
        
        if (userData) {
          console.log('User is authenticated via localStorage');
          setIsAuthenticated(true);
        } else {
          console.log('No authentication found');
          setIsAuthenticated(false);
        }
        setIsLoading(false);
      } catch (e) {
        console.error('localStorage error:', e);
        setIsAuthenticated(false);
        setIsLoading(false);
      }
    };

    checkAuthState();
  }, []);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Router initialEntries={['/', '/login', '/signup', '/Main', '/profilePage']}>
      <div className="app-container">
        <Switch>
          <Route path="/" exact>
            {isAuthenticated ? <Redirect to="/Main" /> : <LandingPage />}
          </Route>
          <Route path="/login">
            {isAuthenticated ? (
              <Redirect to="/Main" />
            ) : (
              <Login setIsAuthenticated={setIsAuthenticated} />
            )}
          </Route>
          <Route path="/signup">
            {isAuthenticated ? (
              <Redirect to="/Main" />
            ) : (
              <Signup setIsAuthenticated={setIsAuthenticated} />
            )}
          </Route>
          <Route path="/Main">
            {isAuthenticated ? (
              <Main setIsAuthenticated={setIsAuthenticated} />
            ) : (
              <Redirect to="/login" />
            )}
          </Route>
          <Route path="/profilePage">
            {isAuthenticated ? <ProfilePage /> : <Redirect to="/login" />}
          </Route>
          <Redirect to="/" />
        </Switch>
      </div>
    </Router>
  );
};

export default App;