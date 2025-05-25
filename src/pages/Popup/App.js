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
import './App.css';

const App = () => {
  // Always authenticated - no sign in required
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Router initialEntries={['/Main']}>
      <div className="app-container">
        <Switch>
          <Route path="/" exact>
            <Redirect to="/Main" />
          </Route>
          <Route path="/Main">
            <Main setIsAuthenticated={setIsAuthenticated} />
          </Route>
          <Redirect to="/Main" />
        </Switch>
      </div>
    </Router>
  );
};

export default App;