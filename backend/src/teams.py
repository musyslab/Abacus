from flask import make_response
from http import HTTPStatus
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, current_user
from dependency_injector.wiring import inject, Provide
from container import Container
from typing import Dict, List
import ast
import json
import os

from src.repositories.models import AdminUsers, StudentUsers, Teams
from src.repositories.team_repository import TeamRepository
from src.repositories.user_repository import UserRepository
from src.repositories.school_repository import SchoolRepository
from src.repositories.submission_repository import SubmissionRepository
from src.repositories.project_repository import ProjectRepository
from src.constants import DIVISION_TEAM_CAPS

import re

team_api = Blueprint("team_api", __name__)

def total_teams_in_division(division: str) -> int:
    return Teams.query.filter_by(Division=division).count()

def parse_result_payload(raw):
    if raw is None:
        return None

    if isinstance(raw, (dict, list)):
        return raw

    text = str(raw).strip()
    if text == "":
        return None

    try:
        return json.loads(text)
    except Exception:
        pass

    try:
        return ast.literal_eval(text)
    except Exception:
        return None


def extract_result_rows(payload):
    if isinstance(payload, list):
        return payload

    if isinstance(payload, dict):
        if isinstance(payload.get("results"), list):
            return payload["results"]
        if isinstance(payload.get("testResults"), list):
            return payload["testResults"]

    return []


def load_submission_result_rows(submission_repo: SubmissionRepository, submission) -> List[dict]:
    if submission is None:
        return []

    # First try the DB field saved on the submission row
    parsed = parse_result_payload(getattr(submission, "TestCaseResults", None))
    rows = extract_result_rows(parsed)
    if rows:
        return rows

    # Fallback to the output file contents if present
    output_path = getattr(submission, "OutputFilepath", "") or ""
    if output_path and os.path.exists(output_path):
        try:
            raw_output = submission_repo.read_output_file(output_path)
            parsed = parse_result_payload(raw_output)
            rows = extract_result_rows(parsed)
            if rows:
                return rows
        except Exception:
            pass

    return []

def count_passed_testcases(rows: List[dict]) -> int:
    passed = 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        if bool(row.get("passed", row.get("State", False))):
            passed += 1
    return passed

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

    # Default name (Team + Team Number)
    name = f"Team {team_number}"

    default_division = next(
        (
            division
            for division in ["Blue", "Gold", "Eagle"]
            if total_teams_in_division(division) < DIVISION_TEAM_CAPS[division]
        ),
        None,
    )

    if not default_division:
        return make_response(
            {
                'message': 'All division team caps have been reached. Contact support if you believe this is a mistake.'
            },
            HTTPStatus.CONFLICT
        )

    team = team_repo.create_team(school_id, team_number, name, default_division, False)

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
        if len(name) > 30:
            return make_response(
                {'message': 'Team name can be no longer than 30 characters.'},
                HTTPStatus.BAD_REQUEST
            )
        if not re.match(r"^[A-Za-z0-9\s'\-_]+$", name):
            return make_response(
                {'message': 'Team name can only contain letters, numbers, spaces, underscores, hyphens, and apostrophes.'},
                HTTPStatus.BAD_REQUEST
            )
        if not re.search(r"[A-Za-z0-9]", name):
            return make_response(
                {'message': 'Team name must contain at least one letter or number.'},
                HTTPStatus.BAD_REQUEST
            )

        existing_team = team_repo.get_team_by_name(school_id, name)
        if existing_team and existing_team.Id != team_id:
            return make_response(
                {'message': 'Team name is already in use.'},
                HTTPStatus.BAD_REQUEST
            )
            
    is_online = data.get("is_online")

    if division and division != team.Division:
        division_cap = DIVISION_TEAM_CAPS.get(division)
        if division_cap is not None and total_teams_in_division(division) >= division_cap:
            return make_response(
                {
                    'message': f'The maximum amount of teams among all schools has been reached for the {division} division ({division_cap}). Contact support if you believe this is a mistake.'
                },
                HTTPStatus.CONFLICT
            )

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

@team_api.route("/byschool", methods=["GET"])
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

    teams = team_repo.get_teams_by_school(school_id)
    teams_sorted = sorted(teams, key=lambda x: x.TeamNumber)
    
    payload = []
    for t in teams_sorted:
        payload.append({
            "Id": t.Id,
            "Name": t.Name,
        })

    return make_response(payload, HTTPStatus.OK)
    

@team_api.route("/byschool/details", methods=["GET"])
@jwt_required()
@inject
def get_teams_by_school_detailed(
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

@team_api.route("/members", methods=["GET"])
@jwt_required()
@inject
def get_members_by_team(
    user_repo: UserRepository = Provide[Container.user_repo],
):
    '''
    Lists members for a given team.
    '''

    if not isinstance(current_user, AdminUsers):
        return make_response({'message': 'Unauthorized'}, HTTPStatus.FORBIDDEN)

    team_id = request.args.get("team_id", type=int)
    if team_id is None:
        return make_response({'message': 'team_id is required'}, HTTPStatus.BAD_REQUEST)

    members = user_repo.get_students_for_team(team_id)    

    return jsonify([
        {
            "Id": m.Id,
            "MemberId": m.MemberId,
        }
        for m in members
    ])

@team_api.route("/me", methods=["GET"])
@jwt_required()
@inject
def get_my_team(
    team_repo: TeamRepository = Provide[Container.team_repo],
):
    team_id = getattr(current_user, "TeamId", None)
    if team_id is None:
        return jsonify({}), 404

    team = team_repo.get_team_by_id(int(team_id))
    if not team:
        return jsonify({}), 404

    return jsonify({
        "id": team.Id,
        "name": team.Name,
        "division": team.Division,
        "teamNumber": team.TeamNumber,
        "isOnline": team.IsOnline,
    })

@team_api.route("/submissions/summary", methods=["GET"])
@jwt_required()
@inject
def get_team_submission_summary(
    team_repo: TeamRepository = Provide[Container.team_repo],
    user_repo: UserRepository = Provide[Container.user_repo],
    submission_repo: SubmissionRepository = Provide[Container.submission_repo],
    project_repo: ProjectRepository = Provide[Container.project_repo],
):
    """
    Returns one summary row per project for the requested team.
    Shape matches what AdminTeamSubmissions.tsx expects:
    [
        {
            "projectId": 1,
            "totalTestcases": 8,
            "passedTestcases": 6,
            "submissionCount": 3,
            "latestSubmissionId": 42,
            "latestSubmittedAt": "2026-03-19T14:23:11"
        }
    ]
    """

    is_admin = isinstance(current_user, AdminUsers)
    is_student = isinstance(current_user, StudentUsers)

    if not (is_admin or is_student):
        return make_response({'message': 'Unauthorized'}, HTTPStatus.FORBIDDEN)

    requested_team_id = request.args.get("team_id", type=int)

    if is_student:
        own_team_id = int(getattr(current_user, "TeamId", 0) or 0)
        if own_team_id <= 0:
            return make_response({'message': 'No team is associated with this account'}, HTTPStatus.BAD_REQUEST)

        if requested_team_id and requested_team_id != own_team_id:
            return make_response({'message': 'Unauthorized'}, HTTPStatus.FORBIDDEN)

        team_id = own_team_id
        team = team_repo.get_team_by_id(team_id)
        if not team:
            return make_response({'message': 'Team not found'}, HTTPStatus.NOT_FOUND)
    else:
        team_id = requested_team_id
        if not team_id or team_id <= 0:
            return make_response({'message': 'team_id is required'}, HTTPStatus.BAD_REQUEST)

        school_id = int(getattr(current_user, "SchoolId", 0))
        requested_school_id = request.args.get("school_id", type=int)

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

        if int(team.SchoolId) != int(school_id):
            return make_response({'message': 'Unauthorized'}, HTTPStatus.FORBIDDEN)

    latest_by_project = submission_repo.get_latest_submission_by_team(team_id)
    counts_by_project = submission_repo.get_submission_counts_by_team(team_id)
    all_projects = project_repo.get_all_projects()

    payload = []
    for project in all_projects:
        latest_submission = latest_by_project.get(project.Id)

        testcase_rows = project_repo.get_testcases(project.Id) or []
        total_testcases = len(testcase_rows)

        result_rows = load_submission_result_rows(submission_repo, latest_submission)
        passed_testcases = count_passed_testcases(result_rows)

        if total_testcases > 0:
            passed_testcases = min(passed_testcases, total_testcases)

        payload.append({
            "projectId": int(project.Id),
            "totalTestcases": int(total_testcases),
            "passedTestcases": int(passed_testcases),
            "submissionCount": int(counts_by_project.get(project.Id, 0)),
            "latestSubmissionId": int(latest_submission.Id) if latest_submission else None,
            "latestSubmittedAt": latest_submission.Time.isoformat() if latest_submission and latest_submission.Time else None,
        })

    return jsonify(payload)