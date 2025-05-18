import React, { useState, useEffect } from 'react';
import { app } from './firebase.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
} from 'firebase/auth/web-extension';
import { Link, useHistory } from 'react-router-dom';
import './auth.css';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const history = useHistory();

  // useEffect(() => {
  //   const unsubscribe = onAuthStateChanged((user) => {
  //     if (user) {
  //       history.push('/Main');
  //     }
  //   });

  //   return () => unsubscribe();
  // }, [history]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      setLoading(false);
      return;
    }

    try {
      var createUserResponse = await createUserWithEmailAndPassword(
        getAuth(),
        email,
        password
      );

      console.log(
        'createUserResponse %%% :',
        createUserResponse,
        createUserResponse.user,
        createUserResponse.user.accessToken
      );
      localStorage.setItem(
        'timioUser',
        JSON.stringify({
          email: createUserResponse.user.email,
          uid: createUserResponse.user.uid,
        })
      );
      chrome.storage.local.set({
        authToken: createUserResponse.user.accessToken,
        isLoggedIn: true,
        userId: createUserResponse.user.uid,
      });
      history.push('/Main');
    } catch (error) {
      setError('Failed to create account. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Welcome to TIMIO</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSignup} className="auth-form">
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
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm Password"
            required
            className="auth-input"
          />
          <button type="submit" disabled={loading} className="auth-button">
            Create Account
          </button>
        </form>
        <div className="auth-links">
          <p>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
