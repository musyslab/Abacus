import datetime
from typing import List, Optional, Union

from src.repositories.database import db
from .models import AdminUsers, StudentUsers, Schools, LoginAttempts
from flask_jwt_extended import current_user


UserModel = Union[AdminUsers, StudentUsers]


class UserRepository:
    def get_user_status(self) -> str:
        if isinstance(current_user, AdminUsers):
            return "admin"
        if isinstance(current_user, StudentUsers):
            return "student"
        return "unknown"

    # -----------------------------
    # Admin (Teacher) operations
    # -----------------------------
    def get_admin_by_email(self, email: str) -> Optional[AdminUsers]:
        return AdminUsers.query.filter(AdminUsers.Email == email).one_or_none()

    def get_admin_by_id(self, user_id: int) -> Optional[AdminUsers]:
        return AdminUsers.query.filter(AdminUsers.Id == user_id).one_or_none()

    def does_admin_email_exist(self, email: str) -> bool:
        return AdminUsers.query.filter(AdminUsers.Email == email).first() is not None

    def create_admin_user(
        self,
        email: str,
        first_name: str,
        last_name: str,
        school_id: int,
        password_hash: str,
    ) -> AdminUsers:
        admin = AdminUsers(
            Firstname=first_name,
            Lastname=last_name,
            Email=email,
            SchoolId=school_id,
            PasswordHash=password_hash,
            IsLocked=False,
        )
        db.session.add(admin)
        db.session.commit()
        return admin

    def send_admin_attempt_data(self, email: str, ipadr: str, time: datetime.datetime):
        login_attempt = LoginAttempts(IPAddress=ipadr, Email=email, Time=time)
        db.session.add(login_attempt)
        db.session.commit()

    def can_admin_login(self, email: str) -> int:
        return LoginAttempts.query.filter(LoginAttempts.Email == email).count()

    def clear_admin_failed_attempts(self, email: str):
        attempts = LoginAttempts.query.filter(LoginAttempts.Email == email).all()
        for attempt in attempts:
            db.session.delete(attempt)
        db.session.commit()

    def lock_admin_account(self, email: str):
        admin = AdminUsers.query.filter(AdminUsers.Email == email).one()
        admin.IsLocked = True
        db.session.commit()

    def set_admin_password_and_unlock(self, admin_id: int, password_hash: str) -> None:
        """
        Sets an admin password, unlocks the account, and clears failed login attempts.
        """
        admin = AdminUsers.query.filter(AdminUsers.Id == admin_id).one()
        admin.PasswordHash = password_hash
        admin.IsLocked = False
        db.session.commit()

        attempts = LoginAttempts.query.filter(LoginAttempts.Email == admin.Email).all()
        for attempt in attempts:
            db.session.delete(attempt)
        db.session.commit()

    # -----------------------------
    # Student operations
    # -----------------------------

    def get_students_for_teacher(self, teacher_id: int) -> List[StudentUsers]:
        return (
            StudentUsers.query.filter(StudentUsers.TeacherId == teacher_id)
            .order_by(StudentUsers.TeamId.asc(), StudentUsers.MemberId.asc())
            .all()
        )

    def get_student_by_team_member(self, teacher_id: int, team_id: int, member_id: int) -> Optional[StudentUsers]:
        return (
            StudentUsers.query.filter(
                StudentUsers.TeacherId == teacher_id,
                StudentUsers.TeamId == team_id,
                StudentUsers.MemberId == member_id,
            )
            .one_or_none()
        )

    def count_team_members(self, teacher_id: int, team_id: int) -> int:
        return (
            StudentUsers.query.filter(StudentUsers.TeacherId == teacher_id, StudentUsers.TeamId == team_id)
            .count()
        )

    def get_student_by_emailhash(self, email_hash: str) -> Optional[StudentUsers]:
        return StudentUsers.query.filter(StudentUsers.EmailHash == email_hash).one_or_none()

    def get_student_by_id(self, user_id: int) -> Optional[StudentUsers]:
        return StudentUsers.query.filter(StudentUsers.Id == user_id).one_or_none()

    def does_student_emailhash_exist(self, email_hash: str) -> bool:
        return StudentUsers.query.filter(StudentUsers.EmailHash == email_hash).first() is not None

    def create_student_user(
        self,
        email_hash: str,
        teacher_id: int,
        school_id: int,
        team_id: int,
        member_id: int,
        password_hash: Optional[str] = None,
    ) -> StudentUsers:
        student = StudentUsers(
            EmailHash=email_hash,
            TeacherId=teacher_id,
            SchoolId=school_id,
            TeamId=team_id,
            MemberId=member_id,
            PasswordHash=password_hash,
            IsLocked=False,
        )
        db.session.add(student)
        db.session.commit()
        return student

    # Student login attempts use EmailHash as the identifier stored in LoginAttempts.Email
    def send_student_attempt_data(self, email_hash: str, ipadr: str, time: datetime.datetime):
        login_attempt = LoginAttempts(IPAddress=ipadr, Email=email_hash, Time=time)
        db.session.add(login_attempt)
        db.session.commit()

    def can_student_login(self, email_hash: str) -> int:
        return LoginAttempts.query.filter(LoginAttempts.Email == email_hash).count()

    def clear_student_failed_attempts(self, email_hash: str):
        attempts = LoginAttempts.query.filter(LoginAttempts.Email == email_hash).all()
        for attempt in attempts:
            db.session.delete(attempt)
        db.session.commit()

    def lock_student_account(self, email_hash: str):
        student = StudentUsers.query.filter(StudentUsers.EmailHash == email_hash).one()
        student.IsLocked = True
        db.session.commit()

    def delete_student(self, student_id: int) -> None:
        student = StudentUsers.query.filter(StudentUsers.Id == student_id).one_or_none()
        if not student:
            return
        db.session.delete(student)
        db.session.commit()

    def unlock_student_account(self, student_id: int):
        """
        Unlocks a student account and clears login attempts stored under that student's EmailHash.
        """
        student = StudentUsers.query.filter(StudentUsers.Id == student_id).one()
        student.IsLocked = False
        db.session.commit()

        attempts = LoginAttempts.query.filter(LoginAttempts.Email == student.EmailHash).all()
        for attempt in attempts:
            db.session.delete(attempt)
        db.session.commit()

    def set_student_password_and_unlock(self, student_id: int, password_hash: str) -> None:
        """
        Sets a student password, unlocks the account, and clears failed login attempts.
        """
        student = StudentUsers.query.filter(StudentUsers.Id == student_id).one()
        student.PasswordHash = password_hash
        student.IsLocked = False
        db.session.commit()

        attempts = LoginAttempts.query.filter(LoginAttempts.Email == student.EmailHash).all()
        for attempt in attempts:
            db.session.delete(attempt)
        db.session.commit()

    # -----------------------------
    # School operations (kept here because your auth flow uses them)
    # -----------------------------
    def create_school(self, name: str) -> Schools:
        school = Schools(Name=name, TeacherID=None)
        db.session.add(school)
        db.session.commit()
        return school

    def set_school_teacher(self, school_id: int, teacher_id: int) -> None:
        school = Schools.query.filter(Schools.Id == school_id).one()
        school.TeacherID = teacher_id
        db.session.commit()

    # -----------------------------
    # Compatibility helpers / old call sites
    # -----------------------------
    def get_user(self, user_id: int) -> Optional[UserModel]:
        """
        Compatibility method: returns an AdminUsers or StudentUsers with this ID, or None.
        Prefer get_admin_by_id / get_student_by_id when you know the type.
        """
        admin = self.get_admin_by_id(user_id)
        if admin is not None:
            return admin
        return self.get_student_by_id(user_id)

    def get_user_by_id(self, user_id: int) -> Optional[UserModel]:
        """
        Compatibility alias for older code.
        """
        return self.get_user(user_id)

    def get_all_users(self) -> List[UserModel]:
        """
        Returns all users across both tables.
        """
        return list(AdminUsers.query.all()) + list(StudentUsers.query.all())

    def get_user_email(self, user_id: int) -> str:
        """
        AdminUsers store Email in plaintext.
        StudentUsers do not (they store EmailHash only), so return "" for students.
        """
        admin = self.get_admin_by_id(user_id)
        if admin is not None:
            return admin.Email
        return ""