from flask.json import jsonify
import json
import os
import subprocess
import os.path
from typing import List
from subprocess import Popen

from flask_jwt_extended import jwt_required
from flask_jwt_extended import current_user
from flask import Blueprint
from flask import request
from flask import make_response
from flask import current_app
from http import HTTPStatus
from datetime import datetime
from flask_cors import cross_origin
from src.repositories.submission_repository import SubmissionRepository
from src.repositories.project_repository import ProjectRepository
from src.repositories.user_repository import UserRepository
from src.repositories.school_repository import SchoolRepository
from src.services.timeout_service import on_timeout
from tap.parser import Parser
from dependency_injector.wiring import inject, Provide
from container import Container
from src.constants import ADMIN_ROLE

upload_api = Blueprint('upload_api', __name__)

ALLOWED_EXTENSIONS = {'.py' : 'python', '.java': 'java'}

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
):
    """[summary]

    Args:
        submission_repository (ASubmissionRepository): [the existing submissions directory and all the functions in it]
        project_repository (AProjectRepository): [the existing projects directory and all the functions in it]

    Returns:
        [HTTP]: [a pass or fail HTTP message]
    """

    user_id = request.form.get("student_id", current_user.Id, type=int)
    user_id_str = str(user_id)

    project_id = request.form.get('project_id', None)
    project = project_repo.get_selected_project(int(project_id)) if project_id else None
    if project is None:
        return make_response({'message': 'No active project'}, HTTPStatus.NOT_ACCEPTABLE)

    team_id = user_repo.get_team_id_for_student(user_id)
    if team_id is None:
        return make_response({'message': 'Student is not assigned to a team.'}, HTTPStatus.NOT_ACCEPTABLE)

    # Check to see if team is able to upload or still on timeout

    # Accept multi-file field ("files")
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

    # Per-submission timestamp for filenames
    ts_now = datetime.now()
    ts_stamp = ts_now.strftime("%Y%m%d_%H%M%S")
    dt_string = ts_now.strftime("%Y/%m/%d %H:%M:%S")

    # Step 1: Save student upload(s) into a submission directory (language-independent layout)
    outputpath = project_bucket
    submission_dir = os.path.join(user_bucket, ts_stamp)
    os.makedirs(submission_dir, exist_ok=True)

    for f in upload_files:
        # Inline replacement for _safe_upload_filename(f.filename)
        base = os.path.basename(f.filename or "")
        stem, extn = os.path.splitext(base)

        safe_stem = "".join(
            c if (c.isalnum() or c in "-_") else "_"
            for c in (stem or "").strip()
        )
        safe_filename = f"{safe_stem}{extn.lower()}"

        dst = os.path.join(submission_dir, safe_filename)
        f.save(dst)

    # Always pass the submission directory to the grader (single or multi-file)
    path = submission_dir

    # Step 2: Run grade.py
    testcase_info_json = project_repo.testcases_to_json(project.Id)

    grading_script = "/tabot-files/grading-scripts/grade.py"
    project_id_arg = str(project.Id)

    # Include teacher-provided "additional files" in the Judge0 sandbox for student runs.
    # DB stores basenames (or JSON list). Resolve them to absolute paths under the teacher solution folder.
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

        # Pass both base_dir (for resolving testcase-level basenames) and project files list
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

    # Step 3: Read grader JSON output from:
    # student-files/<project>/<userId>/<submissiontimestamp>/testcases.json
    json_out = os.path.join(submission_dir, "testcases.json")
    if not os.path.exists(json_out):
        # Back-compat with older output naming
        alt = os.path.join(submission_dir, f"{user_id_str}.json")
        if os.path.exists(alt):
            json_out = alt

    status = False
    TestCaseResults = {"Passed": [], "Failed": []}
    try:
        # Inline replacement for _load_grader_json and _status_and_buckets
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

    message = {
        'message': 'Success',
        'remainder': 10,
        "sid": submissionId,
    }

    return make_response(message, HTTPStatus.OK)