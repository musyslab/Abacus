import hashlib
from http import HTTPStatus
from flask import Blueprint
from flask import request
from flask import make_response
from src.services.authentication_service import PAMAuthenticationService
from src.repositories.models import AdminUsers, StudentUsers, Schools
from flask_jwt_extended import create_access_token
from src.jwt_manager import jwt
from src.repositories.user_repository import UserRepository
from flask_jwt_extended import jwt_required
from flask_jwt_extended import current_user
from flask import current_app
from src.api_utils import get_value_or_empty
from datetime import datetime
from dependency_injector.wiring import inject, Provide
from container import Container
from src.constants import ADMIN_ROLE
from werkzeug.security import generate_password_hash, check_password_hash

auth_api = Blueprint('auth_api', __name__)


# Register a callback function that takes whatever object is passed in as the
# identity when creating JWTs and converts it to a JSON serializable format.
@jwt.user_identity_loader
def user_identity_lookup(user):
    if isinstance(user, AdminUsers):
        return {"type": "admin", "id": user.Id}
    if isinstance(user, StudentUsers):
        return {"type": "student", "id": user.Id}
    return {"type": "unknown", "id": getattr(user, "Id", None)}

@auth_api.route('/get-role', methods=['GET'])
@jwt_required()
@inject
def get_user_role(user_repo: UserRepository = Provide[Container.user_repo]):
    return user_repo.get_user_status()


# Register a callback function that loades a user from your database whenever
# a protected route is accessed. This should return any python object on a
# successful lookup, or None if the lookup failed for any reason (for example
# if the user has been deleted from the database).
@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    identity = jwt_data["sub"] or {}
    user_type = identity.get("type")
    user_id = identity.get("id")
    if user_type == "admin":
        return AdminUsers.query.filter_by(Id=user_id).one_or_none()
    if user_type == "student":
        return StudentUsers.query.filter_by(Id=user_id).one_or_none()
    return None


@auth_api.route('/admin/login', methods=['POST'])
@inject
def admin_login(user_repo: UserRepository = Provide[Container.user_repo]):
    input_json = request.get_json()
    email = get_value_or_empty(input_json, 'email').strip().lower()
    password = get_value_or_empty(input_json, 'password')

    if user_repo.can_admin_login(email) >= current_app.config['MAX_FAILED_LOGINS']:
        user_repo.lock_admin_account(email)
        return make_response({'message': 'Your account has been locked! Please contact an administrator!'}, HTTPStatus.FORBIDDEN)

    admin = user_repo.get_admin_by_email(email)
    if not admin:
        return make_response({'message': 'No teacher account found for that email.'}, HTTPStatus.NOT_FOUND)

    if not check_password_hash(admin.PasswordHash or "", password):
        user_repo.send_admin_attempt_data(email, request.remote_addr, datetime.now())
        return make_response({'message': 'Invalid email and/or password! Please try again!'}, HTTPStatus.FORBIDDEN)

    user_repo.clear_admin_failed_attempts(email)
    access_token = create_access_token(identity=admin)
    return make_response({'message': 'Success', 'access_token': access_token, 'role': 1}, HTTPStatus.OK)


@auth_api.route('/student/login', methods=['POST'])
@inject
def student_login(user_repo: UserRepository = Provide[Container.user_repo]):
    input_json = request.get_json()
    email = get_value_or_empty(input_json, 'email').strip().lower()
    password = get_value_or_empty(input_json, 'password')

    email_hash = hashlib.sha256(email.encode("utf-8")).hexdigest()

    if user_repo.can_student_login(email_hash) >= current_app.config['MAX_FAILED_LOGINS']:
        user_repo.lock_student_account(email_hash)
        return make_response({'message': 'Your account has been locked! Please contact an administrator!'}, HTTPStatus.FORBIDDEN)

    student = user_repo.get_student_by_emailhash(email_hash)
    if not student:
        return make_response({'message': 'No student account found for that email.'}, HTTPStatus.NOT_FOUND)

    if not check_password_hash(student.PasswordHash or "", password):
        user_repo.send_student_attempt_data(email_hash, request.remote_addr, datetime.now())
        return make_response({'message': 'Invalid email and/or password! Please try again!'}, HTTPStatus.FORBIDDEN)

    user_repo.clear_student_failed_attempts(email_hash)
    access_token = create_access_token(identity=student)
    return make_response({'message': 'Success', 'access_token': access_token, 'role': 0}, HTTPStatus.OK)

@auth_api.route('/register', methods=['POST'])
@inject
def register_user(user_repo: UserRepository = Provide[Container.user_repo]):
    input_json = request.get_json()

    first_name = get_value_or_empty(input_json, 'fname')
    last_name = get_value_or_empty(input_json, 'lname')
    school = get_value_or_empty(input_json, 'school')
    email = get_value_or_empty(input_json, 'email')
    password = get_value_or_empty(input_json, 'password')

    if not (first_name and last_name and school and email and password):
        message = {'message': 'Missing required data. All fields are required.'}
        return make_response(message, HTTPStatus.NOT_ACCEPTABLE)

    if user_repo.does_admin_email_exist(email):
        message = {'message': 'Teacher already exists'}
        return make_response(message, HTTPStatus.NOT_ACCEPTABLE)

    password_hash = generate_password_hash(password)  # PBKDF2 by default in Werkzeug

    # Create school first, then the admin user, then bind TeacherID on the school
    school_obj = user_repo.create_school(school)
    admin = user_repo.create_admin_user(email, first_name, last_name, school_obj.Id, password_hash)
    user_repo.set_school_teacher(school_obj.Id, admin.Id)

    access_token = create_access_token(identity=admin)

    message = {
        'message': 'Success',
        'access_token': access_token,
        'role': 1
    }
    return make_response(message, HTTPStatus.OK)

@auth_api.route('/student/create', methods=['POST'])
@jwt_required()
@inject
def create_student_user(user_repo: UserRepository = Provide[Container.user_repo]):
    # Must be called by an admin (teacher)
    if not isinstance(current_user, AdminUsers):
        return make_response({'message': 'Unauthorized'}, HTTPStatus.FORBIDDEN)

    input_json = request.get_json()
    email = get_value_or_empty(input_json, 'email').strip().lower()
    password = get_value_or_empty(input_json, 'password')
    team_id = int(get_value_or_empty(input_json, 'team_id') or 0)
    member_id = int(get_value_or_empty(input_json, 'member_id') or 0)

    if not (email and password):
        return make_response({'message': 'Missing required data. Email and password are required.'}, HTTPStatus.NOT_ACCEPTABLE)

    email_hash = hashlib.sha256(email.encode("utf-8")).hexdigest()
    if user_repo.does_student_emailhash_exist(email_hash):
        return make_response({'message': 'Student already exists'}, HTTPStatus.NOT_ACCEPTABLE)

    password_hash = generate_password_hash(password)
    student = user_repo.create_student_user(
        email_hash=email_hash,
        teacher_id=current_user.Id,
        school_id=current_user.SchoolId,
        team_id=team_id,
        member_id=member_id,
        password_hash=password_hash,
    )

    return make_response({'message': 'Success', 'student_id': student.Id}, HTTPStatus.OK)