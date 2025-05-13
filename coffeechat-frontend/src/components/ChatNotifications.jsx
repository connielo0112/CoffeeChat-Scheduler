import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

/* 
1. Shows a bell icon with a red badge indicating unread messages
2. Toggles a dropdown showing recent message notifications
3. Links to the sender's profile to start a chat
*/

function ChatNotifications({ unreadCount, notifications, clearNotifications }) {

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Close the dropdown if clicked outside
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const handleNotificationClick = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={handleNotificationClick}
        className="relative p-1 rounded-full text-gray-700 hover:bg-gray-200 focus:outline-none"
      >
        <svg 
          className="h-6 w-6" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth="2" 
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        
        
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg z-50">
          <div className="p-2 border-b flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-700">Messages</h3>
            {notifications && notifications.length > 0 && (
              <button 
                onClick={clearNotifications}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Mark all as read
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {!notifications || notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No new messages
              </div>
            ) : (
              <ul>
                {notifications.map(notification => (
                  <li key={notification.id} className="border-b last:border-b-0">
                    // Link to user's profile
                    <Link 
                        to={`/availability/user/${notification.senderId}`}
                        state={{ autoOpenChat: true }}
                        className="block p-4 hover:bg-gray-50"
                        onClick={() => {
                            setIsOpen(false);
                            clearNotifications();
                        }}
                        >
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-gray-900">{notification.senderName}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(notification.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatNotifications;