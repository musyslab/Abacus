import string
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
    hasTeams = request.args.get("hasTeams", type=bool) or False
    if hasTeams:
        schools = school_repo.get_all_schools_with_teams()
    else:
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

    return jsonify({
        "id": school.Id,
        "name": school.Name,
        "teacherId": teacher_id_for_school(int(school.Id)),
        "tshirtS": int(getattr(school, "TshirtS", 0) or 0),
        "tshirtM": int(getattr(school, "TshirtM", 0) or 0),
        "tshirtL": int(getattr(school, "TshirtL", 0) or 0),
        "tshirtXL": int(getattr(school, "TshirtXL", 0) or 0),
        "tshirtXXL": int(getattr(school, "TshirtXXL", 0) or 0),
    })

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
        teachers = user_repo.get_teachers_by_school(int(s.Id))
        teacher_data = []
        for t in teachers:
            teacher_id = int(getattr(t, "Id", 0) or 0)
            first = (getattr(t, "Firstname", "") or "").strip()
            last = (getattr(t, "Lastname", "") or "").strip()
            name = (f"{first} {last}").strip() or None
            email = (getattr(t, "Email", None) or "").strip() or None
            teacher_data.append({"id": teacher_id, "name": name, "email": email})

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
                "teachers": teacher_data,
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
    name = school_repo.get_school_name_with_id(school_id)

    school = school_repo.get_school_by_id(school_id)
    
    if not school:
        return jsonify([{"name": name}])
    
    return jsonify([{
        "name": name,
        "tshirtS": int(getattr(school, "TshirtS", 0) or 0),
        "tshirtM": int(getattr(school, "TshirtM", 0) or 0),
        "tshirtL": int(getattr(school, "TshirtL", 0) or 0),
        "tshirtXL": int(getattr(school, "TshirtXL", 0) or 0),
        "tshirtXXL": int(getattr(school, "TshirtXXL", 0) or 0),
    }])

@school_api.route('/tshirts', methods=['PUT'])
@jwt_required()
@inject
def update_school_tshirts(
    school_repo: SchoolRepository = Provide[Container.school_repo],
    user_repo: UserRepository = Provide[Container.user_repo],
):
    from flask import make_response
    from http import HTTPStatus
    
    if not isinstance(current_user, AdminUsers):
        return make_response({'message': 'Unauthorized'}, HTTPStatus.FORBIDDEN)

    data = request.get_json() or {}
    
    school_id = int(getattr(current_user, "SchoolId", 0))
    requested_school_id = data.get("school_id")
    
    if requested_school_id:
        if user_repo.is_admin():
            school_id = requested_school_id
        elif requested_school_id != school_id:
            return make_response({'message': 'Unauthorized'}, HTTPStatus.FORBIDDEN)

    if school_id <= 0:
        return make_response({'message': 'Invalid school ID'}, HTTPStatus.BAD_REQUEST)

    def to_nonneg_int(v, field_name: str):
        try:
            n = int(v)
        except Exception:
            return None, f'{field_name} must be an integer.'
        if n < 0:
            return None, f'{field_name} cannot be negative.'
        return n, None

    tshirtS, err = to_nonneg_int(data.get("tshirtS", 0), "tshirtS")
    if err: return make_response({'message': err}, HTTPStatus.BAD_REQUEST)
    tshirtM, err = to_nonneg_int(data.get("tshirtM", 0), "tshirtM")
    if err: return make_response({'message': err}, HTTPStatus.BAD_REQUEST)
    tshirtL, err = to_nonneg_int(data.get("tshirtL", 0), "tshirtL")
    if err: return make_response({'message': err}, HTTPStatus.BAD_REQUEST)
    tshirtXL, err = to_nonneg_int(data.get("tshirtXL", 0), "tshirtXL")
    if err: return make_response({'message': err}, HTTPStatus.BAD_REQUEST)
    tshirtXXL, err = to_nonneg_int(data.get("tshirtXXL", 0), "tshirtXXL")
    if err: return make_response({'message': err}, HTTPStatus.BAD_REQUEST)

    school_repo.update_school_tshirts(
        school_id,
        tshirtS=tshirtS,
        tshirtM=tshirtM,
        tshirtL=tshirtL,
        tshirtXL=tshirtXL,
        tshirtXXL=tshirtXXL,
    )

    return make_response({'message': 'Success'}, HTTPStatus.OK)
