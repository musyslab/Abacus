from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, current_user
from dependency_injector.wiring import inject, Provide
from container import Container

from src.repositories.school_repository import SchoolRepository
from src.repositories.user_repository import UserRepository
from src.repositories.models import AdminUsers

school_api = Blueprint("school_api", __name__)

def teacher_id_for_school(school_id: int) -> int | None:
    teacher = (
        AdminUsers.query
        .filter_by(SchoolId=int(school_id), Role=0)
        .order_by(AdminUsers.Id.asc())
        .first()
    )
    return int(teacher.Id) if teacher else None

@school_api.route("/public/all", methods=["GET"])
@inject
def public_get_schools(
    school_repo: SchoolRepository = Provide[Container.school_repo],
):
    """
    Public endpoint: lists all schools for the registration flow.
    Returns: [{"id": <id>, "name": "<school name>"}]
    """
    schools = school_repo.get_all_schools()
    return jsonify([{"id": s.Id, "name": s.Name} for s in schools])

@school_api.route("/all", methods=["GET"])
@jwt_required()
@inject
def get_schools(
    school_repo: SchoolRepository = Provide[Container.school_repo],
):
    """
    Returns the schools visible to the current user.

    Default behavior:
      - AdminUsers: returns their single school (based on SchoolId)
      - StudentUsers: returns their single school (based on SchoolId)

    Optional behavior:
      - If query param all=true and the user is an admin, return all schools
        (useful for an admin dashboard, if you want it).
    """
    wants_all = (request.args.get("all") or "").lower() == "true"

    # Both AdminUsers and StudentUsers have SchoolId in the new schema.
    school_id = getattr(current_user, "SchoolId", None)

    if school_id is None:
        return jsonify([])

    # Allow admins to request all schools if desired.
    if wants_all and school_repo.is_admin_user(current_user):
        schools = school_repo.get_all_schools()
        # Teacher is derived from AdminUsers where Role==0 and SchoolId matches.
        payload = []
        for s in schools:
            teacher = (
                AdminUsers.query
                .filter_by(SchoolId=int(s.Id), Role=0)
                .order_by(AdminUsers.Id.asc())
                .first()
            )
            payload.append(
                {
                    "id": s.Id,
                    "name": s.Name,
                    "teacherId": int(teacher.Id) if teacher else None,
                }
            )
        return jsonify(payload)

    school = school_repo.get_school_by_id(int(school_id))
    if not school:
        return jsonify([])

    return jsonify([{"id": school.Id, "name": school.Name, "teacherId": teacher_id_for_school(int(school.Id))}])


@school_api.route("/me", methods=["GET"])
@jwt_required()
@inject
def get_my_school(
    school_repo: SchoolRepository = Provide[Container.school_repo],
):
    """
    Returns the current user's school as a single object.
    """
    school_id = getattr(current_user, "SchoolId", None)
    if school_id is None:
        return jsonify({}), 404

    school = school_repo.get_school_by_id(int(school_id))
    if not school:
        return jsonify({}), 404

    return jsonify({"id": school.Id, "name": school.Name, "teacherId": teacher_id_for_school(int(school.Id))})

@school_api.route("/admin/summary", methods=["GET"])
@jwt_required()
@inject
def admin_school_summary(
    school_repo: SchoolRepository = Provide[Container.school_repo],
    user_repo: UserRepository = Provide[Container.user_repo],
):
    """
    Admin-only (Role 1) endpoint: returns summary rows for all schools:
      - teacher name/email (from Schools.TeacherID)
      - teamCount (distinct TeamId values among students)
      - studentCount (total students in the school)
    """
    if (not school_repo.is_admin_user(current_user)) or int(getattr(current_user, "Role", 0) or 0) != 1:
        return jsonify({"message": "Unauthorized"}), 403

    schools = school_repo.get_all_schools()
    payload = []

    for s in schools:
        # Teacher is the AdminUsers row for this school with Role == 0 (exclude Role 1 admins)
        teacher = (
            AdminUsers.query
            .filter_by(SchoolId=int(s.Id), Role=0)
            .order_by(AdminUsers.Id.asc())
            .first()
        )

        teacher_name = None
        teacher_email = None
        if teacher:
            first = (getattr(teacher, "Firstname", "") or "").strip()
            last = (getattr(teacher, "Lastname", "") or "").strip()
            teacher_name = (f"{first} {last}").strip() or None
            teacher_email = (getattr(teacher, "Email", None) or "").strip() or None

        students = user_repo.get_students_for_school(int(s.Id))
        team_ids = set()
        for st in students:
            tid = getattr(st, "TeamId", None)
            if tid is None:
                continue
            try:
                tid_int = int(tid)
            except Exception:
                continue
            if tid_int > 0:
                team_ids.add(tid_int)

        payload.append(
            {
                "id": int(s.Id),
                "name": getattr(s, "Name", "") or "",
                "teacherId": int(teacher.Id) if teacher else None,
                "teacherName": teacher_name,
                "teacherEmail": teacher_email,
                "teamCount": len(team_ids),
                "studentCount": len(students),
            }
        )

    payload.sort(key=lambda x: (x.get("name") or "").lower())
    return jsonify(payload)

@school_api.route("/id/<int:school_id>", methods=["GET"])
@jwt_required()
@inject
def get_school_name_from_id(
    school_id: int,
    school_repo: SchoolRepository = Provide[Container.school_repo],
):
    """
    Matches the old shape from /id/<class_id>, but for schools.
    Returns: [{"name": "<school name>"}]
    """
    name = school_repo.get_school_name_with_id(school_id)
    return jsonify([{"name": name}])
