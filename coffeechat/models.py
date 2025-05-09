from django.db import models
from django.contrib.auth.models import User


# Create your models here.


class React(models.Model):
    name = models.CharField(max_length=30)
    detail = models.CharField(max_length=500)

class Appointment(models.Model):
    class Status(models.TextChoices):
        REQUESTED = "requested", "Requested"
        CONFIRMED = "confirmed", "Confirmed"
        CANCELLED = "cancelled", "Cancelled"
        COMPLETED = "completed", "Completed"

    appointment_id = models.AutoField(primary_key=True)
    booker_uid = models.ForeignKey(User, on_delete=models.PROTECT, related_name='booked_appointments')
    receiver_uid = models.ForeignKey(User, on_delete=models.PROTECT, related_name='received_appointments')
    timeslot_id = models.ForeignKey('Availability', on_delete=models.PROTECT, null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.REQUESTED)
    meeting_id = models.CharField(max_length=200, blank=True, null=True)
    meeting_link = models.CharField(max_length=200, blank=True, null=True)

class Availability(models.Model):
    class Duration(models.IntegerChoices):
        FIFTEEN = 15, "15 minutes"
        THIRTY = 30, "30 minutes"
        SIXTY = 60, "60 minutes"

    timeslot_id = models.AutoField(primary_key=True)
    user_id = models.ForeignKey(User, on_delete=models.PROTECT)
    update_time = models.DateTimeField()
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    meeting_duration = models.IntegerField(choices=Duration.choices, default=Duration.THIRTY)
    booked = models.BooleanField(default=False)
    user_delete = models.BooleanField(default=False)

class GoogleCalendarTime(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    start_datetime_UTC = models.DateTimeField()
    end_datetime_UTC = models.DateTimeField()
    update_time = models.DateTimeField(auto_now=True)

# Save User tokens for future sync
class UserGoogleToken(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    access_token = models.TextField()
    refresh_token = models.TextField()
    token_uri = models.CharField(max_length=200)
    client_id = models.CharField(max_length=200)
    client_secret = models.CharField(max_length=200)
    scopes = models.TextField()
    expiry = models.DateTimeField()


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    bio = models.TextField(blank=True, null=True)
    avatar = models.URLField(blank=True, null=True)
    timezone = models.CharField(max_length=50, default='UTC')
    time_slot_duration = models.IntegerField(default=30)
    skills = models.JSONField(default=list, blank=True, null=True)
    block_selected_time = models.BooleanField(default=False)
    import_google_calendar = models.BooleanField(default=False)
    google_connected = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.email}'s profile"

class ChatMessage(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages')
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['timestamp']
    
    def __str__(self):
        return f"From {self.sender.username} to {self.receiver.username}: {self.message[:20]}"

def __str__(self):
    return f"Token for {self.user.username}"

