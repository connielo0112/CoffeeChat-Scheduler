import pytz
import traceback
from django.shortcuts import render, redirect
from rest_framework.views import APIView
from . models import *
from rest_framework.response import Response
from . serializer import *

from .google_meeting import *
import os


from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from datetime import timedelta, datetime
from django.utils import timezone
from google_auth_oauthlib.flow import Flow
from django.conf import settings


import requests

from .utils import format_gcal_time,calc_ATS, timezone_transform
from datetime import time


from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from rest_framework import status
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from django.http import JsonResponse
from rest_framework.permissions import IsAuthenticated


# for image
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

from rest_framework.permissions import AllowAny
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from django.utils.dateparse import parse_datetime
from django.utils.timezone import now

# chatbox
from django.db.models import Q

class ReactView(APIView):
  
    serializer_class = ReactSerializer

    def get(self, request):
        detail = [ {"name": detail.name,"detail": detail.detail} 
        for detail in React.objects.all()]
        return Response(detail)

    def post(self, request):

        serializer = ReactSerializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return  Response(serializer.data)
        
class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile, created = UserProfile.objects.get_or_create(user=request.user)

            # Set default values if it's a newly created profile
            if created:
                profile.save()

            serializer = UserProfileSerializer(profile)

            # Check if user has a Google token
            google_connected = UserGoogleToken.objects.filter(user=request.user).exists()

            return Response({
                **serializer.data,
                "google_connected": google_connected
            })

        except Exception as e:
            print(f"Error fetching user profile: {str(e)}")
            return Response(
                {'error': f'Failed to fetch profile: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def put(self, request):
        try:
            user = request.user
            profile = user.profile  
            data = request.data

            # Update User model fields
            user.first_name = data.get('first_name', user.first_name)
            user.last_name = data.get('last_name', user.last_name)
            user.email = data.get('email', user.email)
            
            # Save the user model
            user.save()

            # Update UserProfile model fields
            profile.bio = data.get('bio', profile.bio)
            profile.timezone = data.get('timezone', profile.timezone)
            profile.time_slot_duration = data.get('time_slot_duration', profile.time_slot_duration)
            profile.block_selected_time = data.get('block_selected_time', profile.block_selected_time)
            profile.import_google_calendar = data.get('import_google_calendar', profile.import_google_calendar)
            profile.skills = data.get('skills', profile.skills)

            profile.save()

            # Prepare response data
            user_data = {
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
            }

            return Response({
                'message': 'Profile updated successfully',
                'user': user_data}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': f'Failed to update profile: {str(e)}'},status=status.HTTP_400_BAD_REQUEST)

class AppointmentView(APIView):
    serialilzer_class = AppointmentSerializer

    def post(self, request):
        serializer = AppointmentSerializer(data=request.data, context={'request': request})

        if serializer.is_valid(raise_exception=True):
            # Extract timeslot from validated data
            timeslot = serializer.validated_data['timeslot_id']
            booker_uid = request.user
            receiver_uid = serializer.validated_data['receiver_uid']
            
            if timeslot.booked:
                return Response({"error": "This timeslot is already booked"}, status=400)
            
            if booker_uid == receiver_uid:
                return Response({"error": "You cannot book an appointment with yourself"}, status=400)
            
            # Save the appointment
            appointment = serializer.save()

            # Update the timeslot to booked
            availability_object = appointment.timeslot_id
            availability_object.booked = True
            availability_object.save()

            # get user credentials (OAuth2)
            try:
                token = UserGoogleToken.objects.get(user=appointment.booker_uid)
            except UserGoogleToken.DoesNotExist:
                return Response("User not authenticated with Google")
            
            creds = Credentials(
                token=token.access_token,
                refresh_token=token.refresh_token,
                token_uri=token.token_uri,
                client_id=token.client_id,
                client_secret=token.client_secret,
                scopes=token.scopes.split(',')
            )

            # check if token expired, refresh if expired
            if creds.expired:
                creds.refresh(Request())
                token.access_token = creds.token
                token.expiry = timezone.make_aware(creds.expiry)
                token.save()
            
            # Google Meet event: get start and end time
            start_time = appointment.timeslot_id.start_datetime.isoformat()
            end_time = appointment.timeslot_id.end_datetime.isoformat()

            # create event_id and meeting_link
            # phase2: neet to pass in user token to access google calendar
            event = create_google_meet_event(
                creds,
                "Coffee chat with {}".format(appointment.receiver_uid.first_name),
                start_time,
                end_time,
                appointment.receiver_uid.email
            )
            
            # save event_id and meeting_link back to appointment
            appointment.meeting_id = event["meeting_id"]
            appointment.meeting_link = event["meeting_link"]
            # update availability timeslot to booked

            appointment.save()
            return Response(serializer.data)

class PublicUserProfileView(APIView):
    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            profile = UserProfile.objects.get(user=user)

            serializer = UserProfileSerializer(profile)

            google_connected = UserGoogleToken.objects.filter(user=request.user).exists()

            return Response({
                'user_id': profile.user.id,
                **serializer.data,
                "google_connected": google_connected
            })
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        except UserProfile.DoesNotExist:
            return Response({'error': 'User profile not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def timeslots_by_user(request, user_id):
    # Get all availability slots for the user
    try:
        user = User.objects.get(id=user_id)
        profile = user.profile
        user_timezone = profile.timezone or "UTC"

        slots = Availability.objects.filter(user_id=user_id,
                                            booked=False,
                                            user_delete=False)

        # timezone transform
        result = []
        for slot in slots:
            start_local, end_local = timezone_transform(slot.start_datetime, slot.end_datetime, user_timezone)
            result.append({
                "timeslot_id": slot.timeslot_id,
                "start_datetime": start_local.isoformat(),
                "end_datetime": end_local.isoformat(),
                "user_id": slot.user_id.id,
            })

        return JsonResponse(result, safe=False, status=200)
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# compare time slot in minute
def is_same_slot(a_start, a_end, b_start, b_end):
    return abs((a_start - b_start).total_seconds()) < 60 and abs((a_end - b_end).total_seconds()) < 60

@api_view(['POST'])
def save_availability(request):
    user = request.user
    slots = request.data.get("slots", [])

    if not user.is_authenticated:
        return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

    # slot from front end after manually delete
    kept_slots = set(
        (
            parse_datetime(s["start"]).astimezone(pytz.UTC),
            parse_datetime(s["end"]).astimezone(pytz.UTC)
        )
        for s in slots
    )

    # all available slot
    existing_slots = Availability.objects.filter(user_id=user.id, booked=False)

    for slot in existing_slots:
        slot_key = (slot.start_datetime, slot.end_datetime)

        if slot_key in kept_slots:
            # remain
            if slot.user_delete:
                slot.user_delete = False
                slot.update_time = now()
                slot.save()
        else:
            # delete
            if not slot.user_delete:
                slot.user_delete = True
                slot.update_time = now()
                slot.save()

    return Response({"status": "saved"}, status=status.HTTP_201_CREATED)

@api_view(['GET'])
def get_available_slots(request):
    user = request.user
    profile = user.profile
    user_timezone = profile.timezone or "UTC"

    # get appointed time slots
    active_appointments = Appointment.objects.exclude(status=Appointment.Status.CANCELLED)
    booked_timeslot_ids = active_appointments.values_list("timeslot_id", flat=True)

    # check if user in Availability table
    availabilities = Availability.objects.filter(user_id=user.id,
                                                 booked=False,
                                                 user_delete=False
                                                 ).exclude(
                                                timeslot_id__in=booked_timeslot_ids
                                                ).order_by("start_datetime")
    formatted = []

    if availabilities.exists():

        for a in availabilities:
            # transform timezone to front-end
            start_local, end_local = timezone_transform(a.start_datetime, a.end_datetime, user_timezone)

            # remove 00:00–08:00 based on User's timezone
            if profile.block_selected_time == 1:
                if start_local.time() < time(8, 0):
                    continue

            formatted.append({
                "start": start_local.isoformat(),
                "end": end_local.isoformat()
            })
    else:
        # if not in Availability table, using calc_ATS
        generated = calc_ATS(user.id)

        # save timeslot to Availability table
        for start, end in generated:
            Availability.objects.create(
                user_id=user,
                start_datetime=start,
                end_datetime=end,
                update_time=now(),
                meeting_duration=profile.time_slot_duration,
                booked=False,
                user_delete=False
            )


        for s, e in generated:
            # data to front-end
            s_local, e_local = timezone_transform(s, e, user_timezone)

            # remove 00:00–08:00 based on User's timezone
            if profile.block_selected_time == 1:
                # print("⛔️Skipping slot", s_local.time(),user_timezone,"UTC",s)
                if s_local.time() < time(8, 0):
                    # print("before 8AM:", s_local.time(),user_timezone,"UTC",s)
                    continue

            formatted.append({
                "start": s_local.isoformat(),
                "end": e_local.isoformat()
            })

    return Response({
        "timezone": profile.timezone,
        "slots": formatted
    })

# GOOGLE_CLIENT_SECRET_FILE = 'google-calendar-credentials/credentials.json'
GOOGLE_CLIENT_SECRET_FILE = os.path.join(settings.BASE_DIR, 'google-calendar-credentials', 'credentials_gcl.json')
SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar"
]

def google_auth_start(request):
    print("GOOGLE_CALENDAR_CLIENT_ID =", settings.GOOGLE_CALENDAR_CLIENT_ID)
    print("GOOGLE_CALENDAR_CLIENT_SECRET =", settings.GOOGLE_CALENDAR_CLIENT_SECRET)
    print("GOOGLE_CALENDAR_REDIRECT_URIS =", settings.GOOGLE_CALENDAR_REDIRECT_URIS)

    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

    redirect_uri = settings.GOOGLE_CALENDAR_REDIRECT_URIS

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CALENDAR_CLIENT_ID,
                "client_secret": settings.GOOGLE_CALENDAR_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=[
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/calendar"
        ],
        redirect_uri=redirect_uri
    )
    auth_url, _ = flow.authorization_url(prompt='consent', access_type='offline')
    return JsonResponse({'auth_url': auth_url})

def google_auth_callback(request):
    redirect_uri = settings.GOOGLE_CALENDAR_REDIRECT_URIS

    flow = Flow.from_client_secrets_file(
        GOOGLE_CLIENT_SECRET_FILE,
        scopes=SCOPES,
        redirect_uri=redirect_uri
    )
    flow.fetch_token(authorization_response=request.build_absolute_uri())

    creds = flow.credentials

    UserGoogleToken.objects.update_or_create(
        user=request.user,
        defaults={
            'access_token': creds.token,
            'refresh_token': creds.refresh_token,
            'token_uri': creds.token_uri,
            'client_id': creds.client_id,
            'client_secret': creds.client_secret,
            'scopes': ','.join(creds.scopes),
            'expiry': timezone.make_aware(creds.expiry),
        }
    )

    fetch_google_calendar(request)

    return redirect('http://localhost:3000')

@login_required
def fetch_google_calendar(request):
    try:
        token = UserGoogleToken.objects.get(user=request.user)
    except UserGoogleToken.DoesNotExist:
        return JsonResponse({'error': 'No Google token found'}, status=401)

    creds = Credentials(
        token=token.access_token,
        refresh_token=token.refresh_token,
        token_uri=token.token_uri,
        client_id=token.client_id,
        client_secret=token.client_secret,
        scopes=token.scopes.split(',')
    )

    # 如果 token 過期，自動用 refresh token 更新，並儲存新的 access_token
    if creds.expired:
        creds.refresh(Request())
        token.access_token = creds.token
        # token.expiry = creds.expiry
        token.expiry = timezone.make_aware(creds.expiry)
        token.save()

    # set interval for data retrieval: 7 days
    now = timezone.now()
    time_min = format_gcal_time(now)
    time_max = format_gcal_time(now + timedelta(days=7))

    # call api
    response = requests.get(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        headers={'Authorization': f'Bearer {creds.token}'},
        params={
            'timeMin': time_min,
            'timeMax': time_max,
            'singleEvents': 'true',
            'orderBy': 'startTime'
        }
    )


    if response.status_code != 200:
        return JsonResponse({'error': 'Google API call failed'}, status=500)

    # store data provided by api into GoogleCalendarTime
    data = response.json()
    created = 0
    # fetch_id = "..."  # gpt 建議 UUID

    for event in data.get('items', []):
        start = event['start'].get('dateTime')
        end = event['end'].get('dateTime')

        if not start or not end:
            continue

        GoogleCalendarTime.objects.create(
            user=request.user,
            start_datetime_UTC=start,
            end_datetime_UTC=end
        )
        created += 1

    return JsonResponse({'message': f'{created} events saved.'})

class RegisterView(APIView):
    def post(self, request):
        email = request.data.get("email")
        password = request.data.get('password')
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')

        if User.objects.filter(username=email).exists():
            return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name
        )

        UserProfile.objects.create(user=user, timezone=request.data.get('timezone'))

        return Response({'message': 'User registered successfully'}, status=status.HTTP_201_CREATED)

class LoginView(APIView):
    def post(self, request):
        username = request.data.get('email')
        password = request.data.get('password')

        user = authenticate(username=username, password=password)
        if user is not None:
            login(request, user)

            user_data = {
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
            }

            return Response({'message': 'Login successful', 'user': user_data})
        else:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['POST'])
@permission_classes([AllowAny])
def logout_view(request):

    # Logout won't work if user is not authenticated; we need to check
    if request.user.is_authenticated:
        request.session.flush()
        logout(request)
    
    response = JsonResponse({
        'message': 'Logged out successfully', 
        'is_authenticated': False
    })
    
    # Explicitly expire cookies
    response.set_cookie('sessionid', '', max_age=0)
    response.set_cookie('csrftoken', '', max_age=0)
    response.delete_cookie('sessionid')
    response.delete_cookie('csrftoken')
    
    return response

@method_decorator(ensure_csrf_cookie, name='dispatch')
class GetCSRFTokenView(APIView):
    def get(self, request):
        return JsonResponse({'message': 'CSRF token set'})

class GoogleLoginView(APIView):
    def post(self, request):
        id_token = request.data.get('id_token')
        if not id_token:
            return Response({'error': 'Missing id_token'}, status=400)

        try:
            from google.oauth2 import id_token as google_id_token
            from google.auth.transport import requests as google_requests

            # Verify ID token
            idinfo = google_id_token.verify_oauth2_token(
                id_token,
                google_requests.Request(),
                settings.GOOGLE_LOGIN_CLIENT_ID
            )

            # Extract user information
            email = idinfo['email']
            first_name = idinfo.get('given_name', '')
            last_name = idinfo.get('family_name', '')
            picture = idinfo.get('picture', '')

            # Get or create user
            user, created = User.objects.get_or_create(
                username=email,
                defaults={
                    'email': email, 
                    'first_name': first_name,
                    'last_name': last_name}
            )

            # Get or create user profile
            profile, _ = UserProfile.objects.get_or_create(user=user)

            # Update profile if needed
            if created or not profile.avatar:
                profile.avatar = picture

            profile.google_connected = True
            if not profile.timezone:
                profile.timezone = 'UTC'
            if not profile.time_slot_duration:
                profile.time_slot_duration = 30

            profile.save()

            # Log in the user
            login(request, user)

            # Prepare response data
            user_data = {
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
            }

            return Response({'message': 'Google login successful', 'user': user_data})

        except ValueError:
            return Response({'error': 'Invalid token'}, status=400)

class GoogleAuthCallbackView(APIView):
    def post(self, request):
        code = request.data.get('code')
        if not code:
            return Response({'error': 'Missing authorization code'}, status=400)

        try:
            # Google OAuth2 token endpoint
            token_url = "https://oauth2.googleapis.com/token"

            # Data for token exchange
            token_data = {
                'code': code,
                'client_id': settings.GOOGLE_LOGIN_CLIENT_ID,
                'client_secret': settings.GOOGLE_LOGIN_CLIENT_SECRET,
                'redirect_uri': settings.GOOGLE_LOGIN_REDIRECT_URI,
                'grant_type': 'authorization_code'
            }

            # Request headers
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded'
            }

            # Request access token
            token_response = requests.post(token_url, data=token_data, headers=headers)

            if token_response.status_code != 200:
                return Response({'error': 'Failed to get access token'}, status=400)

            token_json = token_response.json()

            # Get ID token
            id_token = token_json.get('id_token')

            if not id_token:
                return Response({'error': 'No ID token in response'}, status=400)

            # Verify ID token
            from google.oauth2 import id_token as google_id_token
            from google.auth.transport import requests as google_requests

            idinfo = google_id_token.verify_oauth2_token(
                id_token,
                google_requests.Request(),
                settings.GOOGLE_LOGIN_CLIENT_ID
            )

            # Extract user information
            email = idinfo['email']
            first_name = idinfo.get('given_name', '')
            last_name = idinfo.get('family_name', '')
            picture = idinfo.get('picture', '')

            # Get or create user
            user, created = User.objects.get_or_create(
                username=email,
                defaults={
                    'email': email, 
                    'first_name': first_name,
                    'last_name': last_name}
            )

            # Get or create user profile
            profile, profile_created = UserProfile.objects.get_or_create(user=user)

            # Update profile if needed
            if created or not profile.avatar:
                profile.avatar = picture

            profile.google_connected = True
            if not profile.timezone:
                profile.timezone = 'UTC'
            if not profile.time_slot_duration:
                profile.time_slot_duration = 30

            profile.save()

            # Log in the user
            login(request, user)

            # Prepare response data
            user_data = {
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
            }

            return Response({
                'message': 'Google login successful',
                'user': user_data
            })

        except Exception as e:
            return Response({'error': f'Google login failed: {str(e)}'}, status=500)

class AvatarUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if 'avatar' not in request.FILES:
            print("DEBUG - request.FILES keys:", request.FILES.keys())
            print("DEBUG - request.content_type:", request.content_type)
            return Response({'error': 'No avatar file provided'}, status=status.HTTP_400_BAD_REQUEST)

        avatar_file = request.FILES['avatar']

        print("FILE RECEIVED:", avatar_file.name, avatar_file.size, avatar_file.content_type)

        try:
            profile = UserProfile.objects.get(user=request.user)
        except UserProfile.DoesNotExist:
            return Response({'error': 'UserProfile does not exist'}, status=status.HTTP_404_NOT_FOUND)

        valid_extensions = ['.jpg', '.jpeg', '.png', '.gif']
        ext = os.path.splitext(avatar_file.name)[1].lower()
        if ext not in valid_extensions:
            return Response({'error': 'Invalid file type'}, status=status.HTTP_400_BAD_REQUEST)

        filename = f"avatar_{request.user.id}{ext}"

        file_path = default_storage.save(f'avatars/{filename}', ContentFile(avatar_file.read()))

        avatar_url = request.build_absolute_uri(settings.MEDIA_URL + file_path)


        profile.avatar = avatar_url
        profile.save()

        return Response({'avatar_url': avatar_url}, status=status.HTTP_200_OK)
    
class AllUserProfilesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        profiles = UserProfile.objects.select_related('user').all()
        serializer = UserProfileSerializer(profiles, many=True)
        return Response(serializer.data)

class UserAppointmentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get appointments where user is the booker (sent)
        user = request.user
        sent_appointments = Appointment.objects.filter(
            booker_uid=user
        ).select_related('receiver_uid', 'timeslot_id').order_by('-appointment_id')

        # Get appointments where user is the receiver (received)
        received_appointments = Appointment.objects.filter(
            receiver_uid=user
        ).select_related('booker_uid', 'timeslot_id').order_by('-appointment_id')

        # Serialize data
        sent_data = []
        for appt in sent_appointments:
            sent_data.append({
                'appointment_id': appt.appointment_id,
                'first_name': appt.receiver_uid.first_name,
                'last_name': appt.receiver_uid.last_name,
                'date': appt.timeslot_id.start_datetime.strftime('%Y.%m.%d'),
                'start_time': appt.timeslot_id.start_datetime.strftime('%H:%M'),
                'duration': appt.timeslot_id.meeting_duration,
                'status': appt.status,
                'meeting_link': appt.meeting_link,
            })
        
        received_data = []
        for appt in received_appointments:
            received_data.append({
                'appointment_id': appt.appointment_id,
                'first_name': appt.booker_uid.first_name,
                'last_name': appt.booker_uid.last_name,
                'date': appt.timeslot_id.start_datetime.strftime('%Y.%m.%d'),
                'start_time': appt.timeslot_id.start_datetime.strftime('%H:%M'),
                'duration': appt.timeslot_id.meeting_duration,
                'status': appt.status,
                'meeting_link': appt.meeting_link,
            })
        
        return Response({
            'sent': sent_data,
            'received': received_data
        })
    
class AppointmentActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, appointment_id):
        action = request.data.get('action')

        if not action:
            return Response({'error': 'Missing action in request'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Get the appointment
            appointment = Appointment.objects.get(appointment_id=appointment_id)

            # Check permissions - only receiver can confirm, both can cancel
            if action == 'confirm':
                if request.user != appointment.receiver_uid:
                    return Response({'error': 'Not authorized to confirm this appointment'}, 
                                    status=status.HTTP_403_FORBIDDEN)
            
                # Simply update the status to confirmed
                appointment.status = Appointment.Status.CONFIRMED
                

            elif action == 'cancel':
                # Both booker and receiver can cancel
                if request.user != appointment.booker_uid and request.user != appointment.receiver_uid:
                    return Response({'error': 'Not authorized to cancel this appointment'}, 
                                    status=status.HTTP_403_FORBIDDEN)
                
                appointment.status = Appointment.Status.CANCELLED


                # Free up the timeslot
                if appointment.timeslot_id.booked:
                    appointment.timeslot_id.booked = False
                    appointment.timeslot_id.save()
            
            else:
                return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
            
            appointment.save()
            return Response({'message': f'Appointment {action}d successfully'}, status=status.HTTP_200_OK)
        
        except Appointment.DoesNotExist:
            return Response({'error': 'Appointment not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': f'Failed to {action} appointment: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
class ChatMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_id = serializers.SerializerMethodField()
    timestamp_formatted = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatMessage
        fields = ['id', 'message', 'timestamp', 'timestamp_formatted', 'sender_id', 'sender_name', 'is_read']
    
    def get_sender_name(self, obj):
        return f"{obj.sender.first_name} {obj.sender.last_name}"
    
    def get_sender_id(self, obj):
        return obj.sender.id
    
    def get_timestamp_formatted(self, obj):
        return obj.timestamp.strftime("%H:%M %p - %b %d, %Y")

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_chat_history(request, user_id):
    """
    Get chat history between current user and specified user
    """
    if not request.user.is_authenticated:
        return Response({"error": "Unauthorized"}, status=403)
    
    try:
        other_user = User.objects.get(id=user_id)
        
        # Get messages where current user is either sender or receiver
        messages = ChatMessage.objects.filter(
            (Q(sender=request.user) & Q(receiver=other_user)) |
            (Q(sender=other_user) & Q(receiver=request.user))
        ).order_by('timestamp')
        
        # Mark received messages as read
        unread_messages = messages.filter(receiver=request.user, is_read=False)
        unread_messages.update(is_read=True)
        
        serializer = ChatMessageSerializer(messages, many=True)
        return Response(serializer.data)
    
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=404)
    except Exception as e:
        import traceback
        traceback.print_exc()  # <--- Add this
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_chat_room(request, user_id):
    """
    Get or create a unique chat room ID for two users
    """
    try:
        other_user = User.objects.get(id=user_id)
        current_user_id = request.user.id
        
        # Create a unique, consistent room name for these two users
        user_ids = sorted([current_user_id, other_user.id])
        room_name = f"chat_{user_ids[0]}_{user_ids[1]}"
        
        return Response({"room_name": room_name})
    
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@login_required
def get_notifications(request):
    """Get recent unread messages for the current user"""
    try:
        # Get unread messages for current user, limited to last 10
        unread_messages = ChatMessage.objects.filter(
            receiver=request.user,
            is_read=False
        ).order_by('-timestamp')[:10]
        
        # Format messages for frontend
        notifications = []
        for msg in unread_messages:
            notifications.append({
                'id': msg.id,
                'senderId': msg.sender.id,
                'senderName': f"{msg.sender.first_name} {msg.sender.last_name}",
                'message': msg.message[:30] + ('...' if len(msg.message) > 30 else ''),
                'timestamp': msg.timestamp.isoformat(),
                # Create room name for this chat
                'roomName': f"chat_{min(msg.sender.id, request.user.id)}_{max(msg.sender.id, request.user.id)}"
            })
        
        return JsonResponse(notifications, safe=False)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
def clear_notifications(request):
    """Mark all messages as read for the current user"""
    if request.method == 'POST':
        try:
            # Update all unread messages to read
            unread_count = ChatMessage.objects.filter(receiver=request.user, is_read=False).update(is_read=True)
            
            return JsonResponse({
                'success': True,
                'marked_as_read': unread_count
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    else:
        return JsonResponse({'error': 'Method not allowed'}, status=405)

@login_required
def get_unread_count(request):
    """Get count of unread messages for the current user"""
    try:
        unread_count = ChatMessage.objects.filter(receiver=request.user, is_read=False).count()
        
        return JsonResponse({
            'unread_count': unread_count
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)