import React, { useState, useEffect, useRef } from 'react';
import Cookies from 'js-cookie';

const Chatbox = ({ userId, userName, currentUser, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [socketReady, setSocketReady] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // Set chatbox state globally
  // This is a workaround to avoid prop drilling
  useEffect(() => {
    window.chatboxIsOpen = true;
    window.chatTargetId = userId;
    return () => {
      window.chatboxIsOpen = false;
      window.chatTargetId = null;
    };
  }, [userId]);

  // Get chat room name and history
  useEffect(() => {
    const fetchChatRoom = async () => {
      try {
        const csrftoken = Cookies.get('csrftoken');
        const response = await fetch(`/api/users/chat/room/${userId}/`, {
          method: 'GET',
          headers: {
            'X-CSRFToken': csrftoken,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to get chat room');
        }

        const data = await response.json();
        setRoomName(data.room_name);

        // After getting room name, fetch chat history
        fetchChatHistory();
      } catch (error) {
        console.error('Error fetching chat room:', error);
        setError('Could not load chat room. Please try again later.');
        setLoading(false);
      }
    };

    const fetchChatHistory = async () => {
      try {
        const csrftoken = Cookies.get('csrftoken');
        const response = await fetch(`/api/users/chat/history/${userId}/`, {
          method: 'GET',
          headers: {
            'X-CSRFToken': csrftoken,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to fetch chat history');
        }

        const data = await response.json();
        setMessages(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching chat history:', error);
        setError('Could not load message history. Please try again later.');
        setLoading(false);
      }
    };

    if (userId && currentUser) {
      fetchChatRoom();
    }
  }, [userId, currentUser]);

  // Connect to WebSocket when room name is available
  useEffect(() => {
    if (!roomName) return;

    // Make sure the WebSocket URL matches your server setup
    let wsUrl;
    if (window.location.protocol === 'https:') {
        wsUrl = `wss://${window.location.host}/ws/chat/${roomName}/`;
    } else {
        // Since React may be running on port 3000 but Django on 8000
        // wsUrl = `ws://localhost:8000/ws/chat/${roomName}/`;
        wsUrl = `ws://${window.location.host}/ws/chat/${roomName}/`;
    }

    console.log("Attempting to connect to WebSocket at:", wsUrl);
    const newSocket = new WebSocket(wsUrl);

    newSocket.onopen = () => {
      console.log('WebSocket connected');
      setSocketReady(true);
    };

    newSocket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setMessages(prevMessages => [...prevMessages, {
        id: Date.now(), // Temporary ID for new messages
        message: data.message,
        sender_id: data.sender_id,
        sender_name: data.sender_name,
        timestamp_formatted: new Date().toLocaleString()
      }]);
    };

    newSocket.onclose = () => {
      console.log('WebSocket disconnected');
      setSocketReady(false);
    };

    newSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('WebSocket connection error. Please try again later.');
      setSocketReady(false);
    };

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.close();
      }
    };
  }, [roomName]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !socket) return;

    // Check if socket is ready before sending
    if (!socketReady) {
      setError('Chat connection not ready. Please wait a moment and try again.');
      return;
    }

    try {
      const messageData = {
        message: inputMessage,
        sender_id: currentUser.id,
        receiver_id: userId
      };

      socket.send(JSON.stringify(messageData));
      setInputMessage('');
      setError(null); // Clear any previous errors
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white w-full max-w-lg rounded-lg p-6">
          <p className="text-center">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-lg rounded-lg flex flex-col h-3/4">
        {/* Chat Header */}
        <div className="bg-indigo-600 text-white px-4 py-3 rounded-t-lg flex justify-between items-center">
          <h3 className="font-semibold text-lg">Chat with {userName}</h3>
          <button 
            onClick={onClose}
            className="text-white hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        
        {/* Connection Status */}
        {!socketReady && (
          <div className="bg-yellow-100 border-yellow-300 border-b px-4 py-2 text-yellow-800">
            Connecting to chat server...
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border-red-300 border-b px-4 py-2 text-red-800">
            {error}
          </div>
        )}
        
        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
          {messages.length === 0 ? (
            <p className="text-center text-gray-500 my-4">No messages yet. Start the conversation!</p>
          ) : (
            messages.map((msg, index) => (
              <div 
                key={msg.id || index}
                className={`mb-4 ${parseInt(msg.sender_id) === parseInt(currentUser.id) ? 'text-right' : 'text-left'}`}
              >
                <div 
                  className={`inline-block rounded-lg px-4 py-2 max-w-xs lg:max-w-md ${
                    parseInt(msg.sender_id) === parseInt(currentUser.id) 
                      ? 'bg-indigo-500 text-white' 
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  <p>{msg.message}</p>
                  <p className={`text-xs mt-1 ${
                    parseInt(msg.sender_id) === parseInt(currentUser.id) 
                      ? 'text-indigo-100' 
                      : 'text-gray-500'
                  }`}>
                    {msg.timestamp_formatted}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="border-t border-gray-200 p-4 bg-white rounded-b-lg">
          <div className="flex">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 border border-gray-300 rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={!socketReady}
            />
            <button
              type="submit"
              className={`px-4 py-2 rounded-r-lg transition duration-200 ${
                socketReady 
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                  : 'bg-gray-400 text-gray-200 cursor-not-allowed'
              }`}
              disabled={!socketReady}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Chatbox;