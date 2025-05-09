from django.contrib import admin
from django.contrib.auth.models import User

from coffeechat.models import GoogleCalendarTime, UserGoogleToken
from coffeechat.models import Appointment, Availability, UserProfile

# Register your models here.
admin.site.register(UserGoogleToken)
admin.site.register(UserProfile)
admin.site.register(Appointment)

@admin.register(GoogleCalendarTime)
class GoogleCalendarTimeAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'start_datetime_UTC', 'end_datetime_UTC', 'update_time')
