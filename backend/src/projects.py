import ast
from collections import defaultdict
from io import BytesIO
import json
import os
import re
import shutil
import subprocess
import os.path
from typing import List
import zipfile
import stat
import sys

import requests

from subprocess import Popen
from src.repositories.user_repository import UserRepository
from src.repositories.submission_repository import SubmissionRepository
from flask import Blueprint, Response, send_file, current_app
from flask import make_response
from http import HTTPStatus
from injector import inject
from flask_jwt_extended import jwt_required
from flask_jwt_extended import current_user
from src.repositories.project_repository import ProjectRepository
from src.repositories.models import AdminUsers, StudentUsers, Teams, Submissions, Projects
from src.repositories.database import db
from src.services.dataService import all_submissions 
from src.models.ProjectJson import ProjectJson
from src.constants import (
     ADMIN_ROLE,
     get_competition_schedule,
     is_student_submission_locked,
     is_teacher_submission_locked,
)
from flask import jsonify
from flask import request
from dependency_injector.wiring import inject, Provide
from container import Container
from datetime import datetime
import itertools
import importlib.util
from werkzeug.utils import secure_filename
from urllib.parse import quote

projects_api = Blueprint('projects_api', __name__)

ALLOWED_SOURCE_EXTS = {'.py', '.c', '.java', '.rkt'}
TS_DIR_RE = re.compile(r"^\d{8}_\d{6}$")
PROJECT_TYPES = {'competition', 'practice', 'none'}
PROJECT_DIVISIONS = {'blue', 'gold'}

def project_root() -> str:
    return "/tabot-files/project-files"

def teacher_root() -> str:
    return os.path.join(project_root(), "teacher-files")

def student_root() -> str:
    return os.path.join(project_root(), "student-files")

def project_dir(base_proj: str, ts: str) -> str:
    # teacher-files/<YYYYMMDD_HHMMSS>__<projectname>
    return os.path.join(teacher_root(), f"{ts}__{base_proj}")

def is_ts_dir(name: str) -> bool:
    return bool(TS_DIR_RE.match(name or ""))

def version_dir(proj_dir_path: str, ts: str) -> str:
    # teacher-files/<projecttimestamp__projectname>/<submissiontimestamp>/
    return os.path.join(proj_dir_path, ts)

def pick_latest_version_dir(proj_dir_path: str) -> str | None:
    try:
        kids = [d for d in os.listdir(proj_dir_path) if is_ts_dir(d) and os.path.isdir(os.path.join(proj_dir_path, d))]
        if kids:
            return os.path.join(proj_dir_path, max(kids))
    except Exception:
        pass
    return None

def normalize_division(v: str | None) -> str:
    raw = (v or "").strip().lower()
    return raw if raw in PROJECT_DIVISIONS else "blue"

def get_next_order_index_for_division(project_type: str, division: str, exclude_project_id: int | None = None) -> int | None:
    if project_type not in {"competition", "practice"}:
        return None

    query = Projects.query.filter(
        Projects.Type == project_type,
        Projects.Division == division,
    )

    if exclude_project_id is not None:
        query = query.filter(Projects.Id != exclude_project_id)

    existing = query.order_by(
        Projects.OrderIndex.is_(None),
        Projects.OrderIndex.desc(),
    ).all()
    max_limit = 10 if project_type == "competition" else None

    count = len(existing)
    if max_limit is not None and count >= max_limit:
        return None

    max_order = 0
    for proj in existing:
        val = int(getattr(proj, "OrderIndex", 0) or 0)
        if val > max_order:
            max_order = val

    return max_order + 1

def seed_version_dir(dest_dir: str, *, seed_from_dir: str | None, seed_solution_path: str | None, seed_desc_path: str | None, seed_add_paths: list[str]):
    os.makedirs(dest_dir, exist_ok=True)
    # Prefer copying an existing version directory (new layout)
    if seed_from_dir and os.path.isdir(seed_from_dir):
        shutil.copytree(seed_from_dir, dest_dir, dirs_exist_ok=True)
        return
    # Legacy seeding: copy solution file/dir sources
    if seed_solution_path and os.path.exists(seed_solution_path):
        if os.path.isdir(seed_solution_path):
            for fn in os.listdir(seed_solution_path):
                src = os.path.join(seed_solution_path, fn)
                if os.path.isfile(src) and os.path.splitext(fn)[1].lower() in (ALLOWED_SOURCE_EXTS | {".h", ".hpp", ".cpp"}):
                    shutil.copy2(src, os.path.join(dest_dir, fn))
        else:
            shutil.copy2(seed_solution_path, os.path.join(dest_dir, os.path.basename(seed_solution_path)))
    # Copy assignment description
    if seed_desc_path and os.path.isfile(seed_desc_path):
        shutil.copy2(seed_desc_path, os.path.join(dest_dir, os.path.basename(seed_desc_path)))
    # Copy additional files
    for p in (seed_add_paths or []):
        if p and os.path.isfile(p):
            shutil.copy2(p, os.path.join(dest_dir, os.path.basename(p)))

def ts_str() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")
    
def safe_name(s: str) -> str:
    return secure_filename(s or "").replace(" ", "_")

def can_access_assignment_descriptions() -> bool:
    if isinstance(current_user, AdminUsers):
        return (
            int(getattr(current_user, "Role", 0) or 0) == ADMIN_ROLE
            or not is_teacher_submission_locked()
        )

    if isinstance(current_user, StudentUsers):
        return not is_student_submission_locked()

    return False

def get_visible_team_ids_for_project_summary() -> list[int]:
    if isinstance(current_user, AdminUsers):
        if int(getattr(current_user, "Role", 0) or 0) == ADMIN_ROLE:
            teams = Teams.query.order_by(Teams.Id.asc()).all()
        else:
            school_id = int(getattr(current_user, "SchoolId", 0) or 0)
            teams = (
                Teams.query
                .filter(Teams.SchoolId == school_id)
                .order_by(Teams.Id.asc())
                .all()
            )
        return [int(team.Id) for team in teams]

    if isinstance(current_user, StudentUsers):
        team_id = int(getattr(current_user, "TeamId", 0) or 0)
        return [team_id] if team_id > 0 else []

    return []

def build_project_review_counts(projects, visible_team_ids: list[int]) -> dict[int, dict[str, int]]:
    project_ids = [int(proj.Id) for proj in (projects or [])]
    total_visible_teams = len(visible_team_ids)

    counts_by_project: dict[int, dict[str, int]] = {
        pid: {
            "NotSubmittedCount": total_visible_teams,
            "SubmittedAtLeastOnceCount": 0,
            "PassingAllTestcasesCount": 0,
        }
        for pid in project_ids
    }

    if not project_ids or not visible_team_ids:
        return counts_by_project

    latest_seen: set[tuple[int, int]] = set()
    latest_submissions = (
        Submissions.query
        .filter(
            Submissions.Project.in_(project_ids),
            Submissions.Team.in_(visible_team_ids),
        )
        .order_by(
            Submissions.Project.asc(),
            Submissions.Team.asc(),
            Submissions.Time.desc(),
            Submissions.Id.desc(),
        )
        .all()
    )

    for submission in latest_submissions:
        project_id = int(getattr(submission, "Project", 0) or 0)
        team_id = int(getattr(submission, "Team", 0) or 0)
        key = (project_id, team_id)

        if key in latest_seen:
            continue
        latest_seen.add(key)

        project_counts = counts_by_project.get(project_id)
        if not project_counts:
            continue

        project_counts["SubmittedAtLeastOnceCount"] += 1

        if bool(getattr(submission, "IsPassing", False)):
            project_counts["PassingAllTestcasesCount"] += 1

    for project_counts in counts_by_project.values():
        project_counts["NotSubmittedCount"] = max(
            0,
            total_visible_teams - project_counts["SubmittedAtLeastOnceCount"],
        )

    return counts_by_project

@projects_api.route('/all_projects', methods=['GET'])
@jwt_required()
@inject
def all_projects(project_repo: ProjectRepository = Provide[Container.project_repo], submission_repo: SubmissionRepository = Provide[Container.submission_repo], user_repo: UserRepository = Provide[Container.user_repo]):
    if not isinstance(current_user, (AdminUsers, StudentUsers)):
        return make_response({'message': 'Access Denied'}, HTTPStatus.UNAUTHORIZED)

    division_filter = normalize_division(request.args.get("division"))

    data = project_repo.get_all_projects()
    data = [
        proj for proj in data
        if normalize_division(getattr(proj, "Division", "blue")) == division_filter
    ]

    thisdic = submission_repo.get_total_submission_for_all_projects()
    visible_team_ids = get_visible_team_ids_for_project_summary()
    review_counts = build_project_review_counts(data, visible_team_ids)
    
    new_projects = [
        {
            "Id": proj.Id,
            "Name": proj.Name,
            "Type": proj.Type,
            "Division": normalize_division(getattr(proj, "Division", "blue")),
            "DescriptionText": getattr(proj, "DescriptionText", None),
            "OrderIndex": proj.OrderIndex,
            "TotalSubmissions": thisdic.get(proj.Id, 0),
            "NotSubmittedCount": review_counts.get(proj.Id, {}).get("NotSubmittedCount", 0),
            "SubmittedAtLeastOnceCount": review_counts.get(proj.Id, {}).get("SubmittedAtLeastOnceCount", 0),
            "PassingAllTestcasesCount": review_counts.get(proj.Id, {}).get("PassingAllTestcasesCount", 0),
        } for proj in data
    ]
    return jsonify(new_projects)

@projects_api.route('/competition_schedule', methods=['GET'])
def competition_schedule():
    return jsonify(get_competition_schedule())

@projects_api.route('/list_solution_files', methods=['GET'])
@jwt_required()
@inject
def list_solution_files(project_repo: ProjectRepository = Provide[Container.project_repo], user_repo: UserRepository = Provide[Container.user_repo]):
    if not user_repo.is_admin():
        return make_response({'message': 'Access Denied'}, HTTPStatus.UNAUTHORIZED)

    pid_str = (request.args.get("id", "") or "").strip()
    if not pid_str.isdigit():
        return make_response([], HTTPStatus.OK)
    pid = int(pid_str)

    p = project_repo.get_project_path(pid)
    if not p:
        return make_response([], HTTPStatus.OK)

    try:
        if os.path.isdir(p):
            names = []
            for fn in sorted(os.listdir(p)):
                full = os.path.join(p, fn)
                if os.path.isfile(full):
                    _, ext = os.path.splitext(fn)
                    if ext.lower() in ALLOWED_SOURCE_EXTS:
                        names.append(fn)
            return make_response(names, HTTPStatus.OK)
        return make_response([os.path.basename(p)], HTTPStatus.OK)
    except Exception:
        return make_response([], HTTPStatus.OK)

@projects_api.route('/create_project', methods=['POST'])
@jwt_required()
@inject
def create_project(project_repo: ProjectRepository = Provide[Container.project_repo], user_repo: UserRepository = Provide[Container.user_repo]):
    if not user_repo.is_admin():
        return make_response({'message': 'Access Denied'}, HTTPStatus.UNAUTHORIZED)

    name = request.form.get('name', '').strip()
    language = request.form.get('language', '').strip()
    project_type = request.form.get('project_type', '').strip()
    division = normalize_division(request.form.get('division'))

    if name == '' or project_type not in PROJECT_TYPES:
        return make_response("Error in form", HTTPStatus.BAD_REQUEST)

    if division == 'gold':
        language = language or 'none'
        if 'assignmentdesc' not in request.files or not request.files['assignmentdesc'].filename:
            return make_response({'message': 'Gold Division problems require a description file.'}, HTTPStatus.BAD_REQUEST)
    else:
        solution_uploads = request.files.getlist('solutionFiles')
        solution_uploads = [f for f in solution_uploads if f and f.filename]
        if not solution_uploads:
            return make_response({'message': 'No selected solution files'}, HTTPStatus.BAD_REQUEST)
        if 'assignmentdesc' not in request.files or not request.files['assignmentdesc'].filename:
            return make_response({'message': 'No assignment description file'}, HTTPStatus.BAD_REQUEST)
        if language == '':
            return make_response("Error in form", HTTPStatus.BAD_REQUEST)

    base_proj = safe_name(name)
    ts = ts_str()
    proj_dir_path = project_dir(base_proj, ts)
    os.makedirs(proj_dir_path, exist_ok=True)

    path = ""
    assignmentdesc_path = ""
    add_names = []

    if division == 'blue' or division == 'gold':
        path = version_dir(proj_dir_path, ts)
        os.makedirs(path, exist_ok=True)

        if division == 'blue':
            solution_uploads = request.files.getlist('solutionFiles')
            solution_uploads = [f for f in solution_uploads if f and f.filename]

            for up in solution_uploads:
                orig = safe_name(up.filename)
                ext = os.path.splitext(orig)[1].lower()
                if ext not in ALLOWED_SOURCE_EXTS:
                    return make_response({'message': f'Unsupported file type: {ext}'}, HTTPStatus.BAD_REQUEST)
                dst = os.path.join(path, orig)
                up.save(dst)

            for add_up in request.files.getlist('additionalFiles'):
                if add_up and add_up.filename:
                    orig_name = safe_name(add_up.filename)
                    dst = os.path.join(path, orig_name)
                    add_up.save(dst)
                    add_names.append(orig_name)

        ad = request.files['assignmentdesc']
        ad_name = safe_name(ad.filename or "assignment.pdf")
        assignmentdesc_path = os.path.join(path, ad_name)
        ad.save(assignmentdesc_path)

    # Find order index for ordered project types
    order_index = None
    if project_type in {"competition", "practice"}:
        order_index = get_next_order_index_for_division(project_type, division)
        if order_index is None:
            return make_response({'message': 'Maximum number of projects reached for this division/type'}, HTTPStatus.BAD_REQUEST)

    new_project_id = project_repo.create_project(
        name,
        language,
        project_type,
        order_index,
        path,
        assignmentdesc_path,
        json.dumps(add_names),
    )

    created = Projects.query.get(int(new_project_id))
    if created:
        created.Division = division
        created.DescriptionText = None
        db.session.commit()

    return make_response(str(new_project_id), HTTPStatus.OK)

@projects_api.route('/edit_project', methods=['POST'])
@jwt_required()
@inject
def edit_project(project_repo: ProjectRepository = Provide[Container.project_repo], user_repo: UserRepository = Provide[Container.user_repo]):
    if not user_repo.is_admin():
        return make_response({'message': 'Access Denied'}, HTTPStatus.UNAUTHORIZED)

    pid_str = request.form.get("id", "").strip()
    if not pid_str.isdigit():
        return make_response({'message': 'Invalid or missing project id'}, HTTPStatus.BAD_REQUEST)
    pid = int(pid_str)

    name = request.form.get('name', '')
    language = request.form.get('language', '')
    project_type = request.form.get('project_type', '').strip().lower()
    division = normalize_division(request.form.get('division'))
    
    if name == '' or project_type not in PROJECT_TYPES:
        return make_response({'message': 'Error in form'}, HTTPStatus.BAD_REQUEST)
    
    existing_proj = project_repo.get_selected_project(pid)
    current_division = normalize_division(getattr(existing_proj, "Division", "blue") if existing_proj else "blue")
    if division == "":
        division = current_division

    # Computes order_index for ordered project types
    if project_type in {"competition", "practice"}:
        current_type = (getattr(existing_proj, "Type", "") or "").strip().lower()
        current_index = project_repo.get_project_order_index(pid) if pid else None
        same_bucket = (
            current_type == project_type and
            normalize_division(getattr(existing_proj, "Division", "blue")) == division and
            current_index is not None
        )
        order_index = (
            current_index
            if same_bucket
            else get_next_order_index_for_division(project_type, division, exclude_project_id=pid)
        )

        if order_index is None:
            return make_response({'message': 'Maximum number of projects reached for this division/type'}, HTTPStatus.BAD_REQUEST)
    else:
        order_index = None

    # Ensure base_proj exists before any use (fix NameError) and compute project folder
    base_proj = safe_name(name)
    ts = ts_str()
    existing_path = project_repo.get_project_path(pid)
    if existing_path:
        # In the new layout, existing_path is a version directory:
        # teacher-files/<proj_ts>__<base_proj>/<version_ts>
        proj_dir = os.path.dirname(existing_path)
        # Derive base_proj from folder name if not set: "<timestamp>__<base_proj>"
        if not base_proj:
            folder = os.path.basename(proj_dir)
            if "__" in folder:
                base_proj = folder.split("__", 1)[1]
            else:
                base_proj = safe_name(name)
    else:
        proj_dir = project_dir(base_proj, ts)
    os.makedirs(proj_dir, exist_ok=True)

    # Default to existing paths if no new files are uploaded
    path = existing_path or ""
    assignmentdesc_path = project_repo.get_project_desc_path(pid) or ""

    if division == 'gold':
        language = language or getattr(existing_proj, "Language", "none") or "none"
        ad = request.files.get('assignmentdesc')
        if not (assignmentdesc_path or (ad and ad.filename)):
            return make_response({'message': 'Gold Division problems require a description file.'}, HTTPStatus.BAD_REQUEST)

        if ad and ad.filename:
            if not path:
                path = version_dir(proj_dir, ts)
                os.makedirs(path, exist_ok=True)
            ad_name = safe_name(ad.filename or "assignment.pdf")
            assignmentdesc_path = os.path.join(path, ad_name)
            ad.save(assignmentdesc_path)

        project_repo.edit_project(name, language, project_type, order_index, pid, path, assignmentdesc_path, json.dumps([]))

        proj_row = Projects.query.get(pid)
        if proj_row:
            proj_row.Division = division
            proj_row.DescriptionText = None
            db.session.commit()

        return make_response("Project Edited", HTTPStatus.OK)

    if language == '':
        return make_response({'message': 'Error in form'}, HTTPStatus.BAD_REQUEST)

    # Determine whether we need to mint a new version directory
    solution_uploads = request.files.getlist('solutionFiles')
    solution_uploads = [f for f in solution_uploads if f and f.filename]
    solution_changed = False
    ad = request.files.get('assignmentdesc')
    desc_changed = bool(ad and ad.filename)
    remove_add = request.form.get('removeAdditionalFiles', '').strip()
    clear_add = (request.form.get('clearAdditionalFiles', '').strip().lower() == 'true')
    new_add_uploads = [f for f in request.files.getlist('additionalFiles') if f and f.filename]
    try:
        to_remove = json.loads(remove_add) if remove_add else []
    except Exception:
        to_remove = []
    additional_ops = bool(clear_add or to_remove or new_add_uploads)
    needs_new_version = bool(solution_uploads or desc_changed or additional_ops)

    # Seed a new version folder so history is preserved and teacher layout is consistent
    current_version_dir = existing_path if (existing_path and os.path.isdir(existing_path) and is_ts_dir(os.path.basename(existing_path))) else None
    if needs_new_version:
        new_version = version_dir(proj_dir, ts)
        # Seed from current version directory when available; otherwise seed from legacy paths
        try:
            seed_add_paths = []
            existing_add = getattr(existing_proj, "AdditionalFilePath", "") if existing_proj else ""
            existing_list = json.loads(existing_add) if (existing_add or "").startswith('[') else ([existing_add] if existing_add else [])
            # existing_list may be basenames or absolute paths. Resolve for seeding when not using seed_from_dir.
            legacy_base = None
            if existing_path:
                legacy_base = existing_path if os.path.isdir(existing_path) else os.path.dirname(existing_path)
            legacy_base = legacy_base or proj_dir
            for p in (existing_list or []):
                if not p:
                    continue
                if os.path.isabs(p):
                    seed_add_paths.append(p)
                else:
                    seed_add_paths.append(os.path.join(legacy_base, os.path.basename(p)))
        except Exception:
            seed_add_paths = []
        seed_version_dir(
            new_version,
            seed_from_dir=current_version_dir,
            seed_solution_path=existing_path,
            seed_desc_path=assignmentdesc_path,
            seed_add_paths=seed_add_paths,
        )
        path = new_version
        # After seeding, rewrite assignmentdesc_path into this version folder if it existed
        if assignmentdesc_path:
            bn = os.path.basename(assignmentdesc_path)
            cand = os.path.join(path, bn)
            if os.path.exists(cand):
                assignmentdesc_path = cand

    # If new solution file(s) were uploaded, replace solution sources inside the current version folder
    if solution_uploads:
        # Remove old source files only in this (new) version directory
        try:
            for fn in os.listdir(path):
                full = os.path.join(path, fn)
                if os.path.isfile(full) and os.path.splitext(fn)[1].lower() in ALLOWED_SOURCE_EXTS:
                    os.remove(full)
        except Exception:
            pass
        for up in solution_uploads:
            orig = safe_name(up.filename)
            ext = os.path.splitext(orig)[1].lower()
            if ext not in ALLOWED_SOURCE_EXTS:
                return make_response({'message': f'Unsupported file type: {ext}'}, HTTPStatus.BAD_REQUEST)
            dst = os.path.join(path, orig)
            up.save(dst)
        solution_changed = True

    # If a new assignment description was uploaded, save into the version folder
    ad = request.files.get('assignmentdesc')
    if ad and ad.filename:
        ad_name = safe_name(ad.filename or "assignment.pdf")
        assignmentdesc_path = os.path.join(path, ad_name)
        ad.save(assignmentdesc_path)

    # Multiple additional files: store only basenames in DB; operate on files inside `path`.
    existing_add = getattr(existing_proj, "AdditionalFilePath", "") if existing_proj else ""
    try:
        add_names = json.loads(existing_add) if (existing_add or "").startswith('[') else ([existing_add] if existing_add else [])
    except Exception:
        add_names = []
    add_names = [os.path.basename(p) for p in (add_names or []) if p]
    # If we minted a new version dir, keep only names that exist in the new folder.
    if needs_new_version:
        add_names = [n for n in add_names if os.path.exists(os.path.join(path, n))]
    additional_file_changed = False
    # Remove selected files (match by basename)
    if to_remove:
        keep = []
        for n in add_names:
            if n in to_remove:
                try:
                    os.remove(os.path.join(path, n))
                except Exception:
                    pass
                additional_file_changed = True
            else:
                keep.append(n)
        add_names = keep
    # Clear all
    if clear_add and add_names:
        for n in add_names:
            try:
                os.remove(os.path.join(path, n))
            except Exception:
                pass
        additional_file_changed = True
    # Append newly uploaded additional files
    for add_up in new_add_uploads:
        if add_up and add_up.filename:
            orig_name = safe_name(add_up.filename)
            dst = os.path.join(path, orig_name)
            add_up.save(dst)
            add_names.append(orig_name)
            additional_file_changed = True

    # Always point the project at the newest version directory when available
    latest_version = pick_latest_version_dir(proj_dir)
    if latest_version:
        path = latest_version

    project_repo.edit_project(name, language, project_type, order_index, pid, path, assignmentdesc_path, json.dumps(add_names))

    proj_row = Projects.query.get(pid)
    if proj_row:
        proj_row.Division = division
        proj_row.DescriptionText = None
        db.session.commit()

    # Recompute testcase outputs **against the path we just wrote**, so we don't depend on
    # any cached ORM objects or delayed reads.
    try:
        # Recompute if either the solution OR the additional file changed.
        # If only the additional file changed, let recompute pick up the project's saved solution.
        if solution_changed or additional_file_changed:
            recompute_expected_outputs(
                project_repo,
                int(pid),
                solution_override_path=(path if solution_changed else None),
                language_override=language,
            )
    except Exception as e:
        # Don't block the edit on recompute failures, but surface why outputs didn't refresh.
        import traceback
        print(f"[edit_project] recompute_expected_outputs failed: {e}", flush=True)
        traceback.print_exc()

    return make_response("Project Edited", HTTPStatus.OK)

def has_allowed_ext(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in ALLOWED_SOURCE_EXTS

def run_solution_for_input(solution_root: str, language: str, input_text: str, project_id: int, additional_file_path: str = "") -> str:
    """
    Execute code strictly via /tabot-files/grading-scripts/grade.py (ADMIN path).
    Returns stdout (or stderr) with normalized newlines, or "" on failure.
    """
    if not solution_root or not os.path.exists(solution_root):
        return ""
    script = "/tabot-files/grading-scripts/grade.py"

    # Expand DB-stored additional file names to absolute paths under solution_root.
    add_arg = additional_file_path or ""
    try:
        base_dir = solution_root if os.path.isdir(solution_root) else os.path.dirname(solution_root)
        raw = add_arg.strip() if isinstance(add_arg, str) else ""
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
                abs_list.append(os.path.join(base_dir, os.path.basename(p)))
        add_arg = json.dumps(abs_list)
    except Exception:
        add_arg = additional_file_path or ""

    args = [
        "python", script,
        "ADMIN",              # student_name triggers admin path
        language or "python", # language as tabot expects
        input_text or "",     # goes to admin_run(user_input)
        solution_root,        # file or directory
        add_arg,
        str(project_id or 0),
    ]
    try:
        proc = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, cwd=os.path.dirname(solution_root) if os.path.isfile(solution_root) else solution_root)
    except Exception:
        return ""
    out = (proc.stdout or "").strip()
    err = (proc.stderr or "").strip()
    return (out or err)

def load_tabot_module():
    """
    Try to import tabot as a normal module first.
    If that fails, load it from /ta-bot/grading-scripts and make sure
    its directory is on sys.path so sibling imports (output, tests)
    resolve correctly.
    """
    try:
        import tabot as _t
        return _t
    except Exception:
        pass

    grading_dir = "/tabot-files/grading-scripts"
    grading_path = os.path.join(grading_dir, "grade.py")

    spec = importlib.util.spec_from_file_location("tabot-files", grading_path)
    if not spec or not spec.loader:
        raise ImportError(f"Cannot load spec for {grading_path}")

    # Ensure sibling imports like `from output import *` work
    sys.path.insert(0, grading_dir)
    try:
        mod = importlib.util.module_from_spec(spec)
        sys.modules["tabot"] = mod  # let subimports see the module name
        # Optional but helps some relative-import edge cases:
        mod.__package__ = None
        spec.loader.exec_module(mod)
        return mod
    finally:
        # Avoid permanently polluting sys.path
        try:
            sys.path.remove(grading_dir)
        except ValueError:
            pass

try:
    TABOT = load_tabot_module()
except Exception as e:
    TABOT = None
    print(f"[projects] Warning: tabot import failed (will use subprocess path): {e}", flush=True)

def recompute_expected_outputs(project_repo, project_id, *, solution_override_path: str = None, language_override: str = None):    
    
    """
    For each testcase, run the (updated) solution and persist the new output.
    """

    # Always fetch the project once (needed for class id, fallback language, etc.)
    try:
        proj_obj = project_repo.get_selected_project(int(project_id))
    except Exception:
        proj_obj = None

    if solution_override_path and os.path.exists(solution_override_path):
        solution_root = solution_override_path
        lang = (language_override or (getattr(proj_obj, "Language", "") if proj_obj else "")).strip()
    else:
        if not proj_obj or not getattr(proj_obj, "solutionpath", None):
            return
        solution_root = getattr(proj_obj, "solutionpath", "")
        lang = getattr(proj_obj, "Language", "")

    cases = project_repo.get_testcases(str(project_id))

    for tc_id, vals in cases.items():
        add_path = getattr(proj_obj, "AdditionalFilePath", "") if proj_obj else ""
        try:
            name = vals[1] if len(vals) > 1 else ""
            desc = vals[2] if len(vals) > 2 else ""
            inp = vals[3] if len(vals) > 3 else ""
        except Exception:
            name, desc, inp = "", "", "", False

        new_out = run_solution_for_input(solution_root, lang, inp, project_id, add_path)
        try:
            project_repo.add_or_update_testcase(
                int(project_id),
                int(tc_id),
                name or "",
                desc or "",
                inp or "",
                new_out,
            )
        except Exception:
            # continue on individual failures
            continue

@projects_api.route('/list_source_files', methods=['GET'])
@jwt_required()
@inject
def list_source_files(project_repo: ProjectRepository = Provide[Container.project_repo], user_repo: UserRepository = Provide[Container.user_repo]):
    """Return list of previewable source files for a project (relative paths if a directory)."""
    if not user_repo.is_admin():
        return make_response({'message': 'Access Denied'}, HTTPStatus.UNAUTHORIZED)

    pid = request.args.get('project_id', '')
    if not pid:
        return make_response({'message': 'Missing project_id'}, HTTPStatus.BAD_REQUEST)

    root = project_repo.get_project_path(pid)  # absolute path previously saved
    if not root or not os.path.exists(root):
        return make_response({'message': 'Project path not found'}, HTTPStatus.NOT_FOUND)

    files = []
    if os.path.isdir(root):
        for base, _, fnames in os.walk(root):
            for fname in fnames:
                full = os.path.join(base, fname)
                if has_allowed_ext(full):
                    rel = os.path.relpath(full, root).replace("\\", "/")
                    files.append({'relpath': rel, 'bytes': os.path.getsize(full)})
    else:
        if has_allowed_ext(root):
            files.append({'relpath': os.path.basename(root), 'bytes': os.path.getsize(root)})

    return jsonify({'files': files})


@projects_api.route('/get_source_file', methods=['GET'])
@jwt_required()
@inject
def get_source_file(project_repo: ProjectRepository = Provide[Container.project_repo], user_repo: UserRepository = Provide[Container.user_repo]):
    """Return the text content of a source file for preview."""
    if not user_repo.is_admin():
        return make_response({'message': 'Access Denied'}, HTTPStatus.UNAUTHORIZED)

    pid = request.args.get('project_id', '')
    relpath = request.args.get('relpath', '')
    if not pid:
        return make_response({'message': 'Missing project_id'}, HTTPStatus.BAD_REQUEST)

    root = project_repo.get_project_path(pid)
    if not root or not os.path.exists(root):
        return make_response({'message': 'Project path not found'}, HTTPStatus.NOT_FOUND)

    # Resolve full path safely using os.path only
    if os.path.isdir(root):
        candidate = os.path.normpath(os.path.join(root, relpath))
        root_abs = os.path.abspath(root)
        cand_abs = os.path.abspath(candidate)
        if not (cand_abs == root_abs or cand_abs.startswith(root_abs + os.sep)):
            return make_response({'message': 'Invalid path'}, HTTPStatus.BAD_REQUEST)
        full = cand_abs
    else:
        # Single-file project: only that file is allowed
        if relpath and relpath != os.path.basename(root):
            return make_response({'message': 'Invalid path for single-file project'}, HTTPStatus.BAD_REQUEST)
        full = root

    if not os.path.exists(full):
        return make_response({'message': 'File not found'}, HTTPStatus.NOT_FOUND)
    if not has_allowed_ext(full):
        return make_response({'message': 'Unsupported file type'}, HTTPStatus.BAD_REQUEST)

    # Limit preview size to 2 MB
    if os.path.getsize(full) > 2 * 1024 * 1024:
        return make_response({'message': 'File too large to preview'}, HTTPStatus.BAD_REQUEST)

    with open(full, 'r', encoding='utf-8', errors='replace') as f:
        text = f.read()

    resp = make_response(text, HTTPStatus.OK)
    resp.headers['Content-Type'] = 'text/plain; charset=utf-8'
    resp.headers['Cache-Control'] = 'no-store'
    return resp

@projects_api.route('/get_project_id', methods=['GET'])
@jwt_required()
@inject
def get_project(project_repo: ProjectRepository = Provide[Container.project_repo], user_repo: UserRepository = Provide[Container.user_repo]):
    if not user_repo.is_admin():
        return make_response({'message': 'Access Denied'}, HTTPStatus.UNAUTHORIZED)

    project_id = request.args.get('id')
    project_info = project_repo.get_project(project_id)
    proj_row = Projects.query.get(project_id)

    if isinstance(project_info, dict):
        project_info["division"] = normalize_division(getattr(proj_row, "Division", "blue") if proj_row else "blue")
        project_info["descriptionText"] = getattr(proj_row, "DescriptionText", None) if proj_row else None
        project_info["descriptionFile"] = (
            project_info.get("descriptionFile")
            or project_info.get("descriptionFileName")
            or project_info.get("descriptionFilePath")
            or (os.path.basename(getattr(proj_row, "AsnDescriptionPath", "") or "") if proj_row else "")
        )

    return make_response(jsonify(project_info), HTTPStatus.OK)
    
@projects_api.route('/get_testcases', methods=['GET'])
@jwt_required()
@inject
def get_testcases(project_repo: ProjectRepository = Provide[Container.project_repo], user_repo: UserRepository = Provide[Container.user_repo]):
    if not user_repo.is_admin():
        return make_response({'message': 'Access Denied'}, HTTPStatus.UNAUTHORIZED)

    project_id = request.args.get('id')
    testcases = project_repo.get_testcases(project_id)

    return make_response(jsonify(testcases), HTTPStatus.OK)

@projects_api.route('/json_add_testcases', methods=['POST'])
@jwt_required()
@inject   
def json_add_testcases(project_repo: ProjectRepository = Provide[Container.project_repo], user_repo: UserRepository = Provide[Container.user_repo]):
    if not user_repo.is_admin():
        return make_response({'message': 'Access Denied'}, HTTPStatus.UNAUTHORIZED)

    file = request.files['file']
    project_id = request.form["project_id"]

    try:
        json_obj = json.load(file)
    except json.JSONDecodeError:
         message = {
            'message': 'Incorrect JSON format'
        }
         return make_response(message, HTTPStatus.INTERNAL_SERVER_ERROR)
    else:
        for testcase in json_obj:
            project_repo.add_or_update_testcase(
                int(project_id),
                -1,
                testcase["name"],
                testcase["description"],
                testcase["input"],
                testcase["output"],
                bool(testcase.get("hidden", False)),
            )

    return make_response("Testcase Added", HTTPStatus.OK)

@projects_api.route('/add_or_update_testcase', methods=['POST'])
@jwt_required()
@inject   
def add_or_update_testcase(project_repo: ProjectRepository = Provide[Container.project_repo], user_repo: UserRepository = Provide[Container.user_repo]):
    if not user_repo.is_admin():
        return make_response({'message': 'Access Denied'}, HTTPStatus.UNAUTHORIZED)

    # Grab all fields safely (defaults prevent NameError)
    id_val = request.form.get('id', '').strip()
    name = request.form.get('name', '').strip()
    input_data = request.form.get('input', '')
    output = request.form.get('output', '')
    project_id = request.form.get('project_id', '').strip()
    description = request.form.get('description', '').strip()
    hidden_raw = request.form.get('hidden', '').strip()
    
    if id_val == '' or name == '' or input_data == '' or project_id == '' or description == '':
        return make_response("Error in form", HTTPStatus.BAD_REQUEST)    

    # Coerce types with validation
    try:
        project_id = int(project_id)
        id_val = int(id_val)
    except ValueError:
        return make_response("Invalid numeric id", HTTPStatus.BAD_REQUEST)

    def parse_hidden(v: str) -> bool:
        s = (v or "").strip().lower()
        return s in ("1", "true", "yes", "y", "on")

    hidden = parse_hidden(hidden_raw)

    # Auto-recompute expected output when editing a testcase.
    # If the project's language is Python, run the saved solution with the new input
    # and overwrite the provided `output` with the program's stdout.
    try:
        project = project_repo.get_selected_project(int(project_id))
        language = (getattr(project, "Language", "") or "")
        solution_root = (getattr(project, "solutionpath", "") or "")
        add_path = getattr(project, "AdditionalFilePath", "") if project else ""
        output = run_solution_for_input(solution_root, language, input_data, int(project_id), add_path)
    except Exception:
        # Fall back to the submitted output if recomputation fails
        pass

    project_repo.add_or_update_testcase(project_id, id_val, name, description, input_data, output, hidden)

    return make_response("Testcase Added", HTTPStatus.OK)

@projects_api.route('/remove_testcase', methods=['POST'])
@jwt_required()
@inject
def remove_testcase(project_repo: ProjectRepository = Provide[Container.project_repo], user_repo: UserRepository = Provide[Container.user_repo]):
    if not user_repo.is_admin():
        return make_response({'message': 'Access Denied'}, HTTPStatus.UNAUTHORIZED)

    if 'id' in request.form:
        id_val=request.form['id']
    project_repo.remove_testcase(id_val)
    return make_response("Testcase Removed", HTTPStatus.OK)

@projects_api.route('/getAssignmentDescription', methods=['GET'])
@jwt_required()
@inject
def getAssignmentDescription(project_repo: ProjectRepository = Provide[Container.project_repo]):
    if not can_access_assignment_descriptions():
        return make_response(
            {'message': 'Assignment descriptions are currently locked.'},
            HTTPStatus.FORBIDDEN,
        )
    project_id = request.args.get('project_id')
    assignmentdesc_contents = project_repo.get_project_desc_file(project_id)
    assignmentdesc_path = project_repo.get_project_desc_path(project_id)
    fname = os.path.basename(assignmentdesc_path) if assignmentdesc_path else 'assignment_description'
    ext = os.path.splitext(fname)[1].lower()
    if ext == '.pdf':
        mime = 'application/pdf'
    elif ext == '.docx':
        mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    elif ext == '.doc':
        mime = 'application/msword'
    else:
        mime = 'application/octet-stream'
    file_stream = BytesIO(assignmentdesc_contents)
    data = file_stream.getvalue()
    # Send original filename; expose headers for CORS so frontend can read them
    return Response(
        data,
        content_type=mime,
        headers={
            'Content-Disposition': f"attachment; filename=\"{fname}\"; filename*=UTF-8''{quote(fname)}",
            'Content-Length': str(len(data)),
            'X-Filename': fname,
            'Access-Control-Expose-Headers': 'Content-Disposition, Content-Type, X-Filename',
        },
    )

@projects_api.route('/reorder', methods=['POST'])
@jwt_required()
@inject
def reorder_projects(
    project_repo: ProjectRepository = Provide[Container.project_repo],
    user_repo: UserRepository = Provide[Container.user_repo],
):
    if not user_repo.is_admin():
        return make_response({'message': 'Access Denied'}, HTTPStatus.UNAUTHORIZED)

    data = request.get_json() or {}
    id_order = data.get('id_order', [])
    project_type = (data.get('project_type', '') or '').strip().lower()
    division = normalize_division(data.get('division'))

    if project_type not in {'competition', 'practice'}:
        return make_response({'message': 'Invalid project type'}, HTTPStatus.BAD_REQUEST)

    if not isinstance(id_order, list) or not all(isinstance(i, int) for i in id_order):
        return make_response({'message': 'Invalid ID order format'}, HTTPStatus.BAD_REQUEST)

    projects = (
        Projects.query
        .filter(Projects.Type == project_type, Projects.Division == division)
        .order_by(
            Projects.OrderIndex.is_(None),
            Projects.OrderIndex.asc(),
            Projects.Id.asc(),
        )
        .all()
    )
    project_ids = [int(project.Id) for project in projects]

    if len(id_order) != len(project_ids):
        return make_response({'message': 'ID order length mismatch'}, HTTPStatus.BAD_REQUEST)
    if len(id_order) != len(set(id_order)):
        return make_response({'message': 'Duplicate IDs in order'}, HTTPStatus.BAD_REQUEST)
    if set(id_order) != set(project_ids):
        return make_response({'message': 'ID order does not match the selected project type/division'}, HTTPStatus.BAD_REQUEST)

    id_to_proj = {int(p.Id): p for p in projects}

    # First pass to flush the order
    for idx, proj_id in enumerate(id_order):
        proj = id_to_proj.get(proj_id)
        if proj:
            proj.OrderIndex = -idx - 1
        else:
            return make_response({'message': f'Project ID {proj_id} not found'}, HTTPStatus.BAD_REQUEST)
    db.session.commit()

    # Second pass to set the correct order.
    # Avoids duplicate unique values
    for idx, proj_id in enumerate(id_order):
        proj = id_to_proj.get(proj_id)
        if proj:
            proj.OrderIndex = idx + 1
        else:
            return make_response({'message': f'Project ID {proj_id} not found'}, HTTPStatus.BAD_REQUEST)
    db.session.commit()

    return make_response("Projects Reordered", HTTPStatus.OK)