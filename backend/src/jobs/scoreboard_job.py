from datetime import datetime, timedelta
from src.repositories.database import db
from src.constants import COMPETITION_START, COMPETITION_END, get_minute_index
from src.services.scoreboard_service import build_scoreboard_payload, save_scoreboard_snapshot

DIVISIONS = ["Blue"]
ONLINE_VALUES = [False, True]
PROJECT_TYPE = "competition"

def run_scoreboard_job(app) -> None:
    with app.app_context():
        now = datetime.now()

        if now < COMPETITION_START or now > COMPETITION_END + timedelta(seconds=30):
            return

        minute_index = get_minute_index(start=COMPETITION_START, now=now)
        if minute_index < 0:
            return

        snapshot_time = COMPETITION_START + timedelta(minutes=minute_index)
        container = app.container

        for division in DIVISIONS:
            for is_online in ONLINE_VALUES:
                payload = build_scoreboard_payload(
                    project_repo=container.project_repo(),
                    team_repo=container.team_repo(),
                    division=division,
                    is_online=is_online,
                    project_type=PROJECT_TYPE,
                )

                save_scoreboard_snapshot(
                    minute=minute_index,
                    timestamp=snapshot_time,
                    division=division,
                    is_online=is_online,
                    payload=payload,
                )

        db.session.commit()

def add_scoreboard_job(scheduler, app) -> None:
    scheduler.add_job(
        func=run_scoreboard_job,
        trigger="cron",
        second=0,
        id="scoreboard_snapshot_job",
        args=[app],
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=120,
    )