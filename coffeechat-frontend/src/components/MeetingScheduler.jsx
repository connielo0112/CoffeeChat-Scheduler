import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import moment from 'moment-timezone';

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

function MeetingScheduler({ sender_timezone, receiver_id, receiver_profile }) {
    // State variables
    // receiver_id is passed from the parent component
    const [availableSlots, setAvailableSlots] = useState([]);
    const [uniqueDates, setUniqueDates] = useState([]); // store unique dates
    const [selectedDate, setSelectedDate] = useState(null); // store selected date
    const [selectedTimeslot, setSelectedTimeslot] = useState(null); // store selected timeslot id
    const [timeOptions, setTimeOptions] = useState([]);
    const [timeVisibleIndex, setTimeVisibleIndex] = useState(0);
    const [errorMessage, setErrorMessage] = useState(null); // for showing API errors

    const [selectedTimezone, setSelectedTimezone] = useState(sender_timezone);
    const [timezones, setTimezones] = useState([]);

    const csrftoken = getCookie('csrftoken');

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
        
        setTimezones(sortedTimezones);
      }, []);

    const fetchTimeslots = async() => {
        try {
            const response = await axios.get(`/api/users/availability/user/${receiver_id}`);
            const data = response.data;
            setAvailableSlots(data);

            // Group slots by date in current timezone
            if (data.length > 0) {
                const dateGroups = groupSlotsByDate(data, selectedTimezone);
                setUniqueDates(Object.keys(dateGroups));
                
                // Set first date as selected
                if (Object.keys(dateGroups).length > 0) {
                    const firstDate = Object.keys(dateGroups)[0];
                    setSelectedDate(firstDate);
                    setTimeOptions(dateGroups[firstDate]);
                }
            }
        } catch(error) {
            console.error('Error fetching timeslots:', error);
        }
    }

    // Add a helper function to group slots by date
    const groupSlotsByDate = (slots, timezone) => {
        const dateGroups = {};
        
        slots.forEach(slot => {
            // Important: Use moment to convert the time to the correct timezone first
            // BEFORE formatting the date - this ensures proper date boundaries
            const dateKey = moment(slot.start_datetime).tz(timezone).format('YYYY-MM-DD');
            
            if (!dateGroups[dateKey]) {
                dateGroups[dateKey] = [];
            }
            dateGroups[dateKey].push(slot);
        });
        
        return dateGroups;
    }

    // fetch available time slots from the backend
    useEffect(() => {  
        fetchTimeslots();

    }, [receiver_id]);

    // re-process date display when timezone changes
    useEffect(() => {
        if (selectedDate) {
            // Re-get time slots for the selected date when timezone changes
            getTimeSlotsForDate(selectedDate);
        }
    }, [selectedTimezone]);

    useEffect(() => {
        if (availableSlots.length > 0) {
            // Ensure we process dates correctly in the selected timezone
            console.log("Processing dates in timezone:", selectedTimezone);
            
            const dateGroups = groupSlotsByDate(availableSlots, selectedTimezone);
            const dates = Object.keys(dateGroups).sort();
            setUniqueDates(dates);
            
            // When there's a selected timeslot, follow it across timezone changes
            if (selectedTimeslot) {
                const selectedSlotObj = availableSlots.find(slot => slot.timeslot_id === selectedTimeslot);
                if (selectedSlotObj) {
                    // Get the date for this slot in the new timezone
                    const slotDate = moment(selectedSlotObj.start_datetime).tz(selectedTimezone).format('YYYY-MM-DD');
                    
                    // Log for debugging
                    console.log("Selected slot date in new timezone:", slotDate);
                    console.log("Selected slot UTC time:", new Date(selectedSlotObj.start_datetime).toISOString());
                    console.log("Selected slot local time:", moment(selectedSlotObj.start_datetime).tz(selectedTimezone).format('YYYY-MM-DD HH:mm:ss'));
                    
                    // Update selected date
                    setSelectedDate(slotDate);
                    
                    // Update time options for this date
                    setTimeOptions(dateGroups[slotDate] || []);
                    
                    // Calculate visible index to ensure selected timeslot is visible
                    const slotIndex = dateGroups[slotDate]?.findIndex(slot => slot.timeslot_id === selectedTimeslot);
                    if (slotIndex !== undefined && slotIndex >= 0) {
                        const newVisibleIndex = Math.max(0, Math.floor(slotIndex / 5) * 5);
                        setTimeVisibleIndex(newVisibleIndex);
                    }
                }
            } else {
                // No selected timeslot, select the first date
                if (dates.length > 0) {
                    const firstDate = dates[0];
                    setSelectedDate(firstDate);
                    setTimeOptions(dateGroups[firstDate]);
                    setTimeVisibleIndex(0);
                }
            }
        }
    }, [selectedTimezone, availableSlots]);

    const getTimeSlotsForDate = (date) => {
        if (!date) {
            return [];
        }

        // Convert input date to moment object in selected timezone if it's not already
        const selectedMomentDate = moment.isMoment(date) ? date : moment(date).tz(selectedTimezone);
        
        const filteredSlots = availableSlots.filter(slot => {
            // Convert slot date to moment object in selected timezone
            const slotMomentDate = moment(slot.start_datetime).tz(selectedTimezone);
            
            // Compare year, month, day using moment methods
            return (
                slotMomentDate.year() === selectedMomentDate.year() &&
                slotMomentDate.month() === selectedMomentDate.month() &&
                slotMomentDate.date() === selectedMomentDate.date()
            );
        });
        
        setTimeOptions(filteredSlots);
        setTimeVisibleIndex(0);
        return filteredSlots;
    }

    const navigateTimeSlots = (direction) => {
        if (direction === 'next' && timeVisibleIndex + 5 < timeOptions.length) {
            setTimeVisibleIndex(timeVisibleIndex + 2);
        } else if (direction === 'prev' && timeVisibleIndex > 0) {
            setTimeVisibleIndex(timeVisibleIndex - 2);
        }
    }

    const visibleTimeSlots = timeOptions.slice(timeVisibleIndex, timeVisibleIndex + 5);

    const handleDateSelect = (date) => {
        setSelectedDate(date);
        
        // Get the slots for this date from the pre-grouped data
        const dateGroups = groupSlotsByDate(availableSlots, selectedTimezone);
        const slotsForDate = dateGroups[date] || [];
        
        setTimeOptions(slotsForDate);
        setTimeVisibleIndex(0);
        setSelectedTimeslot(null);
    }

    const handleConfirm = async () => {
        try {
            const response = await axios.post('/api/meetings/create', {
                receiver_uid: receiver_id,
                timeslot_id: selectedTimeslot
            }, {
                withCredentials: true,
                headers: {
                  'X-CSRFToken': csrftoken
                }
              });

            if (response.status === 200) {
                alert('Chat invitation sent successfully!');
                setErrorMessage(null);

                // Remove the booked timeslot from the current view
                const updatedTimeOptions = timeOptions.filter(slot => slot.timeslot_id !== selectedTimeslot);
                setTimeOptions(updatedTimeOptions);

                // Also remove from availableSlots in case user reselects this date later
                const updatedAvailable = availableSlots.filter(slot => slot.timeslot_id !== selectedTimeslot);
                setAvailableSlots(updatedAvailable);

                // reset selected timeslot
                setSelectedTimeslot(null);
            } else {
                alert('Failed to send chat invitation.');
            }
        } catch (error) {
            console.error('Error creating meeting:', error);
            const message = error.response?.data?.error || "Something went wrong";
            setErrorMessage(message);
        }
    }

    const selectedSlot = availableSlots.find(slot => slot.timeslot_id === selectedTimeslot);

    return (
        <div className="bg-white rounded-3xl max-w-1/2 w-full p-8 shadow-lg">
            {/* Date selector */}
            <div>
                <h2 className="text-2xl font-bold text-gray-700 mb-6">When should we meet?</h2>
                <div className="flex justify-start w-full px-10 space-x-2">
                    {uniqueDates.map((date) => (
                    <div 
                        key={date}
                        onClick={() => {
                            handleDateSelect(date); // Just pass the date string directly
                            setSelectedTimeslot(null); // reset selected timeslot when date changes
                        }}
                        className={`
                            cursor-pointer rounded-xl w-1/5 py-4 px-2 text-center transition
                            ${selectedDate && selectedDate === date  // Direct string comparison
                                ? 'border-2 border-indigo-400 bg-indigo-50' 
                                : 'border border-gray-200 hover:bg-gray-100'}
                            `}
                    >
                        <div className="text-xl font-medium">
                            {moment(date).format('ddd')}
                        </div>
                        <div className="text-xl font-bold">
                            {moment(date).format('DD MMM')}
                        </div>
                    </div>
                    ))}
                </div>
            </div>

            {/* Time selector */}
            <div>
                <h2 className="text-2xl font-bold text-gray-700 mt-6">Select your available time</h2>
                {                    
                timeOptions.length > 0 ? (
                    <div>
                        {
                        timeOptions.length > 5 ? (
                            <div className="flex justify-end mb-2 space-x-2">
                                <button 
                                    onClick={() => navigateTimeSlots('prev')}
                                    disabled={timeVisibleIndex === 0}
                                    className="h-8 w-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-xl text-gray-600 font-bold disabled:text-gray-400"
                                >
                                    &larr;
                                </button>
                                
                                <button 
                                    onClick={() => navigateTimeSlots('next')}
                                    disabled={timeVisibleIndex + 5 >= timeOptions.length}
                                    className="h-8 w-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-xl text-gray-600 disabled:text-gray-400"
                                >
                                    &rarr;
                                </button>
                            </div>
                        ) : 
                            <div className="mb-10"></div>
                        }
                        <div className="grid grid-cols-5 gap-4 mb-12 px-6">
                            {visibleTimeSlots.map((slot) => (
                                <div 
                                    key={slot.timeslot_id}
                                    onClick={() => {
                                        setSelectedTimeslot(slot.timeslot_id);
                                        setErrorMessage(null);
                                    }}
                                    className={`
                                        cursor-pointer rounded-xl p-3 text-center transition
                                        ${selectedTimeslot && selectedTimeslot === slot.timeslot_id
                                            ? 'border-2 font-bold border-indigo-400 bg-indigo-50' 
                                            : 'border border-gray-200 hover:bg-gray-100'}
                                        `}
                                >
                                    <div className="text-xl font-medium">
                                        {moment(slot.start_datetime).tz(selectedTimezone).format('h:mm A')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-gray-500 mt-6"> No available time slots for this date. </div>
                )
                }
            </div>
            
            {/* Timezone Conversion */}
            <div className="mb-4">
                <label className="block text-2xl font-bold text-gray-700 mb-2">Select Timezone</label>
                <select
                    className="border rounded-lg p-2 w-1/4"
                    value={selectedTimezone}
                    onChange={(e) => setSelectedTimezone(e.target.value)}
                >
                    {timezones.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                            {tz.label}
                        </option>
                    ))}
                </select>
            </div>

            
            { selectedSlot && (
                <div>
                    <div className="flex items-center justify-between mt-8">
                        <div className="text-xl">Are you going to schedule a coffee chat on {" "}
                            <div className="inline-block font-bold text-gray-700">
                            {selectedSlot 
                                ? `${ moment(selectedSlot.start_datetime).tz(selectedTimezone).format("DD MMM")} at ${ moment(selectedSlot.start_datetime).tz(selectedTimezone).format("h:mm A")}`
                                : '...'}
                            </div>
                            {" "} with {" "} 
                            <div className="inline-block font-bold text-gray-700"> { receiver_profile.first_name } { receiver_profile.last_name } </div>
                            ?
                        </div>
                        
                        <button
                            onClick={handleConfirm}
                            className="w-1/5 bg-indigo-600 text-white py-4 rounded-lg text-l font-bold transition hover:bg-indigo-800 disabled:opacity-50"
                        >
                            Schedule!
                        </button>
                    </div>

                    {errorMessage && (
                        <div className="text-red-600 text-right font-medium mt-2">
                            {errorMessage}
                        </div>
                    )}
                </div>
            )}
        </div>

    )
    
}

export default MeetingScheduler;