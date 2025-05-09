import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import MeetingScheduler from '../components/MeetingScheduler.jsx';
import UserProfileCard from '../components/UserProfileCard.jsx';
import Chatbox from '../components/Chatbox';


function UserTimeslotPage() {
    const { user_id } = useParams();
    const location = useLocation();
    
    // Profile data
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Chat data
    const [currentUser, setCurrentUser] = useState(null);
    const autoOpenChat = location.state?.autoOpenChat || false;
    const [showChatbox, setShowChatbox] = useState(autoOpenChat);

    // Fetch user profile data
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await axios.get(`/api/users/profile/${user_id}`);
                setProfile(response.data);
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
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
                }
            } catch (error) {
                console.error('Error fetching current user:', error);
            }
        };

        fetchCurrentUser();
    }, []);

    // triggers when location.state changes
    useEffect(() => {
        if (location.state?.autoOpenChat) {
        setShowChatbox(true);
        // clean it up so it doesn't auto-open again on back nav
        window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // Check if the profile data is still loading
    if (loading) return <div>Loading...</div>;

    // Check if the profile data is empty
    if (!profile || Object.keys(profile).length === 0) {
        return (
          <div className="flex flex-col items-center justify-center mt-16 text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              No Profile Data Available.
            </h2>
            <p className="text-gray-600 mb-4">
              Please log in to view this user’s availability.
            </p>
            <a
              href="/login"
              className="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
            >
              Go to Login
            </a>
          </div>
        );
      }
      
    // Check if the profile data is valid
    if (!profile.first_name || !profile.last_name || !profile.email) {
        return <div>Invalid profile data.</div>;
    }

    // Handle opening chat
    const handleOpenChat = () => {
        setShowChatbox(true);
    };

    // If not logged in, show message
    if (!currentUser) {
        return (
        <div className="text-center mt-10 text-red-600 font-medium text-lg">
            Please log in to view user availability and send messages.
        </div>
        );
    }


    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-start">
                <UserProfileCard
                    firstName={profile.first_name}
                    lastName={profile.last_name}
                    profileImage={profile.avatar}
                    bio={profile.bio && profile.bio.trim() !== '' 
                        ? profile.bio 
                        : "Hello! I'm a coffee chat enthusiast. Let's connect and share stories."}
                    timeRange={profile.time_slot_duration}
                />

                {/* DM Button */}
                <button
                        onClick={handleOpenChat}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg transition-colors duration-200"
                    >
                        Send Message
                    </button>
            </div>
            <MeetingScheduler sender_timezone = {currentUser.timezone} receiver_id={profile.user_id} receiver_profile={profile} />
            {/* Meeting Scheduler Component */}
            {/* Chatbox Component */}
            {showChatbox && currentUser && (
                <Chatbox 
                    userId={user_id}
                    userName={`${profile.first_name} ${profile.last_name}`}
                    currentUser={currentUser}
                    onClose={() => setShowChatbox(false)}
                />
            )}
        </div>
    )

}

export default UserTimeslotPage;