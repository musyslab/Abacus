from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, current_user
from dependency_injector.wiring import inject, Provide
from container import Container

from src.repositories.school_repository import SchoolRepository

school_api = Blueprint("school_api", __name__)

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
        return jsonify([{"id": s.Id, "name": s.Name, "teacherId": s.TeacherID} for s in schools])

    school = school_repo.get_school_by_id(int(school_id))
    if not school:
        return jsonify([])

    return jsonify([{"id": school.Id, "name": school.Name, "teacherId": school.TeacherID}])


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

    return jsonify({"id": school.Id, "name": school.Name, "teacherId": school.TeacherID})


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
