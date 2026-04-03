from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, current_user
from datetime import datetime

from src.repositories.database import db
from src.repositories.models import GoldDivision, StudentUsers, AdminUsers

gold_division_api = Blueprint('gold_division_api', __name__)


def is_site_admin(user) -> bool:
    return isinstance(user, AdminUsers) and int(getattr(user, "Role", 0) or 0) == 1


def is_teacher(user) -> bool:
    return isinstance(user, AdminUsers) and int(getattr(user, "Role", 0) or 0) == 0


# -----------------------------
# STUDENT: submit project
# -----------------------------
@gold_division_api.route('/create', methods=['POST'])
@jwt_required()
def create_gold_submission():

    if not isinstance(current_user, StudentUsers):
        return jsonify({'message': 'Only students can submit'}), 403

    data = request.get_json()
    scratch_link = (data.get("scratch_link") or "").strip()

    if not scratch_link:
        return jsonify({'message': 'Missing Scratch link'}), 400

    existing = GoldDivision.query.filter_by(StudentId=current_user.Id).first()

    if existing:
        existing.Link = scratch_link
        existing.SubmittedAt = datetime.utcnow()
    else:
        new_submission = GoldDivision(
            Link=scratch_link,
            StudentId=current_user.Id,
            SubmittedAt=datetime.utcnow(),
        )
        db.session.add(new_submission)

    db.session.commit()

    return jsonify({'message': 'Submission saved'}), 200


# -----------------------------
# ADMIN / TEACHER: get visible submissions
# Admins see all submissions + grades + claim state
# Teachers see only their students' submissions, and
# cannot see points/feedback or grading state
# -----------------------------
@gold_division_api.route('/visible', methods=['GET'])
@jwt_required()
def get_visible_submissions():

    if not isinstance(current_user, AdminUsers):
        return jsonify({'message': 'Admins/teachers only'}), 403

    if is_site_admin(current_user):
        submissions = GoldDivision.query.order_by(GoldDivision.SubmittedAt.desc()).all()

        result = []
        for s in submissions:
            result.append({
                "id": s.Id,
                "link": s.Link,
                "studentId": s.StudentId,
                "submittedAt": s.SubmittedAt,
                "points": s.Points,
                "feedback": s.Feedback,
                "adminGraderId": s.AdminGraderId,
            })

        return jsonify({
            "currentAdminId": current_user.Id,
            "canGrade": True,
            "isTeacherView": False,
            "submissions": result,
        }), 200

    if is_teacher(current_user):
        submissions = (
            GoldDivision.query
            .join(StudentUsers, StudentUsers.Id == GoldDivision.StudentId)
            .filter(StudentUsers.TeacherId == current_user.Id)
            .order_by(GoldDivision.SubmittedAt.desc())
            .all()
        )

        result = []
        for s in submissions:
            result.append({
                "id": s.Id,
                "link": s.Link,
                "studentId": s.StudentId,
                "submittedAt": s.SubmittedAt,
                "points": None,
                "feedback": None,
                "adminGraderId": None,
            })

        return jsonify({
            "currentAdminId": None,
            "canGrade": False,
            "isTeacherView": True,
            "submissions": result,
        }), 200

    return jsonify({'message': 'Admins/teachers only'}), 403


# -----------------------------
# ADMIN: get all submissions
# Kept for compatibility, but restricted to site admins
# -----------------------------
@gold_division_api.route('/all', methods=['GET'])
@jwt_required()
def get_all_submissions():

    if not is_site_admin(current_user):
        return jsonify({'message': 'Admins only'}), 403

    submissions = GoldDivision.query.order_by(GoldDivision.SubmittedAt.desc()).all()

    result = []
    for s in submissions:
        result.append({
            "id": s.Id,
            "link": s.Link,
            "studentId": s.StudentId,
            "submittedAt": s.SubmittedAt,
            "points": s.Points,
            "feedback": s.Feedback,
            "adminGraderId": s.AdminGraderId
        })

    return jsonify({
        "currentAdminId": current_user.Id,
        "submissions": result
    }), 200


# -----------------------------
# ADMIN: claim submission
# -----------------------------
@gold_division_api.route('/claim/<int:submission_id>', methods=['POST'])
@jwt_required()
def claim_submission(submission_id):

    if not is_site_admin(current_user):
        return jsonify({'message': 'Admins only'}), 403

    submission = GoldDivision.query.get(submission_id)

    if not submission:
        return jsonify({'message': 'Submission not found'}), 404

    if submission.AdminGraderId is not None:
        return jsonify({'message': 'Already claimed'}), 400

    submission.AdminGraderId = current_user.Id
    db.session.commit()

    return jsonify({'message': 'Claimed successfully'}), 200


# -----------------------------
# ADMIN: unclaim submission
# -----------------------------
@gold_division_api.route('/unclaim/<int:submission_id>', methods=['POST'])
@jwt_required()
def unclaim_submission(submission_id):

    if not is_site_admin(current_user):
        return jsonify({'message': 'Admins only'}), 403

    submission = GoldDivision.query.get(submission_id)

    if not submission:
        return jsonify({'message': 'Submission not found'}), 404

    if submission.AdminGraderId != current_user.Id:
        return jsonify({'message': 'You can only unclaim your own submissions'}), 403

    submission.AdminGraderId = None
    db.session.commit()

    return jsonify({'message': 'Unclaimed successfully'}), 200


# -----------------------------
# ADMIN: grade
# -----------------------------
@gold_division_api.route('/grade/<int:submission_id>', methods=['POST'])
@jwt_required()
def grade_submission(submission_id):

    if not is_site_admin(current_user):
        return jsonify({'message': 'Admins only'}), 403

    submission = GoldDivision.query.get(submission_id)

    if not submission:
        return jsonify({'message': 'Submission not found'}), 404

    if submission.AdminGraderId != current_user.Id:
        return jsonify({'message': 'You must claim before grading'}), 403

    data = request.get_json()
    points = data.get("points")
    feedback = data.get("feedback")

    submission.Points = points
    submission.Feedback = feedback

    db.session.commit()

    return jsonify({'message': 'Points & feedback saved'}), 200


# -----------------------------
# STUDENT: get own submission
# -----------------------------
@gold_division_api.route('/my', methods=['GET'])
@jwt_required()
def get_my_submission():

    if not isinstance(current_user, StudentUsers):
        return jsonify({'message': 'Students only'}), 403

    submission = GoldDivision.query.filter_by(StudentId=current_user.Id).first()

    if not submission:
        return jsonify(None), 200

    return jsonify({
        "id": submission.Id,
        "link": submission.Link,
        "points": submission.Points,
        "feedback": submission.Feedback,
        "submittedAt": submission.SubmittedAt
    }), 200