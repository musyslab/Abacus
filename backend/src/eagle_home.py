import os
from http import HTTPStatus

from dependency_injector.wiring import Provide, inject
from flask import Blueprint, current_app, jsonify, make_response, request, send_file
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import asc, desc

from container import Container
from src.constants import ADMIN_ROLE, TEACHER_ROLE, is_student_submission_locked
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
        if is_student_submission_locked():
            return make_response(
                {"message": "Problem materials are not available during this phase."},
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


@eagle_api.route("/inbox", methods=["GET"])
@jwt_required()
def eagle_inbox():
    if not isinstance(current_user, AdminUsers):
        return make_response({"message": "Unauthorized"}, HTTPStatus.FORBIDDEN)

    role = _staff_role()
    school_id = int(getattr(current_user, "SchoolId", 0) or 0)

    team_q = Teams.query.filter(Teams.Division == "Eagle")
    if role == TEACHER_ROLE:
        team_q = team_q.filter(Teams.SchoolId == school_id)

    teams = team_q.order_by(asc(Teams.SchoolId), asc(Teams.TeamNumber)).all()

    out = []
    for t in teams:
        latest = (
            EagleTeamMessages.query.filter_by(TeamId=int(t.Id))
            .order_by(desc(EagleTeamMessages.CreatedAt), desc(EagleTeamMessages.Id))
            .first()
        )
        if not latest:
            continue

        st = (latest.SenderType or "").lower()
        if st == "student":
            sender_role = "student"
        else:
            aid = int(latest.AdminId) if latest.AdminId is not None else None
            if aid is None:
                sender_role = "admin"
            else:
                u = AdminUsers.query.filter_by(Id=aid).first()
                ar = int(getattr(u, "Role", ADMIN_ROLE) or ADMIN_ROLE) if u else ADMIN_ROLE
                sender_role = "admin" if ar == ADMIN_ROLE else "teacher"

        body = str(latest.Body or "")
        preview = (body[:140] + "…") if len(body) > 140 else body

        out.append(
            {
                "teamId": int(t.Id),
                "teamNumber": int(getattr(t, "TeamNumber", 0) or 0),
                "teamName": str(getattr(t, "Name", "") or ""),
                "schoolId": int(getattr(t, "SchoolId", 0) or 0),
                "lastMessageId": int(latest.Id),
                "lastMessageAt": latest.CreatedAt.isoformat(sep=" ", timespec="seconds") if latest.CreatedAt else "",
                "lastSenderRole": sender_role,
                "lastPreview": preview,
            }
        )

    out.sort(key=lambda x: x.get("lastMessageAt", ""), reverse=True)
    return jsonify(out)


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
        team_id = data.get("team_id")
        try:
            tid = int(team_id)
        except (TypeError, ValueError):
            return make_response({"message": "team_id is required"}, HTTPStatus.BAD_REQUEST)
        team = Teams.query.filter_by(Id=tid, Division="Eagle").first()
        if not team:
            return make_response({"message": "Eagle team not found"}, HTTPStatus.NOT_FOUND)

        role = _staff_role()
        if role == TEACHER_ROLE and int(getattr(team, "SchoolId", 0) or 0) != int(getattr(current_user, "SchoolId", 0) or 0):
            return make_response({"message": "Unauthorized"}, HTTPStatus.FORBIDDEN)

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
