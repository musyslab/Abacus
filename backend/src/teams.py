from flask import make_response
from http import HTTPStatus
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, current_user
from dependency_injector.wiring import inject, Provide
from container import Container

from src.repositories.models import AdminUsers
from src.repositories.team_repository import TeamRepository
from src.repositories.user_repository import UserRepository
from src.repositories.school_repository import SchoolRepository

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
    name = (data.get('name') or '').strip()
    division = (data.get('division') or '').strip()
    is_online = data.get('is_online', False)

    school_id = int(getattr(current_user, "SchoolId", 0))
    requested_school_id = data.get("school_id")

    if requested_school_id:
        if user_repo.is_admin(current_user):
            school_id = requested_school_id
        elif requested_school_id != school_id:
            return make_response({'message': 'Unauthorized'}, HTTPStatus.FORBIDDEN)

    if school_id <= 0:
        return make_response([], HTTPStatus.OK)

    team_number = team_repo.get_next_team_number(school_id)
    if team_number is None:
        return make_response({'message': 'Failed to determine next team number'}, HTTPStatus.INTERNAL_SERVER_ERROR)

    # Default name if not provided (School Name + Team Number)
    if not name:
        name = school_repo.get_school_name_with_id(school_id) + " " + str(team_number)

    # Default division if not provided
    if not division:
        division = 'Blue'

    team = team_repo.create_team(school_id, team_number, name, division, is_online)
    return make_response({
        'team': {
            'id': team.Id,
            'school_id': team.SchoolId,
            'team_number': team.TeamNumber,
            'name': team.Name,
            'division': team.Division,
            'is_online': team.IsOnline
        }
    }, HTTPStatus.CREATED)

@team_api.route("/school/get", methods=["GET"])
@jwt_required()
@inject
def get_teams_by_school(
    team_repo: TeamRepository = Provide[Container.team_repo],
    user_repo: UserRepository = Provide[Container.user_repo],
):

    school_id = int(getattr(current_user, "SchoolId", 0))
    requested_school_id = request.args.get("school_id", type=int)

    if requested_school_id:
        if user_repo.is_admin(current_user):
            school_id = requested_school_id
        elif requested_school_id != school_id:
            return make_response({'message': 'Unauthorized'}, HTTPStatus.FORBIDDEN)

    if school_id <= 0:
        return make_response([], HTTPStatus.OK)

    teams = team_repo.get_teams_by_school(school_id)
    return jsonify([
        {
            "id": t.Id,
            "school_id": t.SchoolId,
            "team_number": t.TeamNumber,
            "name": t.Name,
            "division": t.Division,
            "is_online": t.IsOnline
        } for t in teams
    ])
