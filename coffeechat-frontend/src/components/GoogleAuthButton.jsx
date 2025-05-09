import React from 'react';

export default function GoogleAuthButton() {
  const handleClick = async () => {
    try {
      const res = await fetch('/api/google-auth/start/');
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Non-OK response:", errorText);
        throw new Error("Failed to start Google Auth");
      }

      const data = await res.json();
      if (data.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (error) {
      console.error("Error during Google auth:", error);
    }
  };

  return (
    <div>
      <button
          onClick={handleClick}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4285F4',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Import Google Calendar
        </button>
        <div className="warning-message mt-8 text-sm">
            <p>⚠️ Note: Reimport your Google Calendar will remove any previously manually deleted availability slots. Please visit <em>My Available Slots</em> to reconfigure them.</p>
        </div>
    </div>
  );
}
