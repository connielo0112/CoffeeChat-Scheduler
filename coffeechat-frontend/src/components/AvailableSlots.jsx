import React, { useState, useEffect } from 'react';
import axios from 'axios';

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

function AvailableSlots() {
  const [slots, setSlots] = useState([]);
  const [selected, setSelected] = useState([]);
  const [activeDate, setActiveDate] = useState(null);
  const [timezone, setTimezone] = useState('');
  const safeTimezone = timezone || 'UTC';


  useEffect(() => {
    axios.get('/api/available-slots/', { withCredentials: true }).then(res => {
      const formatted = res.data.slots.map(slot => ({
        timeslot_id: slot.timeslot_id,
        start: new Date(slot.start),
        end: new Date(slot.end)
      }));
      // console.log("🖥️ [Front-end] Timezone from backend:", res.data.timezone);
      // console.log("🖥️ [Front-end] First 5 slots:", formatted.slice(0, 5));

      setSlots(formatted);
      setTimezone(res.data.timezone);
    });
  }, []);

  const groupedByDate = slots.reduce((acc, slot) => {
    const safeTimezone = timezone || 'UTC';
    const date = slot.start.toLocaleDateString('en-CA', { timeZone: safeTimezone });
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {});

  // Sort slots in each date group by local start time
  Object.keys(groupedByDate).forEach(date => {
    groupedByDate[date].sort((a, b) => a.start - b.start);
  });

  console.log(groupedByDate);

  const toggleSlot = (slot) => {
    const key = `${slot.start.toISOString()}|${slot.end.toISOString()}`;
    setSelected(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const submitSlots = () => {
    console.log("selected keys:", selected);

    const filtered = slots.filter(slot => {
      const key = `${slot.start.toISOString()}|${slot.end.toISOString()}`;
      return !selected.includes(key);
    });
    const payload = filtered.map(slot => ({
      timeslot_id: slot.timeslot_id,
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
    }));

    const csrftoken = getCookie('csrftoken');

    axios.post('/api/save-availability/', { slots: payload }, {
      withCredentials: true,
      headers: {
        'X-CSRFToken': csrftoken
      }
    }).then(() => {
      alert("Saved!");
      setSlots(filtered);
      setSelected([]);
    }).catch(err => {
      console.error(err);
      alert("Error saving.");
    });
  };

  const dates = Object.keys(groupedByDate).sort();
  const shownDate = activeDate || dates[0];

  return (
    <div className="w-full px-6 sm:px-10 md:px-16 py-10">
      <h2 className="text-xl font-bold mb-2">Available Time Slots</h2>
      <p className="mb-4">Feel free to delete any time slots by clicking on each time slot.</p>
      <p className="text-sm text-gray-500 mb-4">Current time zone: {timezone}</p>

      <div className="flex space-x-2 mb-4">
        {dates.map(date => (
          <button
            key={date}
            className={`px-4 py-2 rounded border ${shownDate === date ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-300'}`}
            onClick={() => setActiveDate(date)}
          >
            {
              // new Date(date).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })
              groupedByDate[date][0].start.toLocaleDateString(
                  'en-CA', {timeZone: safeTimezone, weekday: 'short', month: 'short', day: 'numeric'})
            }
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {groupedByDate[shownDate]?.map((slot, index) => {
          const key = `${slot.start.toISOString()}|${slot.end.toISOString()}`;
          const timeLabel = `${slot.start.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: safeTimezone
          })} – ${slot.end.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone
          })}`;

          return (
            <div
              key={index}
              onClick={() => toggleSlot(slot)}
              className={`cursor-pointer flex items-center justify-between px-3 py-2 border rounded ${selected.includes(key) ? 'bg-red-100 border-red-400' : 'bg-gray-100'}`}
            >
              <span>{timeLabel}</span>
              <span className="text-xl font-light">{selected.includes(key) ? '✕' : ''}</span>
            </div>
          );
        })}
      </div>

      <button
        onClick={submitSlots}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
      >
        Save
      </button>
    </div>
  );
}

export default AvailableSlots;

