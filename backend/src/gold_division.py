from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, current_user
from datetime import datetime

from src.repositories.database import db
from src.repositories.models import GoldDivision, StudentUsers, AdminUsers

gold_division_api = Blueprint('gold_division_api', __name__)


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
# ADMIN: get all submissions
# -----------------------------
@gold_division_api.route('/all', methods=['GET'])
@jwt_required()
def get_all_submissions():

    if not isinstance(current_user, AdminUsers):
        return jsonify({'message': 'Admins only'}), 403

    submissions = GoldDivision.query.all()

    result = []
    for s in submissions:
        result.append({
            "id": s.Id,
            "link": s.Link,
            "studentId": s.StudentId,
            "submittedAt": s.SubmittedAt,
            "grade": s.Grade,
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

    if not isinstance(current_user, AdminUsers):
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

    if not isinstance(current_user, AdminUsers):
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
# ADMIN: grade submission
# -----------------------------
@gold_division_api.route('/grade/<int:submission_id>', methods=['POST'])
@jwt_required()
def grade_submission(submission_id):

    if not isinstance(current_user, AdminUsers):
        return jsonify({'message': 'Admins only'}), 403

    submission = GoldDivision.query.get(submission_id)

    if not submission:
        return jsonify({'message': 'Submission not found'}), 404

    if submission.AdminGraderId != current_user.Id:
        return jsonify({'message': 'You must claim before grading'}), 403

    data = request.get_json()
    grade = data.get("grade")

    submission.Grade = grade
    db.session.commit()

    return jsonify({'message': 'Grade saved'}), 200


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
        "grade": submission.Grade,
        "submittedAt": submission.SubmittedAt
    }), 200