from django.urls import path
from .views import *
from .views import GetCSRFTokenView


urlpatterns = [
    path('register/', RegisterView.as_view(), name="register"),
    path('login/', LoginView.as_view(), name="login"),
    # get requestor's profile
    path('logout/', logout_view, name='logout'),

    path('profile/', UserProfileView.as_view(), name="user-profile"),
    # get other user's profile
    path('profile/<int:user_id>/', PublicUserProfileView.as_view(), name="public-user-profile"),
    
    path('google-login/', GoogleLoginView.as_view(), name="google-login"),
    path('csrf/', GetCSRFTokenView.as_view(), name="get-csrf-token"),
    path('upload-avatar/', AvatarUploadView.as_view(), name="upload-avatar"),
    path('google-auth-callback/', GoogleAuthCallbackView.as_view(), name="google_auth_callback"),
    path('all-users/',AllUserProfilesView.as_view(), name="all-users"),
    path('appointments/', UserAppointmentsView.as_view(), name="user-appointments"),
    path('appointments/<int:appointment_id>/action/', AppointmentActionView.as_view(), name="appointment-action"),

    # test for creating availability
    path('availability/user/<int:user_id>', timeslots_by_user, name='timeslots-by-user'),
    
    # for creating appointment
    path('meetings/create', AppointmentView.as_view(), name="create-appointment"),

    # test for timeslot generation in time management
    path('available-slots/', get_available_slots, name='available_slots'),
    path('save-availability/', save_availability, name='save_availability'),

    # chatbox
    path('chat/history/<int:user_id>/', get_chat_history, name='chat-history'),
    path('chat/room/<int:user_id>/', get_chat_room, name='chat-room'),

    # New chat notification endpoints
    path('chat/notifications/', get_notifications, name='chat-notifications'),
    path('chat/notifications/clear/', clear_notifications, name='clear-notifications'),
    path('chat/notifications/count/', get_unread_count, name='unread-count'),


    # for OAuth > save token > call calendar api and save user's schedule
    path('google-auth/start/', google_auth_start, name='google_auth_start'),
    path('google-auth/callback/', google_auth_callback, name='google_auth_callback'),
    path('fetch-google-calendar/', fetch_google_calendar, name='fetch_google_calendar'),
]