from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from .models import Availability, UserProfile, Appointment, GoogleCalendarTime
from django.contrib.auth.models import User
from django.utils import timezone
import pytz

def format_gcal_time(dt):
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=dt_timezone.utc)
    else:
        dt = dt.astimezone(dt_timezone.utc)
    dt = dt.replace(microsecond=0)
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ')

def calc_ATS(user_id):
    user = User.objects.get(id=user_id)
    profile = UserProfile.objects.get(user=user)
    duration = profile.time_slot_duration

    start_datetime = timezone.now().astimezone(pytz.timezone(profile.timezone or "UTC"))
    start_datetime = start_datetime.replace(hour=0, minute=0, second=0, microsecond=0)
    start_datetime = start_datetime.astimezone(pytz.UTC)

    end_datetime = start_datetime + timedelta(days=7)

    # Step 1: generate all slots for 7 days
    all_slots = []
    current = start_datetime
    while current + timedelta(minutes=duration) <= end_datetime:
        end_time = current + timedelta(minutes=duration)
        all_slots.append((current, end_time))
        current = end_time

    # Step 2: block_selected_time = 'Y', remove 0:00–8:00 >> move the logic to get_available

    # Step 3: remove unavailable slot based on GoogleCalendarTime
    busy_slots = GoogleCalendarTime.objects.filter(
        user_id=user.id,
        start_datetime_UTC__lt=end_datetime,
        end_datetime_UTC__gt=start_datetime
    )

    # step 4: user have deleted time slot
    deleted_slots = Availability.objects.filter(user_id=user.id, user_delete=True)

    def is_deleted(slot, deleted):
        return any(slot[0] == d.start_datetime and slot[1] == d.end_datetime for d in deleted)

    # step 5:
    booked_slots = Appointment.objects.exclude(
        status=Appointment.Status.CANCELLED
    ).values_list("timeslot_id", flat=True)

    booked_availabilities = Availability.objects.filter(timeslot_id__in=booked_slots)

    def is_booked(slot, booked):
        return any(slot[0] == b.start_datetime and slot[1] == b.end_datetime for b in booked)

    # step 6: remove conflicts
    def is_conflicting(slot, busy):
        return not (
                slot[1] <= busy.start_datetime_UTC or
                slot[0] >= busy.end_datetime_UTC
        )

    available_slots = []
    for slot in all_slots:
        conflict = any(is_conflicting(slot, b) for b in busy_slots)
        deleted = is_deleted(slot, deleted_slots)
        if not conflict and not deleted and not is_booked(slot, booked_availabilities):
            available_slots.append(slot)

    return available_slots  # [(start_time, end_time), ...]

def update_availability(user_id):
    # in addition to delete=1, delete all data in availability
    Availability.objects.filter(
        user_id=user_id,
        booked=False,
        user_delete=False
    ).delete()

    # generate time slot
    slots = calc_ATS(user_id)

    user = User.objects.get(id=user_id)
    duration = user.profile.time_slot_duration

    # update Availability
    for start, end in slots:
        Availability.objects.create(
            user_id=user,
            start_datetime=start,
            end_datetime=end,
            update_time=timezone.now(),
            meeting_duration=duration,
            booked=False,
            user_delete=False
        )


def timezone_transform(start_time_utc: datetime, end_time_utc: datetime, user_timezone_str: str):
    try:
        if start_time_utc.tzinfo is None:
            start_time_utc = pytz.utc.localize(start_time_utc)
        else:
            start_time_utc = start_time_utc.astimezone(pytz.utc)

        if end_time_utc.tzinfo is None:
            end_time_utc = pytz.utc.localize(end_time_utc)
        else:
            end_time_utc = end_time_utc.astimezone(pytz.utc)

        # to user's timezone
        user_tz = pytz.timezone(user_timezone_str)
        start_local = start_time_utc.astimezone(user_tz)
        end_local = end_time_utc.astimezone(user_tz)

        return start_local, end_local
    except Exception as e:
        print(f"[timezone_transform error] {e}")
        return start_time_utc, end_time_utc
