from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user, jwt_required

from src.repositories.database import db
from src.repositories.models import (
    AdminUsers,
    GoldDivision,
    Projects,
    Schools,
    StudentUsers,
    Teams,
)
from src.constants import (
    COMPETITION_START,
    COMPETITION_END,
    PRACTICE_START,
    PRACTICE_END,
)

gold_division_api = Blueprint('gold_division_api', __name__)

SUBMISSION_COOLDOWN_SECONDS = 60


def is_site_admin(user) -> bool:
    return isinstance(user, AdminUsers) and int(getattr(user, "Role", 0) or 0) == 1


def is_teacher(user) -> bool:
    return isinstance(user, AdminUsers) and int(getattr(user, "Role", 0) or 0) == 0


def normalize_division(value) -> str:
    return str(value or "").strip().lower()


def normalize_gold_problem_type(value) -> str:
    raw = str(value or "").strip().lower()
    return "creative" if raw == "creative" else "normal"


def get_gold_project_or_none(project_id: int):
    if not project_id or project_id <= 0:
        return None

    project = Projects.query.get(project_id)
    if not project:
        return None

    if normalize_division(getattr(project, "Division", "")) != "gold":
        return None

    return project


def get_student_team_id(student) -> int | None:
    if not isinstance(student, StudentUsers):
        return None

    team_id = int(getattr(student, "TeamId", 0) or 0)
    return team_id if team_id > 0 else None


def get_team_student_ids(team_id: int) -> list[int]:
    if not team_id or team_id <= 0:
        return []

    students = (
        StudentUsers.query
        .filter(StudentUsers.TeamId == team_id)
        .order_by(StudentUsers.Id.asc())
        .all()
    )
    return [int(student.Id) for student in students if int(getattr(student, "Id", 0) or 0) > 0]


def get_team_gold_submission(project_id: int, team_id: int):
    if not project_id or project_id <= 0 or not team_id or team_id <= 0:
        return None

    return (
        GoldDivision.query
        .join(StudentUsers, StudentUsers.Id == GoldDivision.StudentId)
        .filter(
            GoldDivision.ProjectId == project_id,
            StudentUsers.TeamId == team_id,
        )
        .order_by(
            GoldDivision.SubmittedAt.desc(),
            GoldDivision.Id.desc(),
        )
        .first()
    )


def get_team_gold_submission_history(project_id: int, team_id: int):
    if not project_id or project_id <= 0 or not team_id or team_id <= 0:
        return []

    return (
        GoldDivision.query
        .join(StudentUsers, StudentUsers.Id == GoldDivision.StudentId)
        .filter(
            GoldDivision.ProjectId == project_id,
            StudentUsers.TeamId == team_id,
        )
        .order_by(
            GoldDivision.SubmittedAt.desc(),
            GoldDivision.Id.desc(),
        )
        .all()
    )


def get_latest_student_submission(project_id: int, student_id: int):
    if not project_id or project_id <= 0 or not student_id or student_id <= 0:
        return None

    return (
        GoldDivision.query
        .filter(
            GoldDivision.ProjectId == project_id,
            GoldDivision.StudentId == student_id,
        )
        .order_by(
            GoldDivision.SubmittedAt.desc(),
            GoldDivision.Id.desc(),
        )
        .first()
    )


def get_submission_cooldown(student_id: int, project_id: int) -> dict:
    latest_submission = get_latest_student_submission(project_id, student_id)

    if not latest_submission:
        return {
            "cooldownSecondsRemaining": 0,
            "nextAllowedSubmissionAt": None,
        }

    submitted_at = getattr(latest_submission, "SubmittedAt", None)
    if not submitted_at:
        return {
            "cooldownSecondsRemaining": 0,
            "nextAllowedSubmissionAt": None,
        }

    next_allowed_at = submitted_at + timedelta(seconds=SUBMISSION_COOLDOWN_SECONDS)
    seconds_remaining = int((next_allowed_at - datetime.utcnow()).total_seconds())

    if seconds_remaining <= 0:
        return {
            "cooldownSecondsRemaining": 0,
            "nextAllowedSubmissionAt": None,
        }

    return {
        "cooldownSecondsRemaining": seconds_remaining,
        "nextAllowedSubmissionAt": next_allowed_at,
    }


def is_regrade_requested(submission) -> bool:
    if not submission:
        return False

    return getattr(submission, "RegradeRequestedAt", None) is not None


def has_been_graded(submission) -> bool:
    if not submission:
        return False

    if getattr(submission, "Points", None) is not None:
        return True

    feedback = getattr(submission, "Feedback", None)
    if isinstance(feedback, str) and feedback.strip():
        return True

    if getattr(submission, "AdminGraderId", None) is not None:
        return True

    return False


def get_submission_status(submission) -> str:
    if not submission:
        return "not_submitted"

    if is_regrade_requested(submission):
        return "regrade_requested"

    if has_been_graded(submission):
        return "graded"

    return "needs_grading"


def get_latest_graded_team_submission(project_id: int, team_id: int):
    if not project_id or project_id <= 0 or not team_id or team_id <= 0:
        return None

    history_rows = get_team_gold_submission_history(project_id, team_id)
    for row in history_rows:
        if has_been_graded(row):
            return row

    return None


def get_effective_grade_source(submission):
    if not submission:
        return None

    if has_been_graded(submission):
        return submission

    submitting_student = StudentUsers.query.get(int(getattr(submission, "StudentId", 0) or 0))
    team_id = int(getattr(submitting_student, "TeamId", 0) or 0) if submitting_student else 0
    project_id = int(getattr(submission, "ProjectId", 0) or 0)

    if team_id <= 0 or project_id <= 0:
        return None

    return get_latest_graded_team_submission(project_id, team_id)


def serialize_submission(submission, *, include_grades: bool, teacher_view: bool = False):
    if not submission:
        return None

    submitting_student = StudentUsers.query.get(int(getattr(submission, "StudentId", 0) or 0))
    team_id = int(getattr(submitting_student, "TeamId", 0) or 0) if submitting_student else None
    project = Projects.query.get(int(getattr(submission, "ProjectId", 0) or 0)) \
        if getattr(submission, "ProjectId", None) is not None else None

    grade_source = get_effective_grade_source(submission) if include_grades else None

    return {
        "id": submission.Id,
        "link": submission.Link,
        "docLink": getattr(submission, "DocLink", None),
        "studentId": submission.StudentId,
        "projectId": getattr(submission, "ProjectId", None),
        "projectName": getattr(project, "Name", None) if project else None,
        "teamId": team_id,
        "submittedAt": submission.SubmittedAt,
        "points": getattr(grade_source, "Points", None) if grade_source else None,
        "feedback": getattr(grade_source, "Feedback", None) if grade_source else None,
        "adminGraderId": getattr(grade_source, "AdminGraderId", None) if grade_source else None,
        "hasSubmission": True,
        "status": get_submission_status(submission),
        "regradeRequested": is_regrade_requested(submission),
        "regradeRequestedAt": getattr(submission, "RegradeRequestedAt", None),
        "regradeRequestedByStudentId": getattr(submission, "RegradeRequestedByStudentId", None),
        "isTeacherView": teacher_view,
    }


def get_latest_visible_submissions_for_query(base_query):
    rows = (
        base_query
        .join(StudentUsers, StudentUsers.Id == GoldDivision.StudentId)
        .order_by(
            GoldDivision.ProjectId.asc(),
            StudentUsers.TeamId.asc(),
            GoldDivision.SubmittedAt.desc(),
            GoldDivision.Id.desc(),
        )
        .all()
    )

    latest_rows = []
    seen: set[tuple[int, int]] = set()

    for row in rows:
        project_id = int(getattr(row, "ProjectId", 0) or 0)
        student = StudentUsers.query.get(int(getattr(row, "StudentId", 0) or 0))
        team_id = int(getattr(student, "TeamId", 0) or 0) if student else 0
        key = (project_id, team_id)

        if project_id <= 0 or team_id <= 0:
            continue

        if key in seen:
            continue

        seen.add(key)
        latest_rows.append(row)

    latest_rows.sort(
        key=lambda submission: (
            getattr(submission, "SubmittedAt", None) or datetime.min,
            int(getattr(submission, "Id", 0) or 0),
        ),
        reverse=True,
    )
    return latest_rows


def get_team_display_name(team) -> str:
    team_name = str(getattr(team, "Name", "") or "").strip()
    team_number = getattr(team, "TeamNumber", None)

    if team_name:
        return team_name

    if team_number is not None:
        return f"Team {team_number}"

    return "Unnamed Team"


def serialize_team_project_row(team, submission, *, include_grades: bool, project=None):
    school = Schools.query.get(int(getattr(team, "SchoolId", 0) or 0))
    school_name = getattr(school, "Name", None) if school else None

    if submission:
        status = get_submission_status(submission)
        grade_source = get_effective_grade_source(submission) if include_grades else None
        points = getattr(grade_source, "Points", None) if grade_source else None
        feedback = getattr(grade_source, "Feedback", None) if grade_source else None
        admin_grader_id = getattr(grade_source, "AdminGraderId", None) if grade_source else None
        submitted_at = getattr(submission, "SubmittedAt", None)
        project_id = getattr(submission, "ProjectId", None)
        project_name = getattr(project, "Name", None) if project else None
        if not project_name and project_id:
            submission_project = Projects.query.get(int(project_id))
            project_name = getattr(submission_project, "Name", None) if submission_project else None
        student_id = getattr(submission, "StudentId", None)
        link = getattr(submission, "Link", None)
        doc_link = getattr(submission, "DocLink", None)
        submission_id = getattr(submission, "Id", None)
        has_submission = True
        regrade_requested = is_regrade_requested(submission)
        regrade_requested_at = getattr(submission, "RegradeRequestedAt", None)
        regrade_requested_by_student_id = getattr(
            submission, "RegradeRequestedByStudentId", None
        )
    else:
        status = "not_submitted"
        points = None
        feedback = None
        admin_grader_id = None
        submitted_at = None
        project_id = getattr(project, "Id", None) if project else None
        project_name = getattr(project, "Name", None) if project else None
        student_id = None
        link = None
        doc_link = None
        submission_id = None
        has_submission = False
        regrade_requested = False
        regrade_requested_at = None
        regrade_requested_by_student_id = None

    return {
        "id": submission_id,
        "link": link,
        "docLink": doc_link,
        "studentId": student_id,
        "projectId": project_id,
        "projectName": project_name,
        "teamId": getattr(team, "Id", None),
        "teamName": get_team_display_name(team),
        "teamNumber": getattr(team, "TeamNumber", None),
        "schoolName": school_name,
        "submittedAt": submitted_at,
        "points": points,
        "feedback": feedback,
        "adminGraderId": admin_grader_id,
        "hasSubmission": has_submission,
        "status": status,
        "regradeRequested": regrade_requested,
        "regradeRequestedAt": regrade_requested_at,
        "regradeRequestedByStudentId": regrade_requested_by_student_id,
    }


def serialize_submission_history_item(
    submission,
    *,
    submission_number=None,
    event_type: str = "submission",
    event_timestamp=None,
):
    submitting_student = StudentUsers.query.get(int(getattr(submission, "StudentId", 0) or 0))
    team_id = int(getattr(submitting_student, "TeamId", 0) or 0) if submitting_student else None
    project = Projects.query.get(int(getattr(submission, "ProjectId", 0) or 0)) \
        if getattr(submission, "ProjectId", None) is not None else None
    admin_grader = AdminUsers.query.get(int(getattr(submission, "AdminGraderId", 0) or 0)) \
        if getattr(submission, "AdminGraderId", None) is not None else None

    admin_grader_name = None
    if admin_grader:
        first_name = str(getattr(admin_grader, "Firstname", "") or "").strip()
        last_name = str(getattr(admin_grader, "Lastname", "") or "").strip()
        full_name = f"{first_name} {last_name}".strip()
        admin_grader_name = full_name or getattr(admin_grader, "Email", None)

    effective_event_timestamp = event_timestamp
    if effective_event_timestamp is None:
        effective_event_timestamp = (
            getattr(submission, "RegradeRequestedAt", None)
            if event_type == "regrade_request"
            else getattr(submission, "SubmittedAt", None)
        )

    return {
        "eventId": f"{event_type}-{submission.Id}",
        "eventType": event_type,
        "eventTimestamp": effective_event_timestamp,
        "id": submission.Id,
        "submissionNumber": submission_number,
        "link": getattr(submission, "Link", None),
        "docLink": getattr(submission, "DocLink", None),
        "studentId": getattr(submission, "StudentId", None),
        "projectId": getattr(submission, "ProjectId", None),
        "projectName": getattr(project, "Name", None) if project else None,
        "teamId": team_id,
        "submittedAt": getattr(submission, "SubmittedAt", None),
        "points": getattr(submission, "Points", None),
        "feedback": getattr(submission, "Feedback", None),
        "adminGraderId": getattr(submission, "AdminGraderId", None),
        "adminGraderName": admin_grader_name,
        "status": "regrade_requested" if event_type == "regrade_request" else get_submission_status(submission),
        "regradeRequested": is_regrade_requested(submission),
        "regradeRequestedAt": getattr(submission, "RegradeRequestedAt", None),
        "regradeRequestedByStudentId": getattr(submission, "RegradeRequestedByStudentId", None),
    }


def build_submission_history_events(history_rows):
    history_count = len(history_rows)
    events = []

    for index, row in enumerate(history_rows):
        submission_number = history_count - index

        submission_event = serialize_submission_history_item(
            row,
            submission_number=submission_number,
            event_type="submission",
            event_timestamp=getattr(row, "SubmittedAt", None),
        )
        events.append(submission_event)

        regrade_requested_at = getattr(row, "RegradeRequestedAt", None)
        if regrade_requested_at is not None:
            regrade_event = serialize_submission_history_item(
                row,
                submission_number=submission_number,
                event_type="regrade_request",
                event_timestamp=regrade_requested_at,
            )
            events.append(regrade_event)

    events.sort(
        key=lambda item: (
            item.get("eventTimestamp") or datetime.min,
            int(item.get("id") or 0),
            1 if item.get("eventType") == "regrade_request" else 0,
        ),
        reverse=True,
    )

    return events


def get_gold_teams_for_site_admin() -> list[Teams]:
    return (
        Teams.query
        .filter(Teams.Division == "Gold")
        .order_by(Teams.TeamNumber.asc(), Teams.Id.asc())
        .all()
    )


def get_gold_teams_for_teacher(admin_user) -> list[Teams]:
    if not isinstance(admin_user, AdminUsers):
        return []

    return (
        Teams.query
        .join(StudentUsers, StudentUsers.TeamId == Teams.Id)
        .filter(
            Teams.Division == "Gold",
            StudentUsers.TeacherId == admin_user.Id,
        )
        .distinct()
        .order_by(Teams.TeamNumber.asc(), Teams.Id.asc())
        .all()
    )


def get_gold_projects() -> list[Projects]:
    return (
        Projects.query
        .filter(Projects.Division == "gold")
        .order_by(
            Projects.OrderIndex.is_(None),
            Projects.OrderIndex.asc(),
            Projects.Id.asc(),
        )
        .all()
    )


def build_team_rows_for_all_gold_projects(team, *, include_grades: bool):
    rows = []

    for project in get_gold_projects():
        project_id = int(getattr(project, "Id", 0) or 0)
        if project_id <= 0:
            continue

        submission = get_team_gold_submission(project_id, int(getattr(team, "Id", 0) or 0))
        rows.append(
            serialize_team_project_row(
                team,
                submission,
                include_grades=include_grades,
                project=project,
            )
        )

    def sort_key(row):
        status_order = {
            "regrade_requested": 0,
            "needs_grading": 1,
            "not_submitted": 2,
            "graded": 3,
        }
        project_name = str(row.get("projectName") or "").lower()
        project_id = int(row.get("projectId") or 0)
        submitted_at = row.get("submittedAt") or datetime.min
        return (
            status_order.get(row.get("status"), 99),
            project_name,
            project_id,
            submitted_at,
        )

    rows.sort(key=sort_key)
    return rows


def build_project_team_rows(teams: list[Teams], project_id: int, *, include_grades: bool):
    rows = []

    for team in teams:
        team_id = int(getattr(team, "Id", 0) or 0)
        if team_id <= 0:
            continue

        submission = get_team_gold_submission(project_id, team_id)
        rows.append(
            serialize_team_project_row(
                team,
                submission,
                include_grades=include_grades,
            )
        )

    def sort_key(row):
        status_order = {
            "regrade_requested": 0,
            "needs_grading": 1,
            "not_submitted": 2,
            "graded": 3,
        }
        submitted_at = row.get("submittedAt") or datetime.min
        return (
            status_order.get(row.get("status"), 99),
            -(int(row.get("teamNumber") or 10**9)),
            submitted_at,
        )

    rows.sort(key=sort_key)
    return rows


# -----------------------------
# STUDENT: submit project
# Team-shared submission for a Gold project
# Each resubmission creates a new row so grading history is preserved.
# The newest team submission becomes the visible/current one.
# -----------------------------
@gold_division_api.route('/create', methods=['POST'])
@jwt_required()
def create_gold_submission():

    if not isinstance(current_user, StudentUsers):
        return jsonify({'message': 'Only students can submit'}), 403

    data = request.get_json() or {}
    scratch_link = (data.get("scratch_link") or "").strip()
    description_link = (data.get("description_link") or "").strip()
    project_id = data.get("project_id")

    try:
        project_id = int(project_id)
    except (TypeError, ValueError):
        return jsonify({'message': 'Missing or invalid project_id'}), 400

    project = get_gold_project_or_none(project_id)
    if not project:
        return jsonify({'message': 'Gold Division project not found'}), 404

    if not scratch_link:
        return jsonify({'message': 'Missing Scratch link'}), 400

    gold_problem_type = normalize_gold_problem_type(getattr(project, "GoldProblemType", "normal"))
    if gold_problem_type == "creative" and not description_link:
        return jsonify({
            'message': 'Creative problems require both a Scratch link and a document link.'
        }), 400

    if gold_problem_type != "creative":
        description_link = ""

    team_id = get_student_team_id(current_user)
    if not team_id:
        return jsonify({'message': 'No team is associated with this account'}), 400
    
    now = datetime.now()
    if project.Type == "competition":
        if now < COMPETITION_START:
            return jsonify({'message': 'Competition has not started yet.'}, 403)
        elif now > COMPETITION_END:
            return jsonify({'message': 'Competition has ended. Submissions are closed.'}, 403)

    cooldown = get_submission_cooldown(int(current_user.Id), project_id)
    cooldown_seconds_remaining = int(cooldown.get("cooldownSecondsRemaining", 0) or 0)

    if cooldown_seconds_remaining > 0:
        return jsonify({
            'message': f'Please wait {cooldown_seconds_remaining} more second(s) before submitting again.',
            'cooldownSecondsRemaining': cooldown_seconds_remaining,
            'nextAllowedSubmissionAt': cooldown.get("nextAllowedSubmissionAt"),
        }), 429

    new_submission = GoldDivision(
        Link=scratch_link,
        DocLink=description_link or None,
        StudentId=current_user.Id,
        ProjectId=project_id,
        SubmittedAt=now,
        Points=None,
        Feedback=None,
        AdminGraderId=None,
        RegradeRequestedAt=None,
        RegradeRequestedByStudentId=None,
    )
    db.session.add(new_submission)
    db.session.commit()

    refreshed_cooldown = get_submission_cooldown(int(current_user.Id), project_id)

    return jsonify({
        'message': 'Submission saved',
        'cooldownSecondsRemaining': refreshed_cooldown.get("cooldownSecondsRemaining", 0),
        'nextAllowedSubmissionAt': refreshed_cooldown.get("nextAllowedSubmissionAt"),
    }), 200


# -----------------------------
# ADMIN / TEACHER: get visible submissions
# For project-specific views, return all gold teams including teams with no submission
# -----------------------------
@gold_division_api.route('/visible', methods=['GET'])
@jwt_required()
def get_visible_submissions():

    if not isinstance(current_user, AdminUsers):
        return jsonify({'message': 'Admins/teachers only'}), 403

    project_id = request.args.get('project_id', type=int)
    team_id = request.args.get('team_id', type=int)
    project = None

    if project_id is not None:
        if project_id <= 0:
            return jsonify({'message': 'Missing or invalid project_id'}), 400
        project = get_gold_project_or_none(project_id)
        if not project:
            return jsonify({'message': 'Gold Division project not found'}), 404

    if is_site_admin(current_user):
        if team_id is not None:
            if team_id <= 0:
                return jsonify({'message': 'Missing or invalid team_id'}), 400

            team = Teams.query.get(team_id)
            if not team or normalize_division(getattr(team, "Division", "")) != "gold":
                return jsonify({'message': 'Gold team not found'}), 404

            if project_id is not None:
                submission = get_team_gold_submission(project_id, team_id)
                result = [
                    serialize_team_project_row(
                        team,
                        submission,
                        include_grades=True,
                        project=project,
                    )
                ]
            else:
                result = build_team_rows_for_all_gold_projects(
                    team,
                    include_grades=True,
                )

            school = Schools.query.get(int(getattr(team, "SchoolId", 0) or 0))
            return jsonify({
                "currentAdminId": current_user.Id,
                "canGrade": True,
                "isTeacherView": False,
                "projectId": project_id,
                "projectName": getattr(project, "Name", None) if project else None,
                "teamId": getattr(team, "Id", None),
                "teamName": get_team_display_name(team),
                "teamNumber": getattr(team, "TeamNumber", None),
                "schoolName": getattr(school, "Name", None) if school else None,
                "submissions": result,
            }), 200

        if project_id is not None:
            teams = get_gold_teams_for_site_admin()
            result = build_project_team_rows(teams, project_id, include_grades=True)
        else:
            query = GoldDivision.query
            submissions = get_latest_visible_submissions_for_query(query)
            result = [
                serialize_submission(s, include_grades=True, teacher_view=False)
                for s in submissions
            ]

        return jsonify({
            "currentAdminId": current_user.Id,
            "canGrade": True,
            "isTeacherView": False,
            "projectId": project_id,
            "projectName": getattr(project, "Name", None) if project else None,
            "teamId": None,
            "teamName": None,
            "teamNumber": None,
            "schoolName": None,
            "submissions": result,
        }), 200

    if is_teacher(current_user):
        if team_id is not None:
            if team_id <= 0:
                return jsonify({'message': 'Missing or invalid team_id'}), 400

            team = (
                Teams.query
                .join(StudentUsers, StudentUsers.TeamId == Teams.Id)
                .filter(
                    Teams.Id == team_id,
                    Teams.Division == "Gold",
                    StudentUsers.TeacherId == current_user.Id,
                )
                .distinct()
                .first()
            )

            if not team:
                return jsonify({'message': 'Gold team not found'}), 404

            if project_id is not None:
                submission = get_team_gold_submission(project_id, team_id)
                result = [
                    serialize_team_project_row(
                        team,
                        submission,
                        include_grades=False,
                        project=project,
                    )
                ]
            else:
                result = build_team_rows_for_all_gold_projects(
                    team,
                    include_grades=False,
                )

            school = Schools.query.get(int(getattr(team, "SchoolId", 0) or 0))
            return jsonify({
                "currentAdminId": None,
                "canGrade": False,
                "isTeacherView": True,
                "projectId": project_id,
                "projectName": getattr(project, "Name", None) if project else None,
                "teamId": getattr(team, "Id", None),
                "teamName": get_team_display_name(team),
                "teamNumber": getattr(team, "TeamNumber", None),
                "schoolName": getattr(school, "Name", None) if school else None,
                "submissions": result,
            }), 200

        if project_id is not None:
            teams = get_gold_teams_for_teacher(current_user)
            result = build_project_team_rows(teams, project_id, include_grades=False)
        else:
            query = (
                GoldDivision.query
                .join(StudentUsers, StudentUsers.Id == GoldDivision.StudentId)
                .filter(StudentUsers.TeacherId == current_user.Id)
            )

            submissions = get_latest_visible_submissions_for_query(query)
            result = [
                serialize_submission(s, include_grades=False, teacher_view=True)
                for s in submissions
            ]

        return jsonify({
            "currentAdminId": None,
            "canGrade": False,
            "isTeacherView": True,
            "projectId": project_id,
            "projectName": getattr(project, "Name", None) if project else None,
            "teamId": None,
            "teamName": None,
            "teamNumber": None,
            "schoolName": None,
            "submissions": result,
        }), 200

    return jsonify({'message': 'Admins/teachers only'}), 403


# -----------------------------
# ADMIN: get all submissions
# Site admins only, deduped to latest team submission per project
# -----------------------------
@gold_division_api.route('/all', methods=['GET'])
@jwt_required()
def get_all_submissions():

    if not is_site_admin(current_user):
        return jsonify({'message': 'Admins only'}), 403

    submissions = get_latest_visible_submissions_for_query(GoldDivision.query)

    result = [
        serialize_submission(s, include_grades=True, teacher_view=False)
        for s in submissions
    ]

    return jsonify({
        "currentAdminId": current_user.Id,
        "submissions": result
    }), 200


# -----------------------------
# ADMIN: get team submission history
# Returns both saved submissions and regrade requests for the same team + project,
# newest first.
# Submission numbering is scoped to the team+project history.
# -----------------------------
@gold_division_api.route('/history/<int:submission_id>', methods=['GET'])
@jwt_required()
def get_submission_history(submission_id):

    if not is_site_admin(current_user):
        return jsonify({'message': 'Admins only'}), 403

    submission = GoldDivision.query.get(submission_id)
    if not submission:
        return jsonify({'message': 'Submission not found'}), 404

    submitting_student = StudentUsers.query.get(int(getattr(submission, "StudentId", 0) or 0))
    if not submitting_student:
        return jsonify({'message': 'Submitting student not found'}), 404

    team_id = get_student_team_id(submitting_student)
    project_id = int(getattr(submission, "ProjectId", 0) or 0)

    if not team_id or not project_id:
        return jsonify({'message': 'Unable to determine submission history'}), 400

    team = Teams.query.get(team_id)
    school = Schools.query.get(int(getattr(team, "SchoolId", 0) or 0)) if team else None
    project = Projects.query.get(project_id)

    history_rows = get_team_gold_submission_history(project_id, team_id)
    serialized_history = build_submission_history_events(history_rows)

    return jsonify({
        "teamId": team_id,
        "teamName": get_team_display_name(team) if team else None,
        "teamNumber": getattr(team, "TeamNumber", None) if team else None,
        "schoolName": getattr(school, "Name", None) if school else None,
        "projectId": project_id,
        "projectName": getattr(project, "Name", None) if project else None,
        "history": serialized_history,
    }), 200


# -----------------------------
# ADMIN: grade
# Grade applies to the selected submission row.
# Saving a new evaluation resolves any outstanding regrade request.
# -----------------------------
@gold_division_api.route('/grade/<int:submission_id>', methods=['POST'])
@jwt_required()
def grade_submission(submission_id):

    if not is_site_admin(current_user):
        return jsonify({'message': 'Admins only'}), 403

    submission = GoldDivision.query.get(submission_id)

    if not submission:
        return jsonify({'message': 'Submission not found'}), 404

    data = request.get_json() or {}
    points = data.get("points")
    feedback = data.get("feedback")

    try:
        points = int(points)
    except (TypeError, ValueError):
        return jsonify({'message': 'Points must be an integer'}), 400

    submission.Points = points
    submission.Feedback = feedback
    submission.AdminGraderId = current_user.Id
    submission.RegradeRequestedAt = None
    submission.RegradeRequestedByStudentId = None

    db.session.commit()

    return jsonify({'message': 'Points & feedback saved'}), 200


# -----------------------------
# STUDENT: request regrade for team submission
# -----------------------------
@gold_division_api.route('/request-regrade', methods=['POST'])
@jwt_required()
def request_regrade():

    if not isinstance(current_user, StudentUsers):
        return jsonify({'message': 'Students only'}), 403

    data = request.get_json() or {}
    project_id = data.get("project_id")

    try:
        project_id = int(project_id)
    except (TypeError, ValueError):
        return jsonify({'message': 'Missing or invalid project_id'}), 400

    project = get_gold_project_or_none(project_id)
    if not project:
        return jsonify({'message': 'Gold Division project not found'}), 404

    team_id = get_student_team_id(current_user)
    if not team_id:
        return jsonify({'message': 'No team is associated with this account'}), 400

    submission = get_team_gold_submission(project_id, team_id)
    if not submission:
        return jsonify({'message': 'No submission exists for this team yet'}), 404

    if not has_been_graded(submission):
        return jsonify({
            'message': 'A regrade can only be requested after a grade or feedback has been posted.'
        }), 400

    submission.RegradeRequestedAt = datetime.utcnow()
    submission.RegradeRequestedByStudentId = current_user.Id

    db.session.commit()

    return jsonify({'message': 'Regrade requested'}), 200


# -----------------------------
# STUDENT: get own team submission
# All teammates see the latest Gold submission for a project
# -----------------------------
@gold_division_api.route('/my', methods=['GET'])
@jwt_required()
def get_my_submission():

    if not isinstance(current_user, StudentUsers):
        return jsonify({'message': 'Students only'}), 403

    project_id = request.args.get('project_id', type=int)
    if project_id is None or project_id <= 0:
        return jsonify({'message': 'Missing or invalid project_id'}), 400

    project = get_gold_project_or_none(project_id)
    if not project:
        return jsonify({'message': 'Gold Division project not found'}), 404

    team_id = get_student_team_id(current_user)
    if not team_id:
        return jsonify({'message': 'No team is associated with this account'}), 400

    submission = get_team_gold_submission(project_id, team_id)
    cooldown = get_submission_cooldown(int(current_user.Id), project_id)

    if not submission:
        return jsonify({
            "id": None,
            "projectId": project_id,
            "link": "",
            "docLink": None,
            "points": None,
            "feedback": None,
            "submittedAt": None,
            "hasSubmission": False,
            "status": "not_submitted",
            "regradeRequested": False,
            "regradeRequestedAt": None,
            "regradeRequestedByStudentId": None,
            "cooldownSecondsRemaining": cooldown.get("cooldownSecondsRemaining", 0),
            "nextAllowedSubmissionAt": cooldown.get("nextAllowedSubmissionAt"),
        }), 200

    grade_source = get_effective_grade_source(submission)

    return jsonify({
        "id": submission.Id,
        "projectId": getattr(submission, "ProjectId", None),
        "link": submission.Link,
        "docLink": getattr(submission, "DocLink", None),
        "points": getattr(grade_source, "Points", None) if grade_source else None,
        "feedback": getattr(grade_source, "Feedback", None) if grade_source else None,
        "submittedAt": submission.SubmittedAt,
        "hasSubmission": True,
        "status": get_submission_status(submission),
        "regradeRequested": is_regrade_requested(submission),
        "regradeRequestedAt": getattr(submission, "RegradeRequestedAt", None),
        "regradeRequestedByStudentId": getattr(
            submission, "RegradeRequestedByStudentId", None
        ),
        "cooldownSecondsRemaining": cooldown.get("cooldownSecondsRemaining", 0),
        "nextAllowedSubmissionAt": cooldown.get("nextAllowedSubmissionAt"),
    }), 200