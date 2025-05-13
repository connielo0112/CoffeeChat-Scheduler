import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Cookies from 'js-cookie';

function GoogleCallback({ setUser }) {
  const [message, setMessage] = useState('Processing Google login...');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Get authorization code from URL parameters
    const urlParams = new URLSearchParams(location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (error) {
      console.error('Google OAuth error:', error);
      setMessage('Google login failed: ' + error);
      setTimeout(() => navigate('/login'), 2000);
      return;
    }
    
    if (!code) {
      setMessage('No Google authorization code received');
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    // Send authorization code to backend
    const handleAuthCode = async () => {
      try {
        const csrftoken = Cookies.get('csrftoken');
        
        const response = await fetch('/api/users/google-auth-callback/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
          },
          credentials: 'include',
          body: JSON.stringify({ code })
        });
        
        const contentType = response.headers.get("content-type");

        let data;
            if (contentType && contentType.includes("application/json")) {
              data = await response.json();
            } else {
              const text = await response.text();
              console.error("Non-JSON response:", text);
              throw new Error("Unexpected non-JSON response");
            }

            if (response.ok && data.user) {
              setUser(data.user);
              setMessage('Google login successful! Redirecting...');
              setTimeout(() => navigate('/profile', { state: { autoEdit: true } }), 1000);
            } else {
              setMessage('Google login failed: ' + (data.error || 'Unknown error'));
              setTimeout(() => navigate('/login'), 2000);
            }
          } catch (err) {
            console.error('Google login processing error:', err);
            setMessage('Error processing Google login');
            setTimeout(() => navigate('/login'), 2000);
          }
        };

    handleAuthCode();
  }, [location, navigate, setUser]);

  return (
    <div className="callback-container">
      <h2>Google Login</h2>
      <div className="loading-spinner"></div>
      <p>{message}</p>
    </div>
  );
}

export default GoogleCallback;