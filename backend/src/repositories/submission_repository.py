from collections import defaultdict
import json
import os
from sqlalchemy import and_, desc
from typing import Dict, List
from datetime import datetime, timedelta

from src.repositories.database import db
from .models import (
    StudentGrades,
    StudentSuggestions,
    Submissions,
    Projects,
    StudentUsers,
)

class SubmissionRepository():

    def get_submission_by_submission_id(self, submission_id: int) -> Submissions:
        submission = Submissions.query.filter(Submissions.Id == submission_id).order_by(desc("Time")).first()
        return submission

    def get_code_path_by_submission_id(self, submission_id: int) -> str:
        submission = self.get_submission_by_submission_id(submission_id)
        return submission.CodeFilepath

    def read_code_file(self, code_path) -> str:
        student_file = ""
        # TODO: Make more robust for multiple files, this simply grabs the first file in the directory
        if os.path.isdir(code_path):
            for filename in os.listdir(code_path):
                full_path = os.path.join(code_path, filename)
                with open(full_path, "r") as f:
                    student_file = f.read()
                break
        else:
            with open(code_path, "r") as f:
                student_file = f.read()
        return student_file

    def read_output_file(self, output_path) -> str:
        student_output_file = ""
        with open(output_path, "r") as f:
            student_output_file = f.read()
        return student_output_file

    def create_submission(
        self,
        team_id: int,
        user_id: int,
        output: str,
        codepath: str,
        time: str,
        project_id: int,
        status: bool,
        testcase_results: str,
    ):
        submission = Submissions(
            OutputFilepath=output,
            CodeFilepath=codepath,
            Time=time,
            Team=team_id,
            User=user_id,
            Project=project_id,
            IsPassing=status,
            TestCaseResults=str(testcase_results),
        )
        db.session.add(submission)
        db.session.commit()
        created_id = submission.Id
        return created_id

    def get_total_submission_for_all_projects(self) -> Dict[int, int]:
        thisdic = {}
        project_ids = Projects.query.with_entities(Projects.Id).all()
        for proj in project_ids:
            count = Submissions.query.with_entities(Submissions.User).filter(Submissions.Project == proj[0]).distinct().count()
            thisdic[proj[0]] = count
        return thisdic

    def get_latest_submission_by_team(self, team_id: int) -> Dict[int, Submissions]:
        rows = (
            Submissions.query
            .filter(Submissions.Team == team_id)
            .order_by(desc(Submissions.Time))
            .all()
        )

        latest_by_project: Dict[int, Submissions] = {}
        for row in rows:
            if row.Project not in latest_by_project:
                latest_by_project[row.Project] = row

        return latest_by_project

    def get_latest_submission_for_team(self, team_id: int) -> Submissions:
        return (
            Submissions.query
            .filter(Submissions.Team == team_id)
            .order_by(desc(Submissions.Time))
            .first()
        )

    def get_team_cooldown_remaining_seconds(
        self,
        team_id: int,
        cooldown_seconds: int = 120,
    ) -> int:
        latest = self.get_latest_submission_for_team(team_id)
        if latest is None or latest.Time is None:
            return 0

        remaining = int(
            (latest.Time + timedelta(seconds=int(cooldown_seconds)) - datetime.now()).total_seconds()
        )
        return max(0, remaining)

    def get_submission_counts_by_team(self, team_id: int) -> Dict[int, int]:
        rows = (
            Submissions.query
            .filter(Submissions.Team == team_id)
            .all()
        )

        counts: Dict[int, int] = defaultdict(int)
        for row in rows:
            counts[int(row.Project)] += 1

        return dict(counts)

    def get_most_recent_submission_by_project(self, project_id: int, user_ids: List[int]) -> Dict[int, Submissions]:
        holder = Submissions.query.filter(
            and_(Submissions.Project == project_id, Submissions.User.in_(user_ids))
        ).order_by(desc(Submissions.Time)).all()

        bucket = {}
        for obj in holder:
            if obj.User in bucket:
                if bucket[obj.User].Time < obj.Time:
                    bucket[obj.User] = obj
            else:
                bucket[obj.User] = obj
        return bucket

    def submission_view_verification(self, user_id, submission_id) -> bool:
        student = StudentUsers.query.filter(StudentUsers.Id == user_id).first()
        if student is None or getattr(student, "TeamId", None) is None:
            return False

        submission = Submissions.query.filter(
            and_(
                Submissions.Id == submission_id,
                Submissions.Team == student.TeamId,
            )
        ).first()
        return submission is not None

    def get_all_submissions_for_project(self, project_id):
        submissions = Submissions.query.filter(Submissions.Project == project_id).all()
        return submissions