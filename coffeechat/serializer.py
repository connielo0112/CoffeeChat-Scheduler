from rest_framework import serializers
from . models import *

class ReactSerializer(serializers.ModelSerializer):
    class Meta:
        model = React
        fields = ['name', 'detail']


class AppointmentSerializer(serializers.ModelSerializer):
    meeting_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    meeting_link = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    booker_uid = serializers.HiddenField(default=serializers.CurrentUserDefault()) 
    
    class Meta:
        model = Appointment
        fields = ['appointment_id', 'booker_uid', 'receiver_uid', 'timeslot_id', 'status', 'meeting_id', 'meeting_link']

class AvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Availability
        fields = ['timeslot_id', 'user_id', 'update_time', 'start_datetime', 'end_datetime', 'meeting_duration']

class GoogleCalendarTimeSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoogleCalendarTime
        fields = '__all__'
        
class UserProfileSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            'first_name', 'last_name', 'email', 'bio', 'avatar',
            'timezone', 'time_slot_duration', 'skills', 'user_id',
            'block_selected_time', 'import_google_calendar', 'google_connected'
        ]
