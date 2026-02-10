from typing import List, Optional

from src.repositories.database import db
from .models import AdminUsers, StudentUsers, Schools


class SchoolRepository:
    def is_admin_user(self, user) -> bool:
        return isinstance(user, AdminUsers)

    def is_student_user(self, user) -> bool:
        return isinstance(user, StudentUsers)

    def get_school_by_id(self, school_id: int) -> Optional[Schools]:
        return Schools.query.filter(Schools.Id == school_id).one_or_none()

    def get_school_name_with_id(self, school_id: int) -> str:
        school = Schools.query.filter(Schools.Id == school_id).one_or_none()
        return school.Name if school else ""

    def get_all_schools(self) -> List[Schools]:
        return Schools.query.order_by(Schools.Name.asc()).all()

    def get_school_by_teacher_id(self, teacher_id: int) -> Optional[Schools]:
        admin = AdminUsers.query.filter(AdminUsers.Id == teacher_id).one_or_none()
        if not admin:
            return None
        return self.get_school_by_id(int(admin.SchoolId))

    def create_school(self, name: str) -> Schools:
        school = Schools(Name=name)
        db.session.add(school)
        db.session.commit()
        return school

    def get_school_for_admin(self, admin_id: int) -> Optional[Schools]:
        """
        Gets the school row for an admin user (teacher) using AdminUsers.SchoolId.
        """
        admin = AdminUsers.query.filter(AdminUsers.Id == admin_id).one_or_none()
        if not admin:
            return None
        return self.get_school_by_id(int(admin.SchoolId))

    def get_school_for_student(self, student_id: int) -> Optional[Schools]:
        """
        Gets the school row for a student using StudentUsers.SchoolId.
        """
        student = StudentUsers.query.filter(StudentUsers.Id == student_id).one_or_none()
        if not student:
            return None
        return self.get_school_by_id(int(student.SchoolId))

    def get_Id_from_publicId(self, public_id: str) -> Optional[Schools]:
        sid = Schools.query.filter(Schools.PublicId == public_id).one_or_none()
        return sid.PublicId