import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { Link } from 'react-router-dom';

export default function LoginForm({ setUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/csrf/', { credentials: 'include' });
  }, []);

  const handleLogin = async () => {
    try {
      const csrftoken = Cookies.get('csrftoken');

      const response = await fetch('/api/users/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setMessage((data.error || 'Login failed.'));
        return;
      }
      
      const data = await response.json();
      setUser(data.user);
      setMessage('Login successful! Redirecting...');
      setTimeout(() => navigate('/profile'), 1000);
    } catch (error) {
      console.error('Login error:', error);
      setMessage('Login failed due to network error.');
    }
  };

  // Redirect to Google authorization page
  const redirectToGoogleAuth = () => {
    // Build OAuth 2.0 URL
    const clientId = '941228745801-sb4lc1vbhuu0juuvvfd870k7a5r6jklk.apps.googleusercontent.com';
    const redirectUri = encodeURIComponent(`${window.location.origin}/google-callback`);
    const scope = encodeURIComponent('email profile');
    const responseType = 'code';
    const accessType = 'offline';
    const prompt = 'consent';
    
    // Create complete authorization URL
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=${responseType}&access_type=${accessType}&prompt=${prompt}`;
    
    // Redirect to Google authorization page
    window.location.href = authUrl;
  };

  return (
    <div className="w-full max-w-md mx-auto mt-20 bg-white rounded-xl shadow-md px-6 py-10">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Log In</h2>
      <p className="text-sm text-gray-500 mb-6">Log in to get access to coffee chats.</p>
  
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
  
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
  
        <button
          onClick={handleLogin}
          className="w-full bg-indigo-600 text-white py-2 rounded-md font-medium hover:bg-indigo-700 transition"
        >
          Log In
        </button>
  
        <p className="text-sm text-gray-500 text-center">
          Don’t have an account?{' '}
          <Link to="/register" className="text-indigo-600 hover:underline">Register</Link>
        </p>
  
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-gray-500">or log in with</span>
          </div>
        </div>
  
        <div className="flex justify-center gap-4">
          <button onClick={redirectToGoogleAuth} className="border px-4 py-2 rounded-md text-sm">
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="h-5 w-5 inline-block mr-2" />
            Google
          </button>
        </div>
      </div>
  
      {message && <p className="mt-4 text-sm text-center text-red-500">{message}</p>}
    </div>
  );
}  
