import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';

const skillOptions = [
  { id: 'all', label: 'All' },
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

export default function UserDirectory() {
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState(['all']);
  const navigate = useNavigate();


  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users/all-users/', {
          credentials: 'include',
        });
        const data = await res.json();
        setAllUsers(data);
        setFilteredUsers(data);
      } catch (err) {
        console.error('Error fetching user list:', err);
      }
    };

    fetchUsers();
  }, []);

  const handleSkillClick = (skillId) => {
    let newSelectedSkills;
    
    if (skillId === 'all') {
      newSelectedSkills = ['all'];
    } else if (selectedSkills.includes(skillId)) {
      newSelectedSkills = selectedSkills.filter(id => id !== skillId);
      
      if (newSelectedSkills.length === 0 || (newSelectedSkills.length === 1 && newSelectedSkills[0] === 'all')) {
        newSelectedSkills = ['all'];
      } else if (newSelectedSkills.includes('all')) {
        newSelectedSkills = newSelectedSkills.filter(id => id !== 'all');
      }
    } else {
      newSelectedSkills = selectedSkills.includes('all') 
        ? [skillId]
        : [...selectedSkills, skillId];
    }
    
    setSelectedSkills(newSelectedSkills);
    
    if (newSelectedSkills.includes('all')) {
      setFilteredUsers(allUsers);
    } else {
      setFilteredUsers(
        allUsers.filter(user => 
          user.skills && newSelectedSkills.some(skill => user.skills.includes(skill))
        )
      );
    }
  };

  return (
    <div className="w-full px-6 sm:px-10 md:px-16 py-10">
      <h2 className="text-xl font-bold py-2 mb-2">☕ Find Someone to Coffee Chat</h2>

      <div className="flex flex-wrap gap-3 mb-8">
        {skillOptions.map(skill => (
          <button
            key={skill.id}
            onClick={() => handleSkillClick(skill.id)}
            className={`w-auto max-w-fit px-4 py-2 rounded-full border text-sm font-medium transition whitespace-nowrap
              ${
                selectedSkills.includes(skill.id)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'
              }`}
          >
            {skill.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 justify-start sm:justify-center">
        {filteredUsers.map(user => (
          <div
            key={user.email}
            className="w-[160px] bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all duration-200"
            onClick={() => navigate(`/availability/user/${user.user_id}`)}
          >
            <img
              src={user.avatar || '/default-avatar.png'}
              alt={`${user.first_name} ${user.last_name}`}
              className="w-full h-[160px] object-cover rounded-t-xl"
              style={{ imageRendering: 'crisp-edges' }}
            />
            <div className="p-3 text-center">
              <h3 className="text-indigo-600 font-semibold text-sm">{user.first_name} {user.last_name}</h3>
              <div className="flex flex-wrap justify-center gap-1 mt-2">
                {user.skills?.map(skill => (
                  <span key={skill} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
