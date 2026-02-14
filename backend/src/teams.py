from flask import make_response
from http import HTTPStatus
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, current_user
from dependency_injector.wiring import inject, Provide
from container import Container
from typing import Dict, List

from src.repositories.models import AdminUsers, StudentUsers, Teams
from src.repositories.team_repository import TeamRepository
from src.repositories.user_repository import UserRepository
from src.repositories.school_repository import SchoolRepository

import re

team_api = Blueprint("team_api", __name__)

@team_api.route('/create', methods=['POST'])
@jwt_required()
@inject
def create_team(
    team_repo: TeamRepository = Provide[Container.team_repo],
    user_repo: UserRepository = Provide[Container.user_repo],
    school_repo: SchoolRepository = Provide[Container.school_repo],
):
    data = request.get_json()

    school_id = int(getattr(current_user, "SchoolId", 0))
    requested_school_id = data.get("school_id")

    if requested_school_id:
        if user_repo.is_admin():
            school_id = requested_school_id
        elif requested_school_id != school_id:
            return make_response({'message': 'Unauthorized'}, HTTPStatus.FORBIDDEN)

    if school_id <= 0:
        return make_response({'message': 'Invalid school ID'}, HTTPStatus.BAD_REQUEST)
    
    if team_repo.school_has_empty_team(school_id):
        return make_response({'message': 'An empty team already exists'}, HTTPStatus.BAD_REQUEST)

    team_number = team_repo.get_next_team_number(school_id)
    if team_number is None:
        return make_response({'message': 'Failed to determine next team number'}, HTTPStatus.INTERNAL_SERVER_ERROR)

    # Default name (School Name + Team Number)
    name = school_repo.get_school_name_with_id(school_id) + " " + str(team_number)

    team = team_repo.create_team(school_id, team_number, name, "Blue", False)
    return make_response({
            'id': team.Id,
            'teamNumber': team.TeamNumber,
            'name': team.Name,
            'division': team.Division,
            'isOnline': team.IsOnline,
            'members': []
    }, HTTPStatus.OK)

@team_api.route('/update', methods=['PUT'])
@jwt_required()
@inject
def update_team(
    team_repo: TeamRepository = Provide[Container.team_repo],
    user_repo: UserRepository = Provide[Container.user_repo],
):
    if not isinstance(current_user, AdminUsers):
        return make_response({'message': 'Unauthorized'}, HTTPStatus.FORBIDDEN)

    data = request.get_json()
    team_id = int(data.get("team_id") or 0)
    school_id = int(getattr(current_user, "SchoolId", 0))
    requested_school_id = data.get("school_id")

    if team_id <= 0:
        return make_response({'message': 'team_id is required.'}, HTTPStatus.NOT_ACCEPTABLE)

    if requested_school_id:
        if user_repo.is_admin():
            school_id = requested_school_id
        elif requested_school_id != school_id:
            return make_response({'message': 'Unauthorized'}, HTTPStatus.FORBIDDEN)

    if school_id <= 0:
        return make_response({'message': 'Invalid school ID'}, HTTPStatus.BAD_REQUEST)

    team = team_repo.get_team_by_id(team_id)
    if not team:
        return make_response({'message': 'Team not found'}, HTTPStatus.NOT_FOUND)
    if team.SchoolId != school_id:
        return make_response({'message': 'Unauthorized'}, HTTPStatus.FORBIDDEN)

    division = data.get("division")
    if division and division not in ["Blue", "Gold", "Eagle"]:
        return make_response({'message': 'Invalid division'}, HTTPStatus.BAD_REQUEST)

    name = data.get("name")
    if name is not None:
        name = name.strip()
        if len(name) < 3:
            return make_response(
                {'message': 'Team name must be at least three characters long.'},
                HTTPStatus.BAD_REQUEST
            )
        
        if not re.search(r"[A-Za-z0-9]", name):
            return make_response(
                {'message': 'Team name must contain at least one letter or number.'},
                HTTPStatus.BAD_REQUEST
            )
            
    is_online = data.get("is_online")

    team_repo.update_team(team.Id, name=name, division=division, is_online=is_online)

    return make_response({'message': 'Success'}, HTTPStatus.OK)

@team_api.route('/delete', methods=['DELETE'])
@jwt_required()
@inject
def delete_team(
    team_repo: TeamRepository = Provide[Container.team_repo],
    user_repo: UserRepository = Provide[Container.user_repo],
):
    if not isinstance(current_user, AdminUsers):
            return make_response({'message': 'Unauthorized'}, HTTPStatus.FORBIDDEN)
    
    data = request.get_json()
    team_id = int(data.get("team_id") or 0)
    school_id = int(getattr(current_user, "SchoolId", 0))
    requested_school_id = data.get("school_id")

    if team_id <= 0:
        return make_response({'message': 'team_id is required.'}, HTTPStatus.NOT_ACCEPTABLE)

    if requested_school_id:
        if user_repo.is_admin():
            school_id = requested_school_id
        elif requested_school_id != school_id:
            return make_response({'message': 'Unauthorized'}, HTTPStatus.FORBIDDEN)

    if school_id <= 0:
        return make_response({'message': 'Invalid school ID'}, HTTPStatus.BAD_REQUEST)

    team = team_repo.get_team_by_id(team_id)
    if not team:
        return make_response({'message': 'Team not found'}, HTTPStatus.NOT_FOUND)
    if team.SchoolId != school_id:
        return make_response({'message': 'Unauthorized'}, HTTPStatus.FORBIDDEN)
    
    student_count = user_repo.count_team_members(team.Id)
    if student_count > 0:
        return make_response(
            {'message': 'Cannot delete a team with members.'},
            HTTPStatus.BAD_REQUEST
        )

    team_repo.delete_team(team_id)

    return make_response({'message': 'Success'}, HTTPStatus.OK)

@team_api.route("/school", methods=["GET"])
@jwt_required()
@inject
def get_teams_by_school(
    team_repo: TeamRepository = Provide[Container.team_repo],
    user_repo: UserRepository = Provide[Container.user_repo],
):
    '''
    Lists teams for the current admin (teacher).
    Returns only hashed identifiers (no plaintext emails).
    '''

    if not isinstance(current_user, AdminUsers):
        return make_response({'message': 'Unauthorized'}, HTTPStatus.FORBIDDEN)

    school_id = int(getattr(current_user, "SchoolId", 0))
    requested_school_id = request.args.get("school_id", type=int)

    if requested_school_id:
        if user_repo.is_admin():
            school_id = requested_school_id
        elif requested_school_id != school_id:
            return make_response({'message': 'Unauthorized'}, HTTPStatus.FORBIDDEN)

    if school_id <= 0:
        return make_response({'message': 'Invalid school ID'}, HTTPStatus.BAD_REQUEST)

    students = user_repo.get_students_for_school(school_id)

    team_members: Dict[int, List[StudentUsers]] = {}
    for s in students:
        team_id = int(s.TeamId)
        if team_id <= 0:
            continue
        team_members.setdefault(team_id, []).append(s)

    teams = team_repo.get_teams_by_school(school_id)
    teams_sorted = sorted(teams, key=lambda x: x.TeamNumber)
    
    payload = []
    for t in teams_sorted:
        members_sorted = sorted(team_members.get(t.Id, []), key=lambda x: int(x.MemberId or 0))
        payload.append({
            "id": t.Id,
            "teamNumber": t.TeamNumber,
            "name": t.Name,
            "division": t.Division,
            "isOnline": t.IsOnline,
            "members": [
                {
                    "studentId": m.Id,
                    "memberId": int(m.MemberId or 0),
                    "emailHash": m.EmailHash,
                    "hasAccount": True if (m.PasswordHash is not None and m.PasswordHash != "") else False,
                    "isLocked": True if m.IsLocked else False,
                }
                for m in members_sorted
            ]
        })

    return make_response(payload, HTTPStatus.OK)
