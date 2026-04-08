import json
from typing import Any
from datetime import datetime
from src.repositories.database import db
from src.repositories.models import ScoreboardSnapshots, TeamProjectStats

def _format_team_project_stats(stats: TeamProjectStats | None) -> dict[str, Any]:
    if stats is None:
        return {
            "attempts": 0,
            "solved": False,
            "acceptedTimeMinutes": None,
            "currentSubmissionId": None,
        }
    
    return {
        "attempts": int(stats.Attempts or 0),
        "solved": bool(stats.Solved),
        "acceptedTimeMinutes": int(stats.AcceptedTimeMinutes) if stats.AcceptedTimeMinutes is not None else None,
        "currentSubmissionId":int(stats.CurrentSubmissionId) if stats.CurrentSubmissionId is not None else None,
    }

def build_scoreboard_payload(
    project_repo,
    team_repo,
    division: str,
    is_online: bool,
    project_type: str,
) -> dict[str, Any]:
    """
    Builds the competition scoreboard payload
    Returns list of dicts with team info and stats for the scoreboard.
    """
    projects = project_repo.get_projects_by_type_division(project_type, division.lower())

    if not projects:
        return team_repo.get_empty_scoreboard(division, is_online)
    
    project_ids = [p.Id for p in projects]
    projects_payload = [{"id": p.Id, "orderIndex": p.OrderIndex} for p in projects]

    team_rows = team_repo.get_scoreboard_teams(division, is_online, project_ids)
    stats_map = team_repo.get_project_stats_map(division, is_online, project_ids)
    
    teams_payload = [
        {
            "teamId": t.TeamId,
            "teamName": t.TeamName,
            "schoolName": t.SchoolName,
            "solvedCount": int(t.SolvedCount),
            "totalPenalty": int(t.TotalPenalty),
            "lastAcceptedTime": int(t.LastAcceptedTime),
            "projects": [
                {
                    "id": p.Id,
                    **_format_team_project_stats(stats_map.get((t.TeamId, p.Id)))
                } for p in projects
            ],
        } for t in team_rows
    ]

    return {"projects": projects_payload, "teams": teams_payload}

def save_scoreboard_snapshot(
    minute: int,
    timestamp: datetime,
    division: str,
    is_online: bool,
    payload: dict[str, Any],
) -> None:
    """
    Saves a snapshot of the scoreboard to the database.
    """
    snapshot = ScoreboardSnapshots.query.filter_by(
        Division=division,
        IsOnline=is_online,
        Minute=minute,
    ).first()

    if snapshot is None:
        snapshot = ScoreboardSnapshots(
            Division=division,
            IsOnline=is_online,
            Minute=minute,
            TimeStamp=timestamp,
            Payload=json.dumps(payload),
        )
        db.session.add(snapshot)