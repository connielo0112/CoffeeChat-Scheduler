import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../App.css';
import Cookies from 'js-cookie';

const RegisterForm = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [timezone, setTimezone] = useState('');
  const [message, setMessage] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/csrf/', { credentials: 'include' });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const csrftoken = Cookies.get('csrftoken');

      const response = await axios.post(
        '/api/users/register/',
        {
          first_name: firstName,
          last_name: lastName,
          email,
          password,
          timezone,
        },
        {
          withCredentials: true,
          headers: {
            'X-CSRFToken': csrftoken,
          }
        }
      );

      if (response.status === 201 || response.status === 200) {
        setMessage('Registered successfully! Redirecting...');
        setTimeout(() => {
          navigate('/login');
        }, 1000);
      }
    } catch (error) {
      console.error('Registration failed:', error);
      setMessage((error.response?.data?.error || 'Registration failed.'));
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mt-16 bg-white rounded-xl shadow-md px-6 py-10">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Register</h2>
      <p className="text-sm text-gray-500 mb-6">Let’s get you all set up so you can access your personal account.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4">
          <div className="w-1/2">
            <label className="block text-sm font-medium text-gray-700">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="w-1/2">
            <label className="block text-sm font-medium text-gray-700">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
  
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
  
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
  
        <div>
          <label className="block text-sm font-medium text-gray-700">Time Zone</label>
          <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="America/Los_Angeles">(GMT-8:00) Los Angeles (PST)</option>
            <option value="America/Denver">(GMT-7:00) Denver (MST)</option>
            <option value="America/Chicago">(GMT-6:00) Chicago (CST)</option>
            <option value="America/New_York">(GMT-5:00) New York, Toronto (EST)</option>
            <option value="UTC">(GMT+0:00) UTC</option>
            <option value="Europe/London">(GMT+0:00) London (GMT)</option>
            <option value="Europe/Paris">(GMT+1:00) Paris, Berlin, Madrid (CET)</option>
            <option value="Asia/Bangkok">(GMT+7:00) Bangkok, Ho Chi Minh City (ICT)</option>
            <option value="Asia/Taipei">(GMT+8:00) Taipei, Beijing, Singapore, Hong Kong (CST)</option>
            <option value="Asia/Tokyo">(GMT+9:00) Tokyo, Seoul (JST)</option>
            <option value="Australia/Sydney">(GMT+10:00) Sydney (AEST)</option>
          </select>
        </div>

        <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 rounded-md font-medium hover:bg-indigo-700 transition"
        >
          Register
        </button>
      </form>
      {message && <p className="mt-4 text-sm text-center text-red-500">{message}</p>}
    </div>
  );
}

export default RegisterForm;
