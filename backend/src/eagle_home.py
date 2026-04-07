from http import HTTPStatus

from dependency_injector.wiring import Provide, inject
from flask import Blueprint, jsonify, make_response, request
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import asc

from container import Container
from src.constants import ADMIN_ROLE, is_student_submission_locked
from src.repositories.database import db
from src.repositories.models import AdminUsers, EagleTeamMessages, StudentUsers, Teams
from src.repositories.project_repository import ProjectRepository

eagle_api = Blueprint("eagle_api", __name__)


def _is_global_admin() -> bool:
    return (
        isinstance(current_user, AdminUsers)
        and int(getattr(current_user, "Role", 0) or 0) == ADMIN_ROLE
    )


def _student_eagle_team() -> tuple[Teams | None, object | None]:
    if not isinstance(current_user, StudentUsers):
        return None, make_response({"message": "Unauthorized"}, HTTPStatus.FORBIDDEN)
    team = Teams.query.filter_by(Id=int(current_user.TeamId)).first()
    if not team or (team.Division or "").strip() != "Eagle":
        return None, make_response(
            {"message": "This page is only for Eagle Division teams."},
            HTTPStatus.FORBIDDEN,
        )
    return team, None


@eagle_api.route("/teams", methods=["GET"])
@jwt_required()
def list_eagle_teams():
    if not _is_global_admin():
        return make_response({"message": "Admin access required"}, HTTPStatus.FORBIDDEN)
    teams = (
        Teams.query.filter(Teams.Division == "Eagle")
        .order_by(asc(Teams.SchoolId), asc(Teams.TeamNumber))
        .all()
    )
    return jsonify(
        [
            {
                "id": t.Id,
                "name": t.Name,
                "teamNumber": t.TeamNumber,
                "schoolId": t.SchoolId,
            }
            for t in teams
        ]
    )


@eagle_api.route("/messages", methods=["GET"])
@jwt_required()
def get_messages():
    team_id: int | None = None
    if isinstance(current_user, StudentUsers):
        team, err = _student_eagle_team()
        if err:
            return err
        team_id = int(team.Id)
    elif _is_global_admin():
        team_id = request.args.get("team_id", type=int)
        if not team_id:
            return make_response({"message": "team_id is required"}, HTTPStatus.BAD_REQUEST)
        team = Teams.query.filter_by(Id=team_id, Division="Eagle").first()
        if not team:
            return make_response({"message": "Eagle team not found"}, HTTPStatus.NOT_FOUND)
    else:
        return make_response({"message": "Unauthorized"}, HTTPStatus.FORBIDDEN)

    rows = (
        EagleTeamMessages.query.filter_by(TeamId=team_id)
        .order_by(asc(EagleTeamMessages.CreatedAt), asc(EagleTeamMessages.Id))
        .all()
    )
    out = []
    for m in rows:
        sender = "admin" if (m.SenderType or "").lower() == "admin" else "student"
        out.append(
            {
                "id": m.Id,
                "sender": sender,
                "body": m.Body,
                "createdAt": m.CreatedAt.isoformat(sep=" ", timespec="seconds") if m.CreatedAt else "",
            }
        )
    return jsonify(out)


@eagle_api.route("/messages", methods=["POST"])
@jwt_required()
def post_message():
    data = request.get_json() or {}
    body = (data.get("body") or "").strip()
    if not body:
        return make_response({"message": "Message body is required."}, HTTPStatus.BAD_REQUEST)

    if isinstance(current_user, StudentUsers):
        team, err = _student_eagle_team()
        if err:
            return err
        msg = EagleTeamMessages(
            TeamId=int(team.Id),
            SenderType="student",
            StudentId=int(current_user.Id),
            AdminId=None,
            Body=body,
        )
        db.session.add(msg)
        db.session.commit()
        return jsonify({"id": msg.Id, "ok": True}), HTTPStatus.CREATED

    if _is_global_admin():
        team_id = data.get("team_id")
        try:
            tid = int(team_id)
        except (TypeError, ValueError):
            return make_response({"message": "team_id is required"}, HTTPStatus.BAD_REQUEST)
        team = Teams.query.filter_by(Id=tid, Division="Eagle").first()
        if not team:
            return make_response({"message": "Eagle team not found"}, HTTPStatus.NOT_FOUND)
        msg = EagleTeamMessages(
            TeamId=tid,
            SenderType="admin",
            StudentId=None,
            AdminId=int(current_user.Id),
            Body=body,
        )
        db.session.add(msg)
        db.session.commit()
        return jsonify({"id": msg.Id, "ok": True}), HTTPStatus.CREATED

    return make_response({"message": "Unauthorized"}, HTTPStatus.FORBIDDEN)


@eagle_api.route("/problem", methods=["GET"])
@jwt_required()
@inject
def eagle_problem(project_repo: ProjectRepository = Provide[Container.project_repo]):
    if isinstance(current_user, StudentUsers):
        _, err = _student_eagle_team()
        if err:
            return err
        if is_student_submission_locked():
            return make_response(
                {"message": "Problem materials are not available during this phase."},
                HTTPStatus.FORBIDDEN,
            )
    elif not _is_global_admin():
        return make_response({"message": "Unauthorized"}, HTTPStatus.FORBIDDEN)

    proj = project_repo.get_eagle_competition_project()
    if not proj:
        return jsonify(
            {
                "projectId": None,
                "name": None,
                "preview": None,
                "previewKind": "none",
                "filename": None,
                "hint": 'Create a competition project, or name one with "Eagle" in the title.',
            }
        )

    pid = int(proj.Id)
    preview = project_repo.get_assignment_preview_for_ui(pid)
    return jsonify(
        {
            "projectId": pid,
            "name": proj.Name,
            "preview": preview.get("text"),
            "previewKind": preview.get("kind"),
            "filename": preview.get("filename"),
            "hint": None,
        }
    )
