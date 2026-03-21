from collections import defaultdict
import json
import os
from sqlalchemy import and_, desc
from typing import Dict, List
from datetime import datetime, timedelta

from src.repositories.database import db
from .models import (
    StudentGrades,
    OHVisits,
    StudentSuggestions,
    StudentUnlocks,
    Submissions,
    Projects,
    StudentUsers,
    SubmissionManualErrors,
)


class SubmissionRepository():

    def get_submission_by_user_id(self, user_id: int) -> Submissions:
        submission = Submissions.query.filter(Submissions.User == user_id).order_by(desc("Time")).first()
        return submission

    def get_submission_by_user_and_projectid(self, user_id: int, project_id: int) -> Submissions:
        submission = Submissions.query.filter(
            and_(Submissions.Project == project_id, Submissions.User == user_id)
        ).order_by(desc("Time")).first()
        return submission

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

    def get_project_by_submission_id(self, submission_id: int) -> int:
        submission = Submissions.query.filter(Submissions.Id == submission_id).first()
        return submission.Project

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

    def unlock_check(self, user_id, project_id) -> bool:
        unlocked_info = StudentUnlocks.query.filter(
            and_(StudentUnlocks.ProjectId == project_id, StudentUnlocks.UserId == user_id)
        ).first()
        current_day = datetime.today().strftime('%A')
        return (current_day == "Wednesday" and unlocked_info is not None)

    def submission_counter(self, project_id: int, user_ids: List[int]) -> bool:
        submissions = Submissions.query.filter(
            and_(Submissions.Project == project_id, Submissions.User.in_(user_ids))
        ).all()
        submission_counter_dict = {}
        for sub in submissions:
            if sub.User in submission_counter_dict:
                submission_counter_dict[sub.User] = submission_counter_dict[sub.User] + 1
            else:
                submission_counter_dict[sub.User] = 1
        return submission_counter_dict

    def Submit_Student_OH_question(self, question, user_id, project_id):
        dt_string = datetime.now().strftime("%Y/%m/%d %H:%M:%S")
        student_question = OHVisits(
            StudentQuestionscol=question,
            StudentId=user_id,
            dismissed=0,
            ruling=-1,
            TimeSubmitted=dt_string,
            projectId=int(project_id),
        )
        db.session.add(student_question)
        db.session.commit()
        return str(student_question.Sqid)

    def Submit_OH_ruling(self, question_id, ruling):
        question = OHVisits.query.filter(OHVisits.Sqid == question_id).first()
        question.ruling = int(ruling)
        if int(ruling) == 0:
            question.dismissed = int(1)
        else:
            question.TimeAccepted = datetime.now().strftime("%Y/%m/%d %H:%M:%S")
        db.session.commit()
        return "ok"

    def Submit_OH_dismiss(self, question_id):
        question = OHVisits.query.filter(OHVisits.Sqid == question_id).first()
        question.dismissed = int(1)
        question.TimeCompleted = datetime.now().strftime("%Y/%m/%d %H:%M:%S")
        db.session.commit()
        return "ok"

    def Get_all_OH_questions(self, include_dismissed: bool = False):
        q = OHVisits.query
        if not include_dismissed:
            q = q.filter(OHVisits.dismissed == 0)
        questions = q.order_by(desc(OHVisits.Sqid)).all()
        return questions

    def Get_active_OH_questions_for_project(self, project_id: int):
        questions = (
            OHVisits.query
            .filter(and_(OHVisits.projectId == int(project_id), OHVisits.dismissed == 0))
            .order_by(OHVisits.Sqid.asc())
            .all()
        )
        return questions

    def get_active_question(self, user_id, accepted_only: bool = False):
        base_query = OHVisits.query.filter(
            and_(OHVisits.StudentId == user_id, OHVisits.dismissed == 0)
        )
        if accepted_only:
            base_query = base_query.filter(
                and_(OHVisits.ruling == 1, OHVisits.TimeAccepted.isnot(None))
            )
        question = base_query.order_by(OHVisits.Sqid.desc()).first()
        if question is None:
            return -1
        return question.Sqid

    def get_accepted_oh_for_class(self, user_id, class_id):
        q = OHVisits.query.filter(
            and_(
                OHVisits.StudentId == user_id,
                OHVisits.dismissed == 0,
                OHVisits.ruling == 1,
                OHVisits.TimeAccepted.isnot(None)
            )
        )
        if class_id is not None:
            q = (
                q.join(Projects, Projects.Id == OHVisits.projectId)
                 .filter(Projects.ClassId == class_id)
            )
        result = q.order_by(OHVisits.Sqid.desc()).first()
        return result.Sqid if result else -1

    def check_timeout(self, user_id, project_id):
        tbs_settings = [5, 15, 45, 60, 90, 120, 120, 120]
        submissions = Submissions.query.filter(
            and_(Submissions.Project == project_id, Submissions.User == user_id)
        ).order_by(desc(Submissions.Time)).first()

        if submissions is None:
            return [1, "None"]

        most_recent_submission = submissions.Time
        project_start_date = Projects.query.filter(Projects.Id == project_id).first().Start
        days_passed = (datetime.now() - project_start_date).days
        if days_passed > 7:
            days_passed = 7

        current_time = datetime.now()
        question = OHVisits.query.filter(
            and_(OHVisits.StudentId == user_id, OHVisits.projectId == project_id)
        ).order_by(desc(OHVisits.TimeSubmitted)).first()

        time_until_resubmission = ""
        tbs_threshold = tbs_settings[days_passed]
        if question is None:
            if most_recent_submission + timedelta(minutes=tbs_threshold) < current_time:
                return [1, "None"]

        time_until_resubmission = most_recent_submission + timedelta(minutes=tbs_threshold) - current_time
        if question is not None and question.ruling == 1:
            if question.dismissed == 0:
                return [1, "None"]
            submission_time_limit = question.TimeSubmitted + timedelta(hours=3)
            if submission_time_limit > current_time:
                if most_recent_submission + timedelta(minutes=tbs_threshold / 3) < current_time:
                    return [1, "None"]
                time_until_resubmission = most_recent_submission + timedelta(minutes=tbs_threshold / 3) - current_time
            else:
                if most_recent_submission + timedelta(minutes=tbs_threshold) < current_time:
                    return [1, "None"]
        return [0, time_until_resubmission]

    def check_visibility(self, user_id, project_id):
        submission = Submissions.query.filter(
            and_(Submissions.User == user_id, Submissions.Project == project_id)
        ).order_by(desc("Time")).first()
        if submission is None:
            print("Error: No submission found", flush=True)
            return True
        return False

    def get_remaining_OH_Time(self, user_id, project_id):
        question = OHVisits.query.filter(
            and_(
                OHVisits.StudentId == user_id,
                OHVisits.projectId == int(project_id),
                OHVisits.dismissed == 1
            )
        ).order_by(desc(OHVisits.TimeSubmitted)).first()

        if question is None:
            return "Expired"
        elif question.TimeAccepted is None:
            formatted_time_remaining = f"{3} hours, {0} minutes"
            return formatted_time_remaining

        current_time = datetime.now()
        time_remaining = question.TimeCompleted + timedelta(hours=3) - current_time
        if time_remaining < timedelta(minutes=0):
            formatted_time_remaining = "Expired"
        else:
            hours = time_remaining.seconds // 3600
            minutes = (time_remaining.seconds % 3600) // 60
            formatted_time_remaining = f"{hours} hours, {minutes} minutes"
        return formatted_time_remaining

    def get_number_of_questions_asked(self, user_id, project_id):
        number_of_questions = OHVisits.query.filter(
            and_(OHVisits.StudentId == user_id, OHVisits.projectId == int(project_id))
        ).count()
        return number_of_questions

    def get_student_questions_asked(self, user_id, project_id):
        questions = OHVisits.query.filter(
            and_(OHVisits.StudentId == user_id, OHVisits.projectId == int(project_id))
        ).all()
        return questions

    def get_all_submissions_for_project(self, project_id):
        submissions = Submissions.query.filter(Submissions.Project == project_id).all()
        return submissions

    def get_all_submission_times(self, project_id):
        project = Projects.query.filter(Projects.Id == project_id).first()
        project_start_date = project.Start
        project_end_date = project.End

        blocks = [
            '12:00 AM - 2:00 AM',
            '2:00 AM - 4:00 AM',
            '4:00 AM - 6:00 AM',
            '6:00 AM - 8:00 AM',
            '8:00 AM - 10:00 AM',
            '10:00 AM - 12:00 PM',
            '12:00 PM - 2:00 PM',
            '2:00 PM - 4:00 PM',
            '4:00 PM - 6:00 PM',
            '6:00 PM - 8:00 PM',
            '8:00 PM - 10:00 PM',
            '10:00 PM - 12:00 AM'
        ]
        submissions_dict = {
            (project_start_date + timedelta(days=i)).strftime('%A %b %d'): {block: 0 for block in blocks}
            for i in range(8)
        }

        submissions = Submissions.query.filter(Submissions.Project == project_id).all()

        students = {}
        for submission in submissions:
            if submission.User not in students:
                if submission.IsPassing == 1:
                    students[submission.User] = -1
                else:
                    students[submission.User] = 1
            else:
                if submission.IsPassing == 1:
                    students[submission.User] = -1
                else:
                    if students[submission.User] != -1:
                        students[submission.User] += 1

            date = submission.Time.date()
            weekday_date = date.strftime('%A %b %d')
            hour = submission.Time.hour
            if (date < project_start_date.date()) or (date > (project_start_date.date() + timedelta(days=9))):
                continue

            if weekday_date not in submissions_dict:
                submissions_dict[weekday_date] = {block: 0 for block in blocks}

            block_index = hour // 2
            block = blocks[block_index]
            submissions_dict[weekday_date][block] += 1

        students = {student: value for student, value in students.items() if value != -1}
        students = dict(sorted(students.items(), key=lambda item: item[1], reverse=True)[:10])

        students_list = []
        for student_id in students:
            student = StudentUsers.query.filter(StudentUsers.Id == student_id).first()
            students_list.append([
                student_id,
                students[student_id],
                getattr(student, "Firstname", "") if student else "",
                getattr(student, "Lastname", "") if student else "",
                (
                    getattr(student, "Email", None)
                    or getattr(student, "EmailHash", "")
                ) if student else "",
            ])

        weekdays = []
        for i in range(9):
            date = project_start_date + timedelta(days=i)
            weekdays.append(date.strftime('%A %b %d'))

        submission_heatmap = []
        for weekday_date in weekdays:
            blocks = submissions_dict.get(weekday_date)
            if blocks:
                data = list(blocks.values())
                submission_heatmap.append({
                    'name': weekday_date,
                    'data': data
                })
            else:
                submission_heatmap.append({
                    'name': weekday_date,
                    'data': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
                })

        submission_heatmap.reverse()
        return submission_heatmap, students_list

    def day_to_day_visualizer(self, project_id, user_ids):
        project = Projects.query.filter(Projects.Id == project_id).first()
        project_start_date = project.Start
        project_end_date = project.End

        dates = []
        date = project_start_date

        days_live = (project_end_date - project_start_date).days
        for i in range(days_live + 1):
            dates.append(date.strftime('%Y/%m/%d'))
            date += timedelta(days=1)

        passed = [0 for _ in range(days_live + 1)]
        failed = [0 for _ in range(days_live + 1)]
        no_submission = [0 for _ in range(days_live + 1)]

        submissions = Submissions.query.filter(Submissions.Project == project_id).all()

        for user_Id in user_ids:
            passed_flag = False
            submission_flag = False
            for date in dates:
                for submission in submissions:
                    if submission.Time.strftime('%Y/%m/%d') == date and submission.User == user_Id:
                        submission_flag = True
                        if submission.IsPassing:
                            passed_flag = True
                            break
                if not submission_flag:
                    no_submission[dates.index(date)] += 1
                else:
                    if passed_flag:
                        passed[dates.index(date)] += 1
                    else:
                        failed[dates.index(date)] += 1

        return dates, passed, failed, no_submission

    def get_all_submissions_for_user(self, user_id):
        submissions = Submissions.query.filter(Submissions.User == user_id).all()
        return submissions

    def get_project_scores(self, project_id):
        scores = StudentGrades.query.filter(StudentGrades.Pid == project_id).all()
        student_list = []
        for score in scores:
            student_list.append([score.Sid, score.Grade])
        return student_list

    def submitSuggestion(self, user_id, suggestion):
        dt_string = datetime.now().strftime("%Y/%m/%d %H:%M:%S")
        suggestion = StudentSuggestions(UserId=user_id, StudentSuggestionscol=suggestion, TimeSubmitted=dt_string)
        db.session.add(suggestion)
        db.session.commit()
        return "ok"

    def save_manual_grading(self, submission_id, grade, scoring_mode, error_points, errors, error_defs):
        try:
            sub = Submissions.query.get(submission_id)
            if sub is None:
                return False

            sid = sub.User
            pid = sub.Project

            grades = (
                StudentGrades.query
                .filter(StudentGrades.Sid == sid)
                .filter(StudentGrades.Pid == pid)
                .first()
            )

            mode = scoring_mode if scoring_mode in ("perInstance", "flatPerError") else "perInstance"
            clean_pts = {}
            for k, v in ((error_points or {}).items() if isinstance(error_points, dict) else []):
                try:
                    clean_pts[str(k)] = max(0, int(v))
                except Exception:
                    pass
            points_json = json.dumps(clean_pts, sort_keys=True)
            defs_json = json.dumps(error_defs or {}, sort_keys=True)

            if grades:
                grades.Grade = int(grade) if grade is not None else grades.Grade
                grades.SubmissionId = int(submission_id)
                grades.ScoringMode = mode
                grades.ErrorPointsJson = points_json
                grades.ErrorDefsJson = defs_json
                grades.UpdatedAt = datetime.utcnow()
            else:
                new_grade = StudentGrades(
                    Sid=sid,
                    Pid=pid,
                    Grade=int(grade) if grade is not None else 0,
                    SubmissionId=int(submission_id),
                    ScoringMode=mode,
                    ErrorPointsJson=points_json,
                    ErrorDefsJson=defs_json,
                    UpdatedAt=datetime.utcnow(),
                )
                db.session.add(new_grade)

            SubmissionManualErrors.query.filter_by(SubmissionId=submission_id).delete()

            for error in (errors or []):
                new_err = SubmissionManualErrors(
                    SubmissionId=int(submission_id),
                    StartLine=int(error.get('startLine')),
                    EndLine=int(error.get('endLine')),
                    ErrorId=str(error.get('errorId')),
                    Count=max(1, int(error.get('count', 1))),
                    Note=str(error.get('note', '') or ''),
                )
                db.session.add(new_err)

            db.session.commit()
            return True
        except Exception:
            db.session.rollback()
            return False

    def get_manual_errors(self, submission_id):
        errors = SubmissionManualErrors.query.filter(SubmissionManualErrors.SubmissionId == submission_id).all()
        return [
            {
                'startLine': e.StartLine,
                'endLine': e.EndLine,
                'errorId': e.ErrorId,
                'count': getattr(e, "Count", 1) or 1,
                'note': getattr(e, "Note", "") or ""
            }
            for e in errors
        ]

    def get_manual_grade_config(self, submission_id: int):
        sub = Submissions.query.get(int(submission_id))
        if sub is None:
            return {"grade": None, "scoringMode": "perInstance", "errorPoints": {}}

        sid = sub.User
        pid = sub.Project

        row = (
            StudentGrades.query
            .filter(StudentGrades.Sid == sid)
            .filter(StudentGrades.Pid == pid)
            .first()
        )

        if row is None:
            return {"grade": None, "scoringMode": "perInstance", "errorPoints": {}}

        mode = getattr(row, "ScoringMode", None)
        if mode not in ("perInstance", "flatPerError"):
            mode = "perInstance"

        raw_pts = getattr(row, "ErrorPointsJson", None) or "{}"
        try:
            pts = json.loads(raw_pts) if isinstance(raw_pts, str) else (raw_pts or {})
        except Exception:
            pts = {}

        raw_defs = getattr(row, "ErrorDefsJson", None) or "{}"
        try:
            defs = json.loads(raw_defs) if isinstance(raw_defs, str) else (raw_defs or {})
        except Exception:
            defs = {}

        return {
            "grade": getattr(row, "Grade", None),
            "scoringMode": mode,
            "errorPoints": pts,
            "errorDefs": defs
        }

    def get_oh_visits_by_projectId(self, project_id):
        visits = OHVisits.query.filter(OHVisits.projectId == project_id).filter(OHVisits.ruling == 1).all()
        student_ids = []
        for i in visits:
            student_ids.append(i.StudentId)
        return student_ids

    def get_project_grade_info(self, project_id: int):
        grade_rows = StudentGrades.query.filter(StudentGrades.Pid == project_id).all()
        grades_by_student = {}
        for g in grade_rows:
            raw_pts = getattr(g, "ErrorPointsJson", None) or "{}"
            try:
                pts = json.loads(raw_pts) if isinstance(raw_pts, str) else (raw_pts or {})
            except Exception:
                pts = {}

            raw_defs = getattr(g, "ErrorDefsJson", None) or "{}"
            try:
                defs = json.loads(raw_defs) if isinstance(raw_defs, str) else (raw_defs or {})
            except Exception:
                defs = {}

            grades_by_student[g.Sid] = {
                'grade': getattr(g, "Grade", None),
                'submission_id': getattr(g, "SubmissionId", None),
                'scoring_mode': getattr(g, "ScoringMode", None),
                'error_points': pts,
                'error_defs': defs
            }

        database_ids = list(grades_by_student.keys())
        student_numbers = StudentUsers.query.filter(StudentUsers.Id.in_(database_ids)).all()
        numbers_by_student = defaultdict(str)
        for num in student_numbers:
            numbers_by_student[num.Id] = getattr(num, "StudentNumber", "") or ""

        submission_ids = [v['submission_id'] for v in grades_by_student.values()]
        errors = SubmissionManualErrors.query.filter(SubmissionManualErrors.SubmissionId.in_(submission_ids)).all()
        errors_by_submission = defaultdict(list)
        for e in errors:
            errors_by_submission[e.SubmissionId].append(e)

        rows = []
        for sid, data in grades_by_student.items():
            error_list = errors_by_submission.get(data['submission_id'], [])
            error_data = [{
                'errorId': getattr(e, "ErrorId", None),
                'startLine': getattr(e, "StartLine", None),
                'endLine': getattr(e, "EndLine", None),
                'count': getattr(e, "Count", None),
                'note': getattr(e, "Note", "") or ""
            } for e in error_list]

            rows.append({
                'number': numbers_by_student[sid],
                'grade': data['grade'],
                'points': data['error_points'],
                'scoring_mode': data['scoring_mode'],
                'error_defs': data['error_defs'],
                'description': error_data
            })

        return rows