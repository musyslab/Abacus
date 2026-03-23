from datetime import datetime
import json
import os
import zipfile
from io import BytesIO

from flask import Blueprint, jsonify, make_response, request, send_file
from http import HTTPStatus
from tap.parser import Parser
from flask_jwt_extended import current_user, jwt_required
from dependency_injector.wiring import inject, Provide
from openpyxl import Workbook

from container import Container
from src.constants import ADMIN_ROLE
from src.repositories.models import Testcases, StudentUsers, Teams
from src.repositories.project_repository import ProjectRepository
from src.repositories.school_repository import SchoolRepository
from src.repositories.submission_repository import SubmissionRepository
from src.repositories.team_repository import TeamRepository
from src.repositories.user_repository import UserRepository

ui_clicks_log = "/tabot-files/project-files/code_view_clicks.log"

submission_api = Blueprint('submission_api', __name__)


def convert_tap_to_json(file_path, role, current_level, hasLVLSYSEnabled):
    # New grader writes JSON directly (testcases.json). If so, pass it through.
    try:
        if str(file_path or "").lower().endswith(".json"):
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                obj = json.load(f) or {}
            return json.dumps(obj, sort_keys=True, indent=4)
    except Exception:
        # Fall back to TAP parsing below for legacy outputs
        pass

    parser = Parser()
    test = []
    final = {}

    def sanitize_yaml_block(yaml_block: dict) -> dict:
        new_yaml = (yaml_block or {}).copy()
        return new_yaml

    def parse_suite(yaml_block: dict) -> int:
        try:
            return int((yaml_block or {}).get("suite", 0))
        except (TypeError, ValueError):
            return 0

    for line in parser.parse_file(file_path):
        if line.category != "test":
            continue
        if line.yaml_block is None:
            continue

        yaml_clean = sanitize_yaml_block(line.yaml_block)

        # Levels disabled: return tests as-is
        if not hasLVLSYSEnabled:
            test.append({
                'skipped': line.skip,
                'passed': line.ok,
                'test': yaml_clean
            })
            continue

        suite_req = parse_suite(yaml_clean)

        if current_level >= suite_req:
            test.append({
                'skipped': line.skip,
                'passed': line.ok,
                'test': yaml_clean
            })
        else:
            locked_yaml = {
                "name": yaml_clean.get("name", ""),
                "description": yaml_clean.get("description", ""),
                "suite": suite_req,
                "locked": True
            }
            test.append({
                'skipped': "",
                'passed': "",
                'test': locked_yaml
            })

    final["results"] = test
    return json.dumps(final, sort_keys=True, indent=4)


@submission_api.route('/student_submit_status', methods=['GET'])
@jwt_required()
@inject
def get_student_submit_status(
    submission_repo: SubmissionRepository = Provide[Container.submission_repo],
    project_repo: ProjectRepository = Provide[Container.project_repo],
):
    if not isinstance(current_user, StudentUsers):
        return make_response({'message': 'Unauthorized'}, HTTPStatus.FORBIDDEN)

    project_id = request.args.get("project_id", type=int)
    if project_id is None or project_id <= 0:
        return make_response({'message': 'project_id is required'}, HTTPStatus.BAD_REQUEST)

    project = project_repo.get_selected_project(project_id)
    if not project:
        return make_response({'message': 'Project not found'}, HTTPStatus.NOT_FOUND)

    team_id = int(getattr(current_user, "TeamId", 0) or 0)
    if team_id <= 0:
        return make_response({'message': 'No team is associated with this account'}, HTTPStatus.BAD_REQUEST)

    remaining_seconds = submission_repo.get_team_cooldown_remaining_seconds(
        team_id,
        120,
    )

    return make_response(jsonify({
        "canSubmit": remaining_seconds <= 0,
        "cooldownRemainingSeconds": remaining_seconds,
    }), HTTPStatus.OK)


@submission_api.route('/testcaseerrors', methods=['GET'])
@jwt_required()
@inject
def get_testcase_errors(submission_repo: SubmissionRepository = Provide[Container.submission_repo]):
    submission_id_raw = request.args.get("id", type=int)
    if submission_id_raw is None:
        return make_response("Missing submission ID", HTTPStatus.BAD_REQUEST)
    submission_id = int(submission_id_raw)

    submission = submission_repo.get_submission_by_submission_id(submission_id)
    if not submission:
        return make_response("Submission not found", HTTPStatus.NOT_FOUND)

    project_id = getattr(submission, "Project", None)
    if project_id is None:
        return make_response("Submission missing project association", HTTPStatus.INTERNAL_SERVER_ERROR)

    output = convert_tap_to_json(submission.OutputFilepath, getattr(current_user, "Role", 0), 0, False)
    # Attach hidden flags from DB Testcases table (source of truth)
    try:
        obj = json.loads(output) if isinstance(output, str) else (output or {})
        results = obj.get("results", None) if isinstance(obj, dict) else None
        if isinstance(results, list) and int(project_id) != -1:
            tcs = Testcases.query.filter(Testcases.ProjectId == int(project_id)).all()
            hidden_by_name = {
                (str(getattr(tc, "Name", "") or "").strip().lower()): bool(getattr(tc, "Hidden", False))
                for tc in (tcs or [])
            }

            for r in results:
                if not isinstance(r, dict):
                    continue
                name = None
                if isinstance(r.get("name"), str):
                    name = r.get("name")
                elif isinstance(r.get("test"), dict) and isinstance(r["test"].get("name"), str):
                    name = r["test"]["name"]

                key = (str(name or "").strip().lower())
                is_hidden = hidden_by_name.get(key, False)

                # New grader/UI reads r.hidden; legacy reads r.test.hidden
                r["hidden"] = is_hidden
                if isinstance(r.get("test"), dict):
                    r["test"]["hidden"] = is_hidden

            is_admin_user = getattr(current_user, "Role", None) == ADMIN_ROLE
            if not is_admin_user:
                for r in results:
                    if not isinstance(r, dict) or not bool(r.get("hidden", False)):
                        continue

                    if "shortDiff" in r:
                        r["shortDiff"] = ""
                    if "longDiff" in r:
                        r["longDiff"] = ""
                    if "shortDiffSameAsLong" in r:
                        r["shortDiffSameAsLong"] = True

                    if isinstance(r.get("test"), dict) and "output" in r["test"]:
                        r["test"]["output"] = []                    

            output = json.dumps(obj, sort_keys=True, indent=4)
    except Exception:
        pass

    return make_response(output, HTTPStatus.OK)


@submission_api.route('/codefinder', methods=['GET'])
@jwt_required()
@inject
def codefinder(
    submission_repo: SubmissionRepository = Provide[Container.submission_repo],
    user_repo: UserRepository = Provide[Container.user_repo],
):
    submission_id_raw = request.args.get("id", type=int)
    if submission_id_raw is None:
        return make_response("Missing submission ID", HTTPStatus.BAD_REQUEST)
    submission_id = int(submission_id_raw)

    fmt = (request.args.get("format", "") or "").strip().lower()
    want_json = fmt in ("json", "view", "preview")

    if not user_repo.is_admin():
        if not submission_repo.submission_view_verification(current_user.Id, submission_id):
            return make_response("Unauthorized", HTTPStatus.FORBIDDEN)

    code_output = submission_repo.get_code_path_by_submission_id(submission_id)
    if not code_output:
        return make_response("Code output not found for submission", HTTPStatus.NOT_FOUND)

    if want_json:
        files_payload = []
        if not os.path.isdir(code_output):
            with open(code_output, 'r', encoding='utf-8', errors='replace') as f:
                files_payload.append({"name": os.path.basename(code_output), "content": f.read()})
        else:
            allowed_exts = {".py", ".java"}
            names = sorted(os.listdir(code_output), key=lambda n: (n != "Main.java", n.lower()))
            for name in names:
                full = os.path.join(code_output, name)
                if not os.path.isfile(full):
                    continue
                _, ext = os.path.splitext(name)
                if ext.lower() not in allowed_exts:
                    continue
                with open(full, 'r', encoding='utf-8', errors='replace') as f:
                    files_payload.append({"name": name, "content": f.read()})
        resp = make_response(json.dumps({"files": files_payload}), HTTPStatus.OK)
        resp.headers["Content-Type"] = "application/json; charset=utf-8"
        resp.headers["Cache-Control"] = "no-store"
        return resp

    # Download mode
    if not os.path.isdir(code_output):
        resp = send_file(
            code_output,
            as_attachment=True,
            download_name=os.path.basename(code_output),
        )
        resp.headers["Cache-Control"] = "no-store"
        resp.headers["Access-Control-Expose-Headers"] = "Content-Disposition"
        return resp

    # If it's a directory, zip all relevant source files and return the zip
    allowed_exts = {".py", ".java"}
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as z:
        names = sorted(os.listdir(code_output), key=lambda n: (n != "Main.java", n.lower()))
        for name in names:
            full = os.path.join(code_output, name)
            if not os.path.isfile(full):
                continue
            _, ext = os.path.splitext(name)
            if ext.lower() not in allowed_exts:
                continue
            z.write(full, arcname=name)
    buf.seek(0)

    zip_name = f"submission_{submission_id}.zip"
    resp = send_file(
        buf,
        mimetype="application/zip",
        as_attachment=True,
        download_name=zip_name,
    )
    resp.headers["Cache-Control"] = "no-store"
    resp.headers["Access-Control-Expose-Headers"] = "Content-Disposition"
    return resp

@submission_api.route('/log_ui', methods=['POST'])
@jwt_required()
def log_ui_click():
    data = request.get_json(silent=True) or {}
    submission_id = data.get('id', -1)
    action = str(data.get('action', '')).strip()
    started_state = data.get('started_state', None)
    switched_to = data.get('switched_to', None)

    username = getattr(current_user, 'Username', None) or 'unknown'
    role = getattr(current_user, 'Role', None) or 0

    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    log_path = ui_clicks_log
    os.makedirs(os.path.dirname(log_path), exist_ok=True)

    line = f"{ts} | user:{username} | role:{role} | submission:{submission_id} | action:{action}"
    if action == 'Diff Finder':
        line += f" | switched_to:{bool(switched_to)} | started:{bool(started_state)}"
    line += "\n"

    with open(log_path, 'a', encoding='utf-8') as f:
        f.write(line)
    return make_response({'status': 'logged'}, HTTPStatus.CREATED)

@submission_api.route('/problem-review', methods=['GET'])
@jwt_required()
@inject
def problem_review(
    submission_repo: SubmissionRepository = Provide[Container.submission_repo],
    project_repo: ProjectRepository = Provide[Container.project_repo],
    school_repo: SchoolRepository = Provide[Container.school_repo],
    team_repo: TeamRepository = Provide[Container.team_repo],
    user_repo: UserRepository = Provide[Container.user_repo],
):
    if getattr(current_user, "Role", None) != ADMIN_ROLE:
        return make_response("Not Authorized", HTTPStatus.UNAUTHORIZED)

    project_id_raw = (request.args.get("project_id") or "").strip()
    if not project_id_raw.isdigit():
        return make_response(jsonify({"message": "Invalid project_id"}), HTTPStatus.BAD_REQUEST)

    project_id = int(project_id_raw)
    project = project_repo.get_selected_project(project_id)
    if project is None:
        return make_response(jsonify({"message": "Project not found"}), HTTPStatus.NOT_FOUND)

    submissions = submission_repo.get_all_submissions_for_project(project_id) or []
    ordered_submissions = sorted(
        submissions,
        key=lambda sub: getattr(sub, "Time", None) or datetime.min,
        reverse=True,
    )

    latest_by_team = {}
    for submission in ordered_submissions:
        team_id = int(getattr(submission, "Team", 0) or 0)
        if team_id <= 0 or team_id in latest_by_team:
            continue
        latest_by_team[team_id] = submission

    teams_in_class = (
        Teams.query
        .order_by(Teams.SchoolId.asc(), Teams.TeamNumber.asc(), Teams.Id.asc())
        .all()
    )

    rows = []
    for team in teams_in_class:
        team_id = int(getattr(team, "Id", 0) or 0)
        school_id = int(getattr(team, "SchoolId", 0) or 0)
        submission = latest_by_team.get(team_id)
        submitted_at = getattr(submission, "Time", None) if submission else None
        school = school_repo.get_school_by_id(school_id) if school_id > 0 else None

        rows.append({
            "teamId": team_id,
            "schoolId": school_id,
            "submissionId": int(getattr(submission, "Id", 0) or 0) if submission else 0,
            "schoolName": str(getattr(school, "Name", "") or "Unknown School").strip(),
            "teamName": str(getattr(team, "Name", "") or f"Team {team_id}").strip(),
            "status": (
                "notsubmitted"
                if submission is None
                else ("passed" if bool(getattr(submission, "IsPassing", False)) else "failed")
            ),
            "submittedAt": submitted_at.isoformat() if submitted_at else "",
            "submittedAtLabel": submitted_at.strftime("%x %X") if submitted_at else "N/A",
        })

    rows.sort(key=lambda row: (row["schoolName"].lower(), row["teamName"].lower()))

    return make_response(jsonify({
        "projectId": project_id,
        "projectName": str(getattr(project, "Name", "") or "").strip(),
        "rows": rows,
    }), HTTPStatus.OK)


@submission_api.route('/data', methods=['GET'])
@jwt_required()
@inject
def get_submission_data(
    submission_repo: SubmissionRepository = Provide[Container.submission_repo],
    user_repo: UserRepository = Provide[Container.user_repo],
    project_repo: ProjectRepository = Provide[Container.project_repo],
    school_repo: SchoolRepository = Provide[Container.school_repo],
    team_repo: TeamRepository = Provide[Container.team_repo],
):
    submission_id_raw = request.args.get("id", type=int)
    if submission_id_raw is None:
        return make_response("Missing submission ID", HTTPStatus.BAD_REQUEST)
    submission_id = int(submission_id_raw)

    submission = submission_repo.get_submission_by_submission_id(submission_id)
    if not submission:
        return make_response("Submission not found", HTTPStatus.NOT_FOUND)

    is_admin_request = getattr(current_user, "Role", None) == ADMIN_ROLE
    user_status = user_repo.get_user_status()
    role = "admin" if is_admin_request else (user_status or "student")

    if not is_admin_request and not submission_repo.submission_view_verification(current_user.Id, submission_id):
        return make_response("Unauthorized", HTTPStatus.FORBIDDEN)

    if getattr(current_user, "Role", None) != ADMIN_ROLE and not submission_repo.submission_view_verification(current_user.Id, submission_id):
        return make_response("Unauthorized", HTTPStatus.FORBIDDEN)

    user_id = int(getattr(submission, "User", 0) or 0)
    project_id = int(getattr(submission, "Project", 0) or 0)
    team_id = int(getattr(submission, "Team", 0) or 0)

    if not user_id or not project_id or not team_id:
        return make_response(
            jsonify({"message": "Submission has missing associations"}),
            HTTPStatus.INTERNAL_SERVER_ERROR
        )

    student = user_repo.get_student_by_id(user_id)
    if not student:
        return make_response(jsonify({"message": "User associated with submission not found"}), HTTPStatus.INTERNAL_SERVER_ERROR)

    school_id = int(getattr(student, "SchoolId", 0) or 0)
    if not school_id:
        return make_response(jsonify({"message": "School associated with submission not found"}), HTTPStatus.INTERNAL_SERVER_ERROR)

    project = project_repo.get_selected_project(project_id)
    school = school_repo.get_school_by_id(school_id)
    team = team_repo.get_team_by_id(team_id)

    data = {
        "id": submission_id,
        "userId": user_id,
        "role": role,
        "project": {"id": project_id, "name": (getattr(project, "Name", "") or "").strip()},
        "school": {"id": school_id, "name": (getattr(school, "Name", "") or "").strip()},
        "team": {"id": team_id, "name": (getattr(team, "Name", "") or "").strip()},
        "memberId": getattr(student, "MemberId", None),
        "time": getattr(submission, "Time", "").strftime("%x %X") if getattr(submission, "Time", None) else "",
    }
    return make_response(jsonify(data), HTTPStatus.OK)