from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import os

# If modifying these scopes, delete the file token.json.
SCOPES = ["https://www.googleapis.com/auth/calendar"]

def create_google_meet_event(creds, topic, start_time, end_time, invitee_email):  
  try:
    service = build("calendar", "v3", credentials=creds)

    # Call the Calendar API
    
    event = {
        'summary': topic,
        'start': {'dateTime':start_time, 'timeZone': "UTC"},
        'end': {'dateTime': end_time, 'timeZone': "UTC"},
        'attendees': [
            {'email': invitee_email},
        ],
        'conferenceData': {
            'createRequest': {
                'requestId': 'some-random-id-123',  # Unique for each request
                'conferenceSolutionKey': {'type': 'hangoutsMeet'}
            }
        }
    }

    event = service.events().insert(
        calendarId='primary',
        body=event,
        conferenceDataVersion=1
    ).execute()

    return {
      "meeting_id": event["id"],
      "meeting_link": event["hangoutLink"]
    }

  except HttpError as error:
    print(f"An error occurred: {error}")

# if __name__ == "__main__":
#   create_google_meet_event("coffeechat_test", "2025-03-22T9:00:00", "2025-03-22T9:15:00", "ritali0963@gmail.com")
