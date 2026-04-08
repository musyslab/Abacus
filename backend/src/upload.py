from src.repositories.team_repository import TeamRepository
from flask.json import jsonify
import json
import os
import subprocess
import os.path

from flask_jwt_extended import jwt_required
from flask_jwt_extended import current_user
from flask import Blueprint
from flask import request
from flask import make_response
from flask import current_app
from http import HTTPStatus
from datetime import datetime

from src.repositories.submission_repository import SubmissionRepository
from src.repositories.project_repository import ProjectRepository
from src.repositories.user_repository import UserRepository
from dependency_injector.wiring import inject, Provide
from container import Container

from src.constants import (
    PRACTICE_START,
    PRACTICE_END,
    COMPETITION_START,
    COMPETITION_END,
    get_minute_index,
)

upload_api = Blueprint('upload_api', __name__)

ALLOWED_EXTENSIONS = {'.py': 'python', '.java': 'java'}


def validate_files(files):
    """
    Args:
      files: list of FileStorage objects from Flask's request.files.getlist()
    Returns:
      (ok, result)
        - if ok is False: result is a Flask response (error).
        - if ok is True:  result is the detected language ("python" or "java").
    """
    language = None
    file_count = 0

    for f in files:
        filename = f.filename or ""
        _, ext = os.path.splitext(filename)
        ext = ext.lower()

        current_lang = ALLOWED_EXTENSIONS.get(ext)
        if not current_lang:
            return False, make_response({"message": f"Unsupported file type: {ext}"}, HTTPStatus.UNSUPPORTED_MEDIA_TYPE)

        if language is None:
            language = current_lang
        elif language != current_lang:
            return False, make_response({"message": "Multiple languages detected in upload"}, HTTPStatus.UNSUPPORTED_MEDIA_TYPE)

        file_count += 1

        if language == "python" and file_count > 1:
            return False, make_response({"message": "Multiple files detected for Python project"}, HTTPStatus.UNSUPPORTED_MEDIA_TYPE)

    if language is None or file_count == 0:
        return False, make_response({"message": "No valid files found in upload."}, HTTPStatus.UNSUPPORTED_MEDIA_TYPE)

    return True, language


@upload_api.route('/all_students', methods=['GET'])
@jwt_required()
@inject
def all_students(user_repo: UserRepository = Provide[Container.user_repo]):
    if not user_repo.is_admin():
        return make_response({'message': 'Access Denied'}, HTTPStatus.UNAUTHORIZED)

    users = user_repo.get_all_students()
    new_users = [
        {
            "Id": u.Id,
            "TeamId": u.TeamId,
            "MemberId": u.MemberId
        } for u in users
    ]
    return jsonify(new_users)


@upload_api.route('/', methods=['POST'])
@jwt_required()
@inject
def file_upload(
    user_repo: UserRepository = Provide[Container.user_repo],
    submission_repo: SubmissionRepository = Provide[Container.submission_repo],
    project_repo: ProjectRepository = Provide[Container.project_repo],
    team_repo: TeamRepository = Provide[Container.team_repo],
):
    user_id = request.form.get("student_id", current_user.Id, type=int)
    user_id_str = str(user_id)
    user_is_admin = user_repo.is_admin()

    project_id = request.form.get('project_id', None)
    project = project_repo.get_selected_project(int(project_id)) if project_id else None
    if project is None:
        return make_response({'message': 'No active project'}, HTTPStatus.NOT_ACCEPTABLE)

    now = datetime.now()
    if not user_is_admin:
        if project.Type == "competition":
            if now < COMPETITION_START:
                return make_response({'message': 'Competition has not started yet.'}, HTTPStatus.FORBIDDEN)
            elif now > COMPETITION_END:
                return make_response({'message': 'Competition has ended. Submissions are closed.'}, HTTPStatus.FORBIDDEN)
        elif project.Type == "practice":
            if now < PRACTICE_START:
                return make_response({'message': 'Practice has not started yet.'}, HTTPStatus.FORBIDDEN)
            elif now > PRACTICE_END:
                return make_response({'message': 'Practice has ended. Submissions are closed.'}, HTTPStatus.FORBIDDEN)
        else:
            return make_response({'message': 'Invalid project type.'}, HTTPStatus.INTERNAL_SERVER_ERROR)

    team_id = user_repo.get_team_id_for_student(user_id)
    if team_id is None:
        return make_response({'message': 'Student is not assigned to a team.'}, HTTPStatus.NOT_ACCEPTABLE)

    if not user_is_admin:
        remaining_seconds = submission_repo.get_team_cooldown_remaining_seconds(
            int(team_id),
            120,
        )
        if remaining_seconds > 0:
            return make_response({
                'message': 'Please wait 2 minutes between submissions.',
                'remainingSeconds': remaining_seconds,
            }, HTTPStatus.TOO_MANY_REQUESTS)

    upload_files = request.files.getlist('files')
    upload_files = [f for f in upload_files if f and f.filename]
    if not upload_files:
        message = {'message': 'No selected file'}
        return make_response(message, HTTPStatus.BAD_REQUEST)

    ok, result = validate_files(upload_files)
    if not ok:
        return result
    language = result

    student_base = current_app.config['STUDENT_FILES_DIR']

    # student-files/<projecttimestamp__projectname>/<userId>/<submissiontimestamp>/...
    teacher_proj_dir = os.path.dirname(project.solutionpath)
    teacher_folder_name = os.path.basename(teacher_proj_dir)
    project_bucket = os.path.join(student_base, teacher_folder_name)

    user_bucket = os.path.join(project_bucket, user_id_str)
    os.makedirs(user_bucket, exist_ok=True)

    ts_now = datetime.now()
    ts_stamp = ts_now.strftime("%Y%m%d_%H%M%S")
    dt_string = ts_now.strftime("%Y/%m/%d %H:%M:%S")

    outputpath = project_bucket
    submission_dir = os.path.join(user_bucket, ts_stamp)
    os.makedirs(submission_dir, exist_ok=True)

    for f in upload_files:
        base = os.path.basename(f.filename or "")
        stem, extn = os.path.splitext(base)

        safe_stem = "".join(
            c if (c.isalnum() or c in "-_") else "_"
            for c in (stem or "").strip()
        )
        safe_filename = f"{safe_stem}{extn.lower()}"

        dst = os.path.join(submission_dir, safe_filename)
        f.save(dst)

    path = submission_dir

    testcase_info_json = project_repo.testcases_to_json(project.Id)

    grading_script = "/tabot-files/grading-scripts/grade.py"
    project_id_arg = str(project.Id)

    add_payload = ""
    try:
        sol_root = getattr(project, "solutionpath", "") or ""
        teacher_base_dir = sol_root if os.path.isdir(sol_root) else os.path.dirname(sol_root)

        raw = (getattr(project, "AdditionalFilePath", "") or "").strip()
        if raw.startswith("[") or raw.startswith("{"):
            lst = json.loads(raw)
        else:
            lst = [raw] if raw else []

        abs_list = []
        for p in (lst or []):
            if not p:
                continue
            if os.path.isabs(p):
                abs_list.append(p)
            else:
                abs_list.append(os.path.join(teacher_base_dir, os.path.basename(p)))

        add_payload = json.dumps({"base_dir": teacher_base_dir, "files": abs_list})
    except Exception:
        add_payload = ""

    cmd = [
        "python", grading_script,
        user_id_str,
        language,
        str(testcase_info_json),
        path,
        add_payload,
        project_id_arg
    ]
    result = subprocess.run(cmd, cwd=outputpath)

    if result.returncode != 0:
        message = {
            'message': 'Error in running grading script!'
        }
        return make_response(message, HTTPStatus.INTERNAL_SERVER_ERROR)

    json_out = os.path.join(submission_dir, "testcases.json")
    if not os.path.exists(json_out):
        alt = os.path.join(submission_dir, f"{user_id_str}.json")
        if os.path.exists(alt):
            json_out = alt

    status = False
    TestCaseResults = {"Passed": [], "Failed": []}
    try:
        with open(json_out, "r", encoding="utf-8", errors="replace") as f:
            payload = json.load(f) or {}

        passed, failed = [], []
        for r in (payload or {}).get("results", []):
            name = str((r or {}).get("name", "") or "")
            if bool((r or {}).get("passed", False)):
                passed.append(name)
            else:
                failed.append(name)

        status = (len(failed) == 0)
        TestCaseResults = {"Passed": passed, "Failed": failed}
    except Exception:
        pass

    submissionId = submission_repo.create_submission(
        team_id=team_id,
        user_id=user_id,
        output=json_out,
        codepath=submission_dir,
        time=dt_string,
        project_id=project.Id,
        status=status,
        testcase_results=TestCaseResults,
    )

    difference = None
    if status:
        if project.Type == "competition":
            difference = get_minute_index(start=COMPETITION_START, now=ts_now)
        elif project.Type == "practice":
            difference = get_minute_index(start=PRACTICE_START, now=ts_now)

    if submission_repo.is_first_submission_for_team_and_project(team_id, project.Id):
        team_repo.create_team_project_stats_entry(
            team_id=team_id,
            project_id=project.Id,
            solved=status,
            accepted_time_minutes=difference if status else None,
            current_submission_id=submissionId,
        )
    else:
        team_repo.update_team_project_stats_entry(
            team_id=team_id,
            project_id=project.Id,
            solved=status,
            accepted_time_minutes=difference if status else None,
            current_submission_id=submissionId,
        )

    message = {
        'message': 'Success',
        'remainder': 120,
        'cooldownRemainingSeconds': 120,
        "sid": submissionId,
    }

    return make_response(message, HTTPStatus.OK)