import React from 'react';

function UserProfileCard({ firstName, lastName, profileImage, bio, timeRange }) {
    return (
    <div className="p-6">
      <div className="flex flex-row items-start gap-6">
        {/* Profile Image */}
        <div className="flex-shrink-0">
          <img 
            src={profileImage} 
            alt={`${firstName} ${lastName}`} 
            className="rounded-full h-24 w-24 object-cover"
          />
        </div>
        
        {/* Profile Information */}
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">{firstName} {lastName}</h1>
          <p className="text-gray-600 mb-6 text-left">{bio}</p>
          
          <div className="flex items-center mt-4">
            {timeRange && (
              <div className="flex items-center">
                <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span className="text-gray-500"> Coffee Chat time range:  {timeRange} min</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    )
}
export default UserProfileCard;