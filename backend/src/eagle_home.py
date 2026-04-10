import os
from http import HTTPStatus

from dependency_injector.wiring import Provide, inject
from flask import Blueprint, current_app, jsonify, make_response, request, send_file
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import asc, desc

from container import Container
from src.constants import (
    ADMIN_ROLE,
    TEACHER_ROLE,
    can_student_access_competition_materials,
)
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


def _staff_role() -> int | None:
    if not isinstance(current_user, AdminUsers):
        return None
    return int(getattr(current_user, "Role", TEACHER_ROLE) or TEACHER_ROLE)


def _visible_eagle_teams_query():
    if not isinstance(current_user, AdminUsers):
        return None

    teams_query = Teams.query.filter(Teams.Division == "Eagle")
    if _staff_role() == TEACHER_ROLE:
        teams_query = teams_query.filter(
            Teams.SchoolId == int(getattr(current_user, "SchoolId", 0) or 0)
        )

    return teams_query


def _message_sender_role(message) -> str | None:
    if message is None:
        return None

    sender_type = (getattr(message, "SenderType", "") or "").strip().lower()
    if sender_type == "student":
        return "student"

    admin_id = int(getattr(message, "AdminId", 0) or 0)
    admin = AdminUsers.query.filter_by(Id=admin_id).first() if admin_id > 0 else None
    admin_role = int(getattr(admin, "Role", TEACHER_ROLE) or TEACHER_ROLE) if admin else ADMIN_ROLE
    return "admin" if admin_role == ADMIN_ROLE else "teacher"


def _conversation_stage(message_count: int, last_sender_role: str | None) -> str:
    if message_count <= 0:
        return "no_messages"

    if last_sender_role == "student":
        return "needs_admin_reply"

    return "waiting_for_requester"


def _eagle_instructions_path() -> tuple[str | None, str]:
    """Resolve PDF under tabot-files/eagledivision (dev: repo sibling; prod: /tabot-files mount)."""
    download_name = "Eagle-Division-2026.pdf"
    candidates = ("Eagle-Division-2026.pdf", "Eagle-Division-2026.pdf.pdf")
    bases = [
        os.path.abspath(
            os.path.join(current_app.root_path, "..", "tabot-files", "eagledivision")
        ),
        "/tabot-files/eagledivision",
    ]
    for base in bases:
        for name in candidates:
            full = os.path.join(base, name)
            if os.path.isfile(full):
                return full, download_name
    return None, download_name


@eagle_api.route("/instructions", methods=["GET"])
@jwt_required()
def download_eagle_instructions():
    if isinstance(current_user, StudentUsers):
        _, err = _student_eagle_team()
        if err:
            return err
        if not can_student_access_competition_materials():
            return make_response(
                {
                    "message": "Problem materials are only available during the competition and after submissions unlock."
                },
                HTTPStatus.FORBIDDEN,
            )
    elif not _is_global_admin():
        return make_response({"message": "Unauthorized"}, HTTPStatus.FORBIDDEN)

    path, download_name = _eagle_instructions_path()
    if not path:
        return make_response(
            {"message": "Eagle instructions PDF is not available on the server."},
            HTTPStatus.NOT_FOUND,
        )

    return send_file(
        path,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=download_name,
    )


@eagle_api.route("/teams", methods=["GET"])
@jwt_required()
def list_eagle_teams():
    teams_query = _visible_eagle_teams_query()
    if teams_query is None:
        return make_response({"message": "Admin access required"}, HTTPStatus.FORBIDDEN)

    teams = teams_query.order_by(asc(Teams.SchoolId), asc(Teams.TeamNumber)).all()
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


@eagle_api.route("/conversations", methods=["GET"])
@jwt_required()
def list_eagle_conversations():
    teams_query = _visible_eagle_teams_query()
    if teams_query is None:
        return make_response({"message": "Unauthorized"}, HTTPStatus.FORBIDDEN)

    teams = teams_query.order_by(asc(Teams.SchoolId), asc(Teams.TeamNumber)).all()
    payload = []

    for team in teams:
        latest_message = (
            EagleTeamMessages.query
            .filter(EagleTeamMessages.TeamId == int(team.Id))
            .order_by(desc(EagleTeamMessages.CreatedAt), desc(EagleTeamMessages.Id))
            .first()
        )
        message_count = (
            EagleTeamMessages.query
            .filter(EagleTeamMessages.TeamId == int(team.Id))
            .count()
        )

        last_sender_role = _message_sender_role(latest_message)
        payload.append(
            {
                "teamId": int(team.Id),
                "teamName": str(getattr(team, "Name", "") or f"Team {team.Id}").strip(),
                "teamNumber": int(getattr(team, "TeamNumber", 0) or 0),
                "schoolId": int(getattr(team, "SchoolId", 0) or 0),
                "lastMessagePreview": (
                    str(getattr(latest_message, "Body", "") or "").strip()[:140]
                    if latest_message else None
                ),
                "lastMessageAt": (
                    latest_message.CreatedAt.isoformat(sep=" ", timespec="seconds")
                    if latest_message and getattr(latest_message, "CreatedAt", None)
                    else None
                ),
                "lastSenderRole": last_sender_role,
                "conversationStage": _conversation_stage(message_count, last_sender_role),
                "messageCount": message_count,
            }
        )

    return jsonify(payload)


@eagle_api.route("/messages", methods=["GET"])
@jwt_required()
def get_messages():
    team_id: int | None = None
    if isinstance(current_user, StudentUsers):
        team, err = _student_eagle_team()
        if err:
            return err
        team_id = int(team.Id)
    elif isinstance(current_user, AdminUsers):
        team_id = request.args.get("team_id", type=int)
        if not team_id:
            return make_response({"message": "team_id is required"}, HTTPStatus.BAD_REQUEST)
        team = Teams.query.filter_by(Id=team_id, Division="Eagle").first()
        if not team:
            return make_response({"message": "Eagle team not found"}, HTTPStatus.NOT_FOUND)

        role = _staff_role()
        if role == TEACHER_ROLE and int(getattr(team, "SchoolId", 0) or 0) != int(getattr(current_user, "SchoolId", 0) or 0):
            return make_response({"message": "Unauthorized"}, HTTPStatus.FORBIDDEN)
    else:
        return make_response({"message": "Unauthorized"}, HTTPStatus.FORBIDDEN)

    rows = (
        EagleTeamMessages.query.filter_by(TeamId=team_id)
        .order_by(asc(EagleTeamMessages.CreatedAt), asc(EagleTeamMessages.Id))
        .all()
    )
    admin_ids = {int(m.AdminId) for m in rows if m.AdminId is not None}
    role_by_admin: dict[int, int] = {}
    if admin_ids:
        for u in AdminUsers.query.filter(AdminUsers.Id.in_(admin_ids)).all():
            role_by_admin[int(u.Id)] = int(getattr(u, "Role", TEACHER_ROLE) or TEACHER_ROLE)

    out = []
    for m in rows:
        st = (m.SenderType or "").lower()
        if st == "student":
            sender = "student"
            sender_role = "student"
        else:
            sender = "admin"
            rid = int(m.AdminId) if m.AdminId is not None else None
            ar = role_by_admin.get(rid, ADMIN_ROLE) if rid is not None else ADMIN_ROLE
            sender_role = "admin" if ar == ADMIN_ROLE else "teacher"
        out.append(
            {
                "id": m.Id,
                "sender": sender,
                "senderRole": sender_role,
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

    if isinstance(current_user, AdminUsers):
        role = _staff_role()
        if role != ADMIN_ROLE:
            return make_response(
                {"message": "Teachers can view Eagle chat threads but cannot send messages."},
                HTTPStatus.FORBIDDEN,
            )

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
        if not can_student_access_competition_materials():
            return make_response(
                {
                    "message": "Problem materials are only available during the competition and after submissions unlock."
                },
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
                "hint": None,
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