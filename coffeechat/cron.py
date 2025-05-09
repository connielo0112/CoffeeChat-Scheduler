from django_cron import CronJobBase, Schedule
from django.contrib.auth.models import User
from .utils import update_availability
import logging
from django.utils.timezone import now


logger = logging.getLogger(__name__)


class DailyAvailabilityUpdate(CronJobBase):
    RUN_EVERY_MINS = 1440  # 24 hours

    schedule = Schedule(run_every_mins=RUN_EVERY_MINS)
    code = 'coffeechat.daily_availability_update'

    logger = logging.getLogger(__name__)

    def do(self):
        print(f"[{now()}] Running availability update...")
        logger.info(f"[{now()}] CRON running...")

        for user in User.objects.all():
            update_availability(user.id)