import React, { useState, useEffect } from 'react';
import { app } from './firebase.js';
import { getAuth, updatePassword, signOut } from 'firebase/auth/web-extension';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useHistory } from 'react-router-dom';
import './profilePage.css';

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const history = useHistory();
  const auth = getAuth();
  const db = getFirestore(app);

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      try {
        // Get user from local storage
        const userData = JSON.parse(localStorage.getItem('timioUser'));
        
        console.log("ProfilePage - User data from localStorage:", userData); // Debug log
        
        if (userData && userData.uid) {
          setUser(userData);
          
          // Get additional user data from Firestore
          const userDocRef = doc(db, "users", userData.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userDocData = userDoc.data();
            setDisplayName(userDocData.displayName || '');
            setBio(userDocData.bio || '');
          } else {
            console.log("User document not found in Firestore");
            // Still keep the user logged in with basic info
          }
        } else {
          console.error("No valid user found in localStorage");
          // Don't immediately redirect - set an error state instead
          setError("Session expired. Please log in again.");
          // Add a delayed redirect
          setTimeout(() => {
            history.push('/login');
          }, 2000);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        setError("Failed to load profile data: " + error.message);
      }
      setLoading(false);
    };
  
    fetchUserData();
  }, [history, db])

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      // Update user profile in Firestore
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
          displayName,
          bio,
          updatedAt: new Date()
        });
        
        setSuccessMessage("Profile updated successfully!");
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      setError("Failed to update profile. Please try again.");
    }
    
    setLoading(false);
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      setLoading(false);
      return;
    }

    try {
      // Update password
      const currentUser = auth.currentUser;
      if (currentUser) {
        await updatePassword(currentUser, newPassword);
        setSuccessMessage("Password updated successfully!");
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      console.error("Error updating password:", error);
      setError("Failed to update password. You may need to re-authenticate.");
    }
    
    setLoading(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('timioUser');
      chrome.storage.local.remove(['authToken', 'isLoggedIn', 'userId']);
      history.push('/login');
    } catch (error) {
      console.error("Error signing out:", error);
      setError("Failed to log out. Please try again.");
    }
  };

  if (loading && !user) {
    return (
      <div className="extension-container">
        <div className="extension-header">
          <h1 className="logo">TIMIO</h1>
          <div className="header-buttons">
            <button className="logout-button" onClick={() => history.push('/Main')}>
              Back
            </button>
          </div>
        </div>
        <div className="extension-main">
          <div className="welcome-message">
            <div className="profile-loading">
              <div className="loading-icon"></div>
              <h2>Loading profile...</h2>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="extension-container">
      <div className="extension-header">
        <h1 className="logo">TIMIO</h1>
        <div className="header-buttons">
          <button className="logout-button" onClick={() => history.push('/Main')}>
            Back
          </button>
        </div>
      </div>
      
      <div className="extension-main">
        {error && (
          <div className="quote-container profile-alert error">
            <p>{error}</p>
          </div>
        )}
        
        {successMessage && (
          <div className="quote-container profile-alert success">
            <p>{successMessage}</p>
          </div>
        )}
        
        <div className="welcome-message">
          <h2>{displayName || 'My Profile'}</h2>
          <p>{user?.email}</p>
        </div>
        
        <div className="instruction-box">
          <div className="instruction-header">
            <h3 className="get-started-header">Profile Details</h3>
            {!isEditing && (
              <button 
                className="profile-button"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </button>
            )}
          </div>
          
          {!isEditing ? (
            <div className="animation-showcase">
              <div className="animation-item profile-item">
                <span className="tool-name">Display Name</span>
                <p className="tool-description field-value">{displayName || 'Not set'}</p>
              </div>
              
              <div className="animation-item profile-item">
                <span className="tool-name">Bio</span>
                <div className="bio-display">
                  <p className="tool-description field-value">{bio || 'No bio information added yet.'}</p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUpdateProfile} className="profile-form">
              <div className="animation-showcase">
                <div className="animation-item profile-item">
                  <span className="tool-name">Display Name</span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Display Name"
                    className="auth-input"
                  />
                </div>
                
                <div className="animation-item profile-item">
                  <span className="tool-name">Bio</span>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Bio"
                    rows="3"
                    className="bio-textarea"
                  />
                </div>
                
                <div className="button-group">
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="profile-button profile-save-button"
                  >
                    Save
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsEditing(false)}
                    className="profile-button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
        
        <div className="instruction-box">
          <div className="instruction-header">
            <h3 className="get-started-header">Update Password</h3>
          </div>
          
          <form onSubmit={handleUpdatePassword} className="profile-form password-form">
            <div className="animation-showcase">
              <div className="animation-item profile-item">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password"
                  className="auth-input"
                />
                
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm New Password"
                  className="auth-input"
                />
              </div>
              
              <div className="button-group">
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="profile-button profile-save-button"
                >
                  Update Password
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      
      <div className="extension-footer">
        <div className="footer-nav">
          <button onClick={handleLogout}>Log Out</button>
          <span className="nav-separator">|</span>
          <button onClick={() => history.push('/Main')}>Dashboard</button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;