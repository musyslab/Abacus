from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, current_user
from datetime import datetime

from src.repositories.database import db
from src.repositories.models import GoldDivision, StudentUsers

gold_division_api = Blueprint('gold_division_api', __name__)


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