import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';

import LoginForm from './components/LoginForm.jsx';
import RegisterForm from './components/RegisterForm.jsx';
import UserProfile from './components/UserProfile.jsx';
import GoogleCallback from './components/GoogleCallback.jsx';
import UserDirectory from './components/UserDirectory.jsx';
import UserTimeslotPage from './pages/UserTimeslotPage.jsx';
import MeetingScheduler from './components/MeetingScheduler.jsx';
import AvailableSlots from './components/AvailableSlots';
import MyBookings from './components/MyBookings.jsx';
import ChatNotifications from './components/ChatNotifications.jsx';

import Cookies from 'js-cookie';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/users/profile/', {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setUser({
            id: data.user_id,
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email
          });
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
  
    // Create WebSocket connection for real-time notifications
    const wsUrl = `ws://localhost:8000/ws/chat/global/`;
    const ws = new WebSocket(wsUrl);
  
    ws.onmessage = (event) => {

      try {
        const data = JSON.parse(event.data);

        if (
          data.type === 'new_message_notification' &&
          parseInt(data.receiver_id) === parseInt(user.id)
        ) {

          // If chatbox is already open for this sender, skip notification
          if (
            window.chatboxIsOpen &&
            parseInt(window.chatTargetId) === parseInt(data.sender_id)
          ) {
            return;
          }
          
          const newNotification = {
            id: Date.now(),
            senderId: data.sender_id,
            senderName: data.sender_name,
            message: data.message_preview || data.message,
            timestamp: new Date().toISOString(),
            roomName: data.room_name
          };

          setUnreadCount((prev) => prev + 1);
          setNotifications(prev => [newNotification, ...prev.slice(0, 9)]);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
    
    return () => ws.close();
  }, [user]);
  
  const clearNotifications = () => {
    setUnreadCount(0);
    setNotifications([]);
  };

  const handleLogout = async () => {
    try {
      const csrftoken = Cookies.get('csrftoken');
      await fetch('/api/users/logout/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': csrftoken,
          'Content-Type': 'application/json',
        },
      });
      Cookies.remove('sessionid');
      Cookies.remove('csrftoken');
      setUser(null);
      setUnreadCount(0);
      setNotifications([]);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <Router>
      <div className="bg-gray-100 min-h-screen">
        <nav className="bg-gray-200 shadow-md sticky top-0 z-50">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Link to="/" className="flex items-center">
                  <span className="text-xl font-bold text-gray-800">☕ Smart Coffee Chat</span>
                </Link>
              </div>
              <div className="flex items-center space-x-8">
                <Link to="/" className="nav-link font-medium text-gray-800 hover:text-blue-600 px-4 py-2 text-base">
                  Home
                </Link>
                {!user ? (
                  <>
                    <Link to="/login" className="nav-link font-medium text-gray-800 hover:text-blue-600 px-4 py-2 text-base">
                      Login
                    </Link>
                    <Link to="/register" className="nav-link font-medium text-gray-800 hover:text-blue-600 px-4 py-2 text-base">
                      Register
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/profile" className="nav-link font-medium text-gray-800 hover:text-blue-600 px-4 py-2 text-base">
                      Profile
                    </Link>
                    <Link to="/bookings" className="nav-link font-medium text-gray-800 hover:text-blue-600 px-4 py-2 text-base">
                      My Bookings
                    </Link>
                    <Link to="/available-slots" className="nav-link font-medium text-gray-800 hover:text-blue-600 px-4 py-2 text-base">
                      My Available Slots
                    </Link>
                    <div className="flex items-center ml-6 space-x-4">
                      {/* Notification Icon Component */}
                      <ChatNotifications 
                        unreadCount={unreadCount} 
                        notifications={notifications}
                        clearNotifications={clearNotifications}
                      />
                      
                      <span className="text-gray-800 px-4 font-medium text-base">{user.first_name} {user.last_name}</span>
                      <button
                        onClick={handleLogout}
                        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-sm font-medium text-white transition-colors duration-200"
                      >
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-6 py-4">
          {loading ? (
            <div className="loading-spinner">Loading...</div>
          ) : (
            <Routes>
              <Route path="/" element={<UserDirectory user={user} />} />
              <Route path="/login" element={!user ? <LoginForm setUser={setUser} /> : <Navigate to="/profile" />} />
              <Route path="/register" element={!user ? <RegisterForm setUser={setUser} /> : <Navigate to="/profile" />} />
              <Route path="/profile" element={user ? <UserProfile user={user} setUser={setUser} /> : <Navigate to="/login" />} />
              <Route path="/bookings" element={user ? <MyBookings /> : <Navigate to="/login" />} />
              <Route path="/google-callback" element={<GoogleCallback setUser={setUser} />} />
              <Route path="/availability/user/:user_id" element={<UserTimeslotPage />} />
              <Route path="/test/scheduler/user/:user_id" element={<MeetingScheduler />} />
              <Route path="/available-slots" element={user ? <AvailableSlots /> : <Navigate to="/login" />} />
            </Routes>
          )}
        </div>
      </div>
      <ToastContainer />
    </Router>
  );
}

export default App;