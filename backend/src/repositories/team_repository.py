from sqlalchemy import func, case
from typing import Any, List

from src.repositories.database import db
from .models import StudentUsers, TeamProjectStats, Teams, Schools, Projects, ScoreboardSnapshots

class TeamRepository:
    def get_team_by_id(self, team_id: int) -> Teams | None:
        return Teams.query.filter(Teams.Id == team_id).one_or_none()

    def get_teams_by_school(self, school_id: int) -> List[Teams]:
        return Teams.query.filter(Teams.SchoolId == school_id).order_by(Teams.TeamNumber.asc()).all()

    def get_next_team_number(self, school_id: int) -> int:
        next_team_number = (
            db.session.query(
                func.coalesce(func.max(Teams.TeamNumber), 0) + 1
            )
            .filter(Teams.SchoolId == school_id)
            .scalar()
        )
        return next_team_number
    
    def school_has_empty_team(self, school_id: int) -> bool:
        empty_team = (
            Teams.query
            .outerjoin(StudentUsers, StudentUsers.TeamId == Teams.Id)
            .filter(Teams.SchoolId == school_id, StudentUsers.Id == None)
            .first()
        )
        return empty_team is not None

    def create_team(self, school_id: int, team_number: int, name: str, division: str, is_online: bool = False) -> Teams:
        team = Teams(SchoolId=school_id, TeamNumber=team_number, Name=name, Division=division, IsOnline=is_online)
        db.session.add(team)
        db.session.commit()
        return team

    def update_team(self, team_id: int, name: str | None = None, division: str | None = None, is_online: bool | None = None) -> Teams | None:
        team = self.get_team_by_id(team_id)
        if not team:
            return None

        if name is not None:
            team.Name = name
        if division is not None:
            team.Division = division
        if is_online is not None:
            team.IsOnline = is_online

        db.session.commit()
        return team

    def delete_team(self, team_id: int) -> bool:
        team = self.get_team_by_id(team_id)
        if not team:
            return False

        db.session.delete(team)
        db.session.commit()
        return True

    def total_blue_teams(self) -> int:
        return Teams.query.filter(Teams.Division == 'Blue', Teams.IsOnline == False).count()

    def get_team_by_name(self, school_id: int, name: str) -> Teams | None:
        return Teams.query.filter(Teams.SchoolId == school_id, func.lower(Teams.Name) == func.lower(name)).one_or_none()

    def create_team_project_stats_entry(
        self,
        team_id: int,
        project_id: int,
        solved: bool,
        accepted_time_minutes: int | None,
        current_submission_id: int,
    ):
        entry = TeamProjectStats(
            TeamId=team_id,
            ProjectId=project_id,
            Attempts=1,
            Solved=solved,
            AcceptedTimeMinutes=accepted_time_minutes,
            CurrentSubmissionId=current_submission_id,
        )
        db.session.add(entry)
        db.session.commit()
        return entry.Id

    def update_team_project_stats_entry(
        self,
        team_id: int,
        project_id: int,
        solved: bool,
        accepted_time_minutes: int | None,
        current_submission_id: int,
    ):
        entry = TeamProjectStats.query.filter(
            TeamProjectStats.TeamId == team_id,
            TeamProjectStats.ProjectId == project_id,
        ).first()

        if entry is not None and not entry.Solved:
            entry.Attempts += 1
            entry.CurrentSubmissionId = current_submission_id
            if solved:
                entry.Solved = True
                entry.AcceptedTimeMinutes = accepted_time_minutes
            db.session.commit()
            return True
        return False
    
    def get_empty_scoreboard(self, division: str, is_online: bool) -> dict[str, Any]:
        team_rows = (
            db.session.query(
                Teams.Id.label("TeamId"),
                Teams.Name.label("TeamName"),
                Schools.Name.label("SchoolName"),
            )
            .join(Schools, Schools.Id == Teams.SchoolId)
            .filter(Teams.Division == division, Teams.IsOnline == is_online)
            .order_by(Teams.Id.asc())
            .all()
        )

        team_payload = [
            {
                "teamId": t.TeamId,
                "teamName": t.TeamName,
                "schoolName": t.SchoolName,
                "solvedCount": 0,
                "totalPenalty": 0,
                "lastAcceptedTime": 0,
                "projects": [],
            } for t in team_rows
        ]

        return {"projects": [], "teams": team_payload}
    
    def get_scoreboard_teams(self, division: str, is_online: bool, project_ids: list[int]) -> list[dict[str, Any]]:
        solve_case = case((TeamProjectStats.Solved == True, 1), else_=0)
        penalty_case = case((
            TeamProjectStats.Solved == True,
            TeamProjectStats.AcceptedTimeMinutes + 20 * (TeamProjectStats.Attempts - 1)),
            else_=0,
        )
        last_accepted_case = case(
            (TeamProjectStats.Solved == True, TeamProjectStats.AcceptedTimeMinutes),
            else_=0,
        )

        stats_subquery = (
            db.session.query(
                TeamProjectStats.TeamId.label("TeamId"),
                func.sum(solve_case).label("SolvedCount"),
                func.sum(penalty_case).label("TotalPenalty"),
                func.max(last_accepted_case).label("LastAcceptedTime"),
            )
            .filter(TeamProjectStats.ProjectId.in_(project_ids))
            .group_by(TeamProjectStats.TeamId)
            .subquery()
        )

        team_rows = (
            db.session.query(
                Teams.Id.label("TeamId"),
                Teams.Name.label("TeamName"),
                Schools.Name.label("SchoolName"),
                func.coalesce(stats_subquery.c.SolvedCount, 0).label("SolvedCount"),
                func.coalesce(stats_subquery.c.TotalPenalty, 0).label("TotalPenalty"),
                func.coalesce(stats_subquery.c.LastAcceptedTime, 0).label("LastAcceptedTime"),
            )
            .join(Schools, Schools.Id == Teams.SchoolId)
            .outerjoin(stats_subquery, stats_subquery.c.TeamId == Teams.Id)
            .filter(Teams.Division == division, Teams.IsOnline == is_online)
            .order_by(
                func.coalesce(stats_subquery.c.SolvedCount, 0).desc(),
                func.coalesce(stats_subquery.c.TotalPenalty, 0).asc(),
                func.coalesce(stats_subquery.c.LastAcceptedTime, 0).asc(),
                Teams.Id.asc(),
            )
            .all()
        )

        return team_rows
    
    def get_project_stats_map(self, division: str, is_online: bool, project_ids: list[int]) -> dict[tuple[int, int], TeamProjectStats]:
        '''Returns a map of (team_id, project_id) -> TeamProjectStats'''
        stat_rows = (
            TeamProjectStats.query.join(Teams, Teams.Id == TeamProjectStats.TeamId).filter(
                Teams.Division == division,
                Teams.IsOnline == is_online,
                TeamProjectStats.ProjectId.in_(project_ids),
            )
            .all()
        )

        return {(s.TeamId, s.ProjectId): s for s in stat_rows}

    def get_latest_scoreboard_snapshot(self, division: str, is_online: bool, max_minute: int | None = None) -> ScoreboardSnapshots | None:
        query = ScoreboardSnapshots.query.filter_by(Division=division, IsOnline=is_online)

        if max_minute is not None:
            query = query.filter(ScoreboardSnapshots.Minute <= max_minute)
        
        snapshot = query.order_by(ScoreboardSnapshots.Minute.desc()).first()
        return snapshot