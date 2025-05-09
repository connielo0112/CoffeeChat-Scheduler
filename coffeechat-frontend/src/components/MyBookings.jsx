import React, { useEffect, useState } from 'react';
import Cookies from 'js-cookie';

import moment from 'moment-timezone';
import axios from "axios";

export default function MyBookings() {
  const [bookings, setBookings] = useState({ sent: [], received: [] });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedTimezone, setSelectedTimezone] = useState(null);

  useEffect(() => {
    fetchBookings();
    const interval = setInterval(fetchBookings, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch current user data
  useEffect(() => {
    const fetchCurrentUser = async () => {
        try {
            const response = await axios.get('/api/users/profile/', {
                withCredentials: true
            });

            if (response.status === 200) {
                setCurrentUser({
                    id: response.data.user_id,
                    first_name: response.data.first_name,
                    last_name: response.data.last_name,
                    email: response.data.email,
                    timezone: response.data.timezone
                });
                setSelectedTimezone(response.data.timezone);
            }
        } catch (error) {
            console.error('Error fetching current user:', error);
        }
    };

    fetchCurrentUser();
}, []);
  
  const fetchBookings = async () => {
    try {
      const csrftoken = Cookies.get('csrftoken');
      const response = await fetch('/api/users/appointments', {
        method: 'GET',
        headers: { 'X-CSRFToken': csrftoken },
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Failed to fetch bookings');
      
      const data = await response.json();
      setBookings(data);
      // setSelectedTimezone(data.selectedTimezone);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setMessage('Failed to load booking data.');
      setLoading(false);
    }
  };

  // Function to handle booking actions (confirm/cancel)
  const handleAction = async (appointmentId, action) => {
    try {
      const csrftoken = Cookies.get('csrftoken');
      const response = await fetch(`/api/users/appointments/${appointmentId}/action/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken
        },
        credentials: 'include',
        body: JSON.stringify({ action })
      });
      
      if (!response.ok) {
        const text = await response.text();
        let errorMessage = 'Action failed';
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error('Non-JSON error response:', text);
        }
        throw new Error(errorMessage);
      }
      
      // Show success message and refresh data
      setMessage(action === 'confirm' ? 'Booking confirmed!' : 'Booking cancelled!');
      fetchBookings();
      
      // Clear message after a few seconds
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error(`Error with ${action} action:`, error);
      setMessage(`Failed to ${action} booking: ${error.message}`);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Status display component
  const StatusDisplay = ({ status }) => {
    switch(status) {
      case 'requested':
        return <span className="text-red-600 font-medium">Please confirm</span>;
      case 'confirmed':
        return <span className="text-green-600 font-medium">Confirmed</span>;
      case 'cancelled':
        return <span className="text-gray-600 font-medium">Cancelled</span>;
      default:
        return <span className="text-blue-600 font-medium">Completed</span>;
    }
  };

  // Action buttons component
  const ActionButtons = ({ booking, type }) => {
    // For sent bookings
    if (type === 'sent' && booking.status === 'requested') {
      return (
        <button 
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full text-sm"
          onClick={() => handleAction(booking.appointment_id, 'cancel')}
        >
          Cancel
        </button>
      );
    }
    
    // For received bookings awaiting confirmation
    if (type === 'received' && booking.status === 'requested') {
      return (
        <div className="flex space-x-2">
          <button 
            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full text-sm flex items-center"
            onClick={() => handleAction(booking.appointment_id, 'confirm')}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </button>
          <button 
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full text-sm flex items-center"
            onClick={() => handleAction(booking.appointment_id, 'cancel')}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      );
    }
    
    // For confirmed bookings with a meeting link
    if (booking.status === 'confirmed' && booking.meeting_link) {
      return (
        <a 
          href={booking.meeting_link} 
          target="_blank" 
          rel="noopener noreferrer"
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-full text-sm"
        >
          Google Meet
        </a>
      );
    }
    
    return null;
  };

  const BookingTable = ({ bookings, type, timezone }) => (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">First Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {bookings.length === 0 ? (
            <tr>
              <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                No {type} booking requests
              </td>
            </tr>
          ) : (
            bookings.map(booking => (
              <tr key={booking.appointment_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">{booking.first_name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{booking.last_name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{moment(booking.start_time).tz(selectedTimezone).format('YYYY-MM-DD')}</td>
                <td className="px-6 py-4 whitespace-nowrap">{moment(booking.start_time).tz(selectedTimezone).format('HH:mm')}</td>
                <td className="px-6 py-4 whitespace-nowrap">{booking.duration} min</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusDisplay status={booking.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <ActionButtons booking={booking} type={type} />
                </td>
              </tr>

            ))
          )}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return <div className="flex justify-center items-center p-10">Loading your bookings...</div>;
  }

  return (
      <div className="w-full px-6 sm:px-10 md:px-16 py-10">
        <h2 className="text-xl font-bold mb-2">My Bookings</h2>
        <p className="text-sm text-gray-500 mb-4">
          your timezone: <strong>{selectedTimezone}</strong>
        </p>

        {message && (
            <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 mb-6 rounded-md">
              {message}
            </div>
        )}

        <div className="mb-10">
          <h3 className="text-xl font-semibold text-gray-700 mb-4">Sent</h3>
          <BookingTable bookings={bookings.sent} type="sent" timezone={selectedTimezone}/>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-gray-700 mb-4">Received</h3>
          <BookingTable bookings={bookings.received} type="received" timezone={selectedTimezone}/>
        </div>
      </div>
  );
}