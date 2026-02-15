from sqlalchemy import func
from typing import List

from src.repositories.database import db
from .models import StudentUsers, Teams

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