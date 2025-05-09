import React, { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import '../ProfileStyle.css';
import GoogleAuthButton from './GoogleAuthButton';
import { useLocation } from 'react-router-dom';
import moment from 'moment-timezone';

export default function UserProfile({ user, setUser }) {
  // Profile data state
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState('');

  // Avatar state
  const [imagePreview, setImagePreview] = useState(null);
  const [file, setFile] = useState(null);

  // UI state
  // Default is editing mode
  const location = useLocation();
  const autoEdit = location.state?.autoEdit || false;
  const [isEditing, setIsEditing] = useState(autoEdit);

  
  // Available skills list
  const skillOptions = [
    { id: 'mentoring', label: 'Mentoring' },
    { id: 'design', label: 'Design' },
    { id: 'coding', label: 'Coding' },
    { id: 'hiring', label: 'Hiring' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'business', label: 'Business Development' },
    { id: 'product', label: 'Product Management' },
    { id: 'data', label: 'Data Science' },
    { id: 'research', label: 'Research' },
    { id: 'music', label: 'Music' },
    { id: 'sports', label: 'Sports' },
    { id: 'writing', label: 'Writing' },
    { id: 'ai', label: 'Artificial Intelligence' },
    { id: 'career', label: 'Career Advice' }
  ];

  const commonZones = [
    "America/Los_Angeles",
    "America/Denver",
    "America/Chicago",
    "America/New_York",
    "UTC",
    "Europe/London",
    "Europe/Paris",
    "Asia/Jakarta",
    "Asia/Bangkok",
    "Asia/Shanghai",
    "Asia/Singapore",
    "Asia/Taipei",
    "Asia/Tokyo",
    "Australia/Sydney"
  ];

  const [timezoneOptions, setTimezoneOptions] = useState([]);
  // timezones list state: generate a list of timezones 
  // with format like (GMT+8:00) Taipei, Beijing, Singapore (CST)
  useEffect(() => {
      // Generate timezone list with current offsets
      const timezoneGroups = {}
      commonZones.forEach(zoneName => {
          const offset = moment().tz(zoneName).format('Z'); // return like "+08:00"
          const abbr = moment().tz(zoneName).format('z'); // return like PST, EST

          if (!timezoneGroups[offset]) {
              timezoneGroups[offset] = {
                  offset: offset,
                  abbr: abbr,
                  cities: [],
                  zoneValue: zoneName
              };
          }

          const cityName = zoneName.split('/').pop().replace('_', ' ');
          timezoneGroups[offset].cities.push(cityName);
      });

      const timezoneList = Object.values(timezoneGroups).map(group => {
          return {
            value: group.zoneValue,
            label: `(GMT${group.offset}) ${group.cities.join(', ')} (${group.abbr})`
          };
        });
      
      // Sort timezones by offset
      const sortedTimezones = timezoneList.sort((a, b) => {
        const offsetA = moment().tz(a.value).utcOffset();
        const offsetB = moment().tz(b.value).utcOffset();
        return offsetA - offsetB;
      });
      
      setTimezoneOptions(sortedTimezones);
    }, []);

  // Fetch user profile data from the API
  const fetchProfile = async () => {
    try {
      const csrftoken = Cookies.get('csrftoken');
      const response = await fetch('/api/users/profile/', {
        method: 'GET',
        headers: {
          'X-CSRFToken': csrftoken
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      setProfile(data);

      if (data.avatar) {
        setImagePreview(data.avatar);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setMessage('Failed to load profile data.');
    }
  };

  // Load profile data on component mount
  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (autoEdit) {
      setMessage('Login successful! Please complete your personal profile.');
      setTimeout(() => {
        setMessage('');
      }, 3000);
    }
  }, [autoEdit]);
  

  // Handle avatar file selection
  const handleFileChange = (e) => {
    if (!isEditing) return; 
    
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  // Toggle skills selection in the profile
  const handleSkillToggle = (skillId) => {
    if (!isEditing || !profile) return; 
    
    let updatedSkills = [...(profile.skills || [])];
    
    if (updatedSkills.includes(skillId)) {
      updatedSkills = updatedSkills.filter(id => id !== skillId);
    } else {
      updatedSkills.push(skillId);
    }
    
    setProfile({
      ...profile,
      skills: updatedSkills
    });
  };

  // Save profile changes to the server
  const handleSave = async () => {
    try {
      const csrftoken = Cookies.get('csrftoken');
      
      if (file) {
        const formData = new FormData();
        formData.append('avatar', file);
        
        const uploadResponse = await fetch('/api/users/upload-avatar/', {
          method: 'POST',
          headers: {
            'X-CSRFToken': csrftoken
          },
          credentials: 'include',
          body: formData
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload avatar');
        }
        
        const uploadData = await uploadResponse.json();
        profile.avatar = uploadData.avatar_url;
      }
      
      // Update personal profile data
      const response = await fetch('/api/users/profile/', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken
        },
        credentials: 'include',
        body: JSON.stringify(profile),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }
      
      const responseData = await response.json();

      // update the global user state with new data
      if (setUser && responseData.user) {
        setUser({
          ...user,
          first_name: responseData.user.first_name,
          last_name: responseData.user.last_name,
          email: responseData.user.email
        });
      }

      // Refresh the updated profile data
      await fetchProfile();

      setMessage('Profile updated!');
      setIsEditing(false);
      
      setTimeout(() => {
        setMessage('');
      }, 1500);
    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage('Failed to update profile.');
      
      setTimeout(() => {
        setMessage('');
      }, 2000);
    }
  };

  if (!user) {
    return (
      <div className="form-container">
        <h2>User info not loaded. Please try refreshing or log in again.</h2>
      </div>
    );
  }
  
  // Show loading state while profile data is being fetched
  if (!profile || profile.google_connected === undefined) {
    return (
      <div className="form-container">
        <h2>Loading profile...</h2>
      </div>
    );
  }

  return (
      <div className={`profile-container ${!isEditing ? 'readonly-mode' : ''}`}>
        <h2>Personal Profile</h2>

        <div className="profile-section">
          {/* Profile header with avatar and bio */}
          <div className="profile-header">
            <div className="avatar-container">
              <div className="avatar-preview">
                {imagePreview ?
                    <img src={imagePreview} alt="Profile"/> :
                    <div className="avatar-placeholder">
                      {profile.first_name && profile.first_name[0]}
                      {profile.last_name && profile.last_name[0]}
                    </div>
                }
              </div>
              {isEditing && (
                  <div className="avatar-upload">
                    <label htmlFor="avatar-upload" className="upload-button">Upload</label>
                    <input
                        type="file"
                        id="avatar-upload"
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{display: 'none'}}
                    />
                  </div>
              )}
            </div>

            <div className="profile-info">
              <div className="name-bio-container">
                <h3>{profile.first_name} {profile.last_name}</h3>
                <div className="bio-preview">
                  {profile.bio || "Hello! I'm a coffee chat enthusiast. Let's connect and share stories."}
                </div>
              </div>
            </div>
          </div>

          {/* Profile form fields */}
          <div className="profile-form">
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                {isEditing ? (
                    <input
                        value={profile.first_name || ''}
                        onChange={e => setProfile({...profile, first_name: e.target.value})}
                    />
                ) : (
                    <div className="readonly-value">{profile.first_name}</div>
                )}
              </div>

              {/* Email field */}
              <div className="form-group">
                <label>Last Name</label>
                {isEditing ? (
                    <input
                        value={profile.last_name || ''}
                        onChange={e => setProfile({...profile, last_name: e.target.value})}
                    />
                ) : (
                    <div className="readonly-value">{profile.last_name}</div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Email</label>
              {isEditing ? (
                  <input
                      value={profile.email || ''}
                      onChange={e => setProfile({...profile, email: e.target.value})}
                  />
              ) : (
                  <div className="readonly-value">{profile.email}</div>
              )}
            </div>
            
            {/* Password field - different display based on authentication method */}
            {profile.google_connected ? (
              <div className="form-group">
                <label>Password</label>
                <div className="readonly-value text-gray-500">
                  Logged in with Google. No password available.
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label>Password</label>
                {isEditing ? (
                  <div className="password-field">
                    <input type="password" value="••••••••••" readOnly />
                  </div>
                ) : (
                  <div className="readonly-value">••••••••••</div>
                )}
              </div>
            )}

            {/* Time Zone selection */}
            <div className="form-group">
              <label>Time Zone</label>
              {isEditing ? (
                  <select
                      value={profile.timezone || 'UTC'}
                      onChange={e => setProfile({...profile, timezone: e.target.value})}
                  >
                    {timezoneOptions.map(zone => (
                      <option value={zone.value} key={zone.value}>
                        {zone.label}
                      </option>
                    ))}
                  </select>
              ) : (
                  <div className="readonly-value">{profile.timezone || 'UTC'}</div>
              )}
            </div>

            {/* Time Slot Duration options */}
            <div className="form-group">
              <label>Time Slot Duration</label>
              {isEditing ? (
                  <div className="time-slot-options">
                    <label className={`time-option ${profile.time_slot_duration === 15 ? 'selected' : ''}`}>
                      <input
                          type="radio"
                          name="time_slot_duration"
                          value="15"
                          checked={profile.time_slot_duration === 15}
                          onChange={() => setProfile({...profile, time_slot_duration: 15})}
                      />
                      15 min
                    </label>

                    <label className={`time-option ${profile.time_slot_duration === 30 ? 'selected' : ''}`}>
                      <input
                          type="radio"
                          name="time_slot_duration"
                          value="30"
                          checked={profile.time_slot_duration === 30}
                          onChange={() => setProfile({...profile, time_slot_duration: 30})}
                      />
                      30 min
                    </label>

                    <label className={`time-option ${profile.time_slot_duration === 60 ? 'selected' : ''}`}>
                      <input
                          type="radio"
                          name="time_slot_duration"
                          value="60"
                          checked={profile.time_slot_duration === 60}
                          onChange={() => setProfile({...profile, time_slot_duration: 60})}
                      />
                      60 min
                    </label>
                  </div>
              ) : (
                  <div className="readonly-value">{profile.time_slot_duration} min</div>
              )}
            </div>

            {/* Blocked time settings */}
            <div className="form-group">
              {isEditing ? (
                  <>
                    <label>Blocked Sleeping Time</label>
                    <label className="checkbox-label">
                      <input
                          type="checkbox"
                          checked={profile.block_selected_time || false}
                          onChange={() => setProfile({...profile, block_selected_time: !profile.block_selected_time})}
                      />
                      <span>Automatically blocked 0:00am-08:00am selected time permanently</span>
                    </label>
                  </>
              ) : (
                  <>
                    <label>Blocked Time</label>
                    <div className="readonly-value">
                      {profile.block_selected_time ? 'Yes' : 'No'}
                    </div>
                  </>
              )}
            </div>

            {/* Bio field */}
            {isEditing && (
                <div className="form-group">
                  <label>Bio</label>
                  <textarea
                      placeholder="Tell others about yourself..."
                      value={profile.bio || ''}
                      onChange={e => setProfile({...profile, bio: e.target.value})}
                      rows={4}
                  />
                </div>
            )}

            {/* Skills/Interests selection */}
            <div className="form-group">
              <label>Skills/Interests</label>
              <div className={`skills-container ${!isEditing ? 'readonly' : ''}`}>
                {skillOptions.map(skill => (
                    <div
                        key={skill.id}
                        className={`skill-tag ${profile.skills && profile.skills.includes(skill.id) ? 'selected' : ''}`}
                        onClick={() => handleSkillToggle(skill.id)}
                    >
                      {skill.label}
                    </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {isEditing && (
                <div className="warning-message mt-8 text-sm">
                  ⚠️ Note: Changing your Time Zone or Time Slot Duration will remove any previously manually deleted availability slots. Please visit <em>My Available Slots</em> to reconfigure them.
                </div>
              )}

        {isEditing ? (
            <button className="save-button" onClick={handleSave}>Save</button>
        ) : (
            <button className="edit-button" onClick={() => setIsEditing(true)}>Edit Profile</button>
        )}

        {/* Google authentication button */}
        <div className="mt-4 text-left">
          <GoogleAuthButton/>
        </div>

        {message && <p className="message">{message}</p>}
      </div>
  );
}