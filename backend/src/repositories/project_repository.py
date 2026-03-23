from abc import ABC, abstractmethod
import os
import random
import shutil
import subprocess
from typing import Optional, Dict
from flask import send_file
from sqlalchemy.sql.expression import asc
from .models import Projects, Submissions, Testcases
from src.repositories.database import db
from sqlalchemy import desc, and_
from datetime import datetime
from pyston import PystonClient,File
import asyncio
import json

from src.constants import COMPETITION_PROBLEM_MAX

class ProjectRepository():

    def get_all_projects(self) -> Projects:
        """Get all projects from the mySQL database and return a project object sorted by end date.

        Returns:
            Projects: A project object sorted by end date.
        """
        return Projects.query.order_by(asc(Projects.Id)).all()

    def get_selected_project(self, project_id: int) -> Projects:
        """[summary]
        Args:
            project_id (int): [The Project ID]

        Returns:
            Project: [a project object]
        """
        project= Projects.query.filter(Projects.Id == project_id).first()
        return project

    
    def create_project(self, name: str, language:str, project_type:str, difficulty:str, order_index: int | None, file_path:str, description_path:str, additional_file_path:str):
        project = Projects(Name=name, Language=language, Type=project_type, Difficulty=difficulty, OrderIndex=order_index, solutionpath=file_path, AsnDescriptionPath=description_path, AdditionalFilePath=additional_file_path)
        db.session.add(project)
        db.session.commit()
        return project.Id
        
    def get_project(self, project_id:int) -> Dict[str, any]:
        project_data = Projects.query.filter(Projects.Id == project_id).first()
        project_solutionFile = project_data.solutionpath
        #Strip just the file name from the path
        project_solutionFile = project_solutionFile.split("/")[-1]
        project_descriptionfile = project_data.AsnDescriptionPath
        project_descriptionfile = project_descriptionfile.split("/")[-1]
        add_field = getattr(project_data, "AdditionalFilePath", "") or ""
        try:
            add_list = json.loads(add_field) if (add_field or "").startswith('[') else ([add_field] if add_field else [])
        except Exception:
            add_list = []
        project_additionalfiles = [os.path.basename(p) for p in add_list if p]

        project = {
            "id": project_data.Id,
            "language": str(project_data.Language),
            "name": str(project_data.Name),
            "type": str(project_data.Type),
            "difficulty": str(project_data.Difficulty),
            "solutionFile": str(project_solutionFile),
            "descriptionFile": str(project_descriptionfile),
            "additionalFiles": project_additionalfiles
        }

        return project

    def edit_project(self, name: str, language:str, project_type: str, difficulty: str, order_index: int | None, project_id:int, path:str, description_path:str, additional_file_path:str):
        project = Projects.query.filter(Projects.Id == project_id).first()
        project.Name = name
        project.Language = language
        project.Type = project_type
        project.Difficulty = difficulty
        project.solutionpath = path
        project.AsnDescriptionPath = description_path
        project.AdditionalFilePath = additional_file_path
        project.OrderIndex = order_index
        db.session.commit()
    
    def get_competition_projects(self) -> list:
        projects = Projects.query.filter(Projects.Type == "competition").order_by(asc(Projects.OrderIndex)).all()
        return projects
    
    def edit_project_order(self, project_id: int, new_order_index: int):
        project = Projects.query.filter(Projects.Id == project_id).first()
        if project and project.Type == "competition":
            project.OrderIndex = new_order_index
            db.session.commit()

    def get_next_order_index(self) -> Optional[int]:
        """
        Returns the next available order index (1..10) for competition.
        If all 10 slots are taken, returns None.
        """
        rows = (
            Projects.query.filter(Projects.Type == "competition", Projects.OrderIndex.isnot(None)).order_by(asc(Projects.OrderIndex)).all()
        )

        used = {
            int(row.OrderIndex) for row in rows
            if row.OrderIndex is not None and 1 <= int(row.OrderIndex) <= COMPETITION_PROBLEM_MAX
        }
        
        for i in range(1, COMPETITION_PROBLEM_MAX + 1):
            if i not in used:
                return i
        return None

    def get_project_order_index(self, project_id: int) -> Optional[int]:
        """
        Returns the order index for a given project ID, or None if not set.
        """
        project = Projects.query.filter(Projects.Id == project_id).first()
        if project and project.Type == "competition":
            return project.OrderIndex
        return None

    def get_testcases(self, project_id: int) -> list[dict]:
        testcases = Testcases.query.filter(Testcases.ProjectId == project_id).all()
        testcase_info: list[dict] = []

        for t in testcases:
            testcase_info.append({
                "id": t.Id,
                "name": t.Name,
                "description": t.Description,
                "input": t.input,
                "output": t.Output,
                "hidden": bool(getattr(t, "Hidden", False))
            })

        return testcase_info

    def add_or_update_testcase(
        self,
        project_id: int,
        testcase_id: int,
        name: str,
        description: str,
        input_data: str,
        output: str,
        hidden: bool = False,
    ):
        from flask import current_app

        # Fetch project and determine teacher directory base
        project = Projects.query.filter(Projects.Id == project_id).first()
        teacher_base = current_app.config["TEACHER_FILES_DIR"]
        # Ensure solutionpath points to the teacher project folder
        project_base = project.solutionpath  

        # Run grading-script to compute default output if none provided
        grading_script = os.path.join(
            current_app.root_path, "..", "tabot-files", "grading-scripts", "grade.py"
        )

        add_path = getattr(project, "AdditionalFilePath", "") or ""
        # Expand stored names to absolute paths under the teacher project folder for grade.py
        try:
            base_dir = project_base if os.path.isdir(project_base) else os.path.dirname(project_base)
            raw = (add_path or "").strip()
            if raw.startswith("[") or raw.startswith("{"):
                lst = json.loads(raw)
            else:
                lst = [raw] if raw else []
            abs_list = []
            for p in (lst or []):
                if not p:
                    continue
                if os.path.isabs(p):
                    abs_list.append(p)
                else:
                    abs_list.append(os.path.join(base_dir, os.path.basename(p)))
            add_path = json.dumps(abs_list)
        except Exception:
            pass
        #   grade.py ADMIN <language> <input_text> <solution_path> [additional_files_json]
        result = subprocess.run(
            [
                "python",
                grading_script,
                "ADMIN",
                project.Language,
                input_data,
                project_base,
                add_path,
                str(project_id),
            ],
            stdout=subprocess.PIPE,
            text=True,
        )

        # Always prefer recomputed output (includes AdditionalFilePath);
        # fall back to provided output only if recompute failed/empty.
        recomputed = (result.stdout or "").strip()
        if recomputed:
            output = recomputed

        # Handle creation or update of the testcase record
        testcase = Testcases.query.filter(Testcases.Id == testcase_id).first()

        if testcase is None:
            testcase = Testcases(
                ProjectId=project_id,
                Name=name,
                Description=description,
                input=input_data,
                Output=output,
                Hidden=bool(hidden),
            )
            db.session.add(testcase)
        else:
            testcase.Name = name
            testcase.Description = description
            testcase.input = input_data
            testcase.Output = output
            testcase.Hidden = bool(hidden)

        db.session.commit()

    def remove_testcase(self, testcase_id: int):
        testcase = Testcases.query.filter(Testcases.Id == testcase_id).first()
        db.session.delete(testcase)
        db.session.commit()

    def testcases_to_json(self, project_id: int) -> str:
        testcase_holder: Dict[int, list] = {}
        proj = Projects.query.filter(Projects.Id == project_id).first()
        add_field = getattr(proj, "AdditionalFilePath", "") if proj else ""
        try:
            add_list = json.loads(add_field) if (add_field or "").startswith('[') else ([add_field] if add_field else [])
        except Exception:
            add_list = []

        # Expand stored names to absolute paths under the teacher solution folder.
        try:
            base_dir = ""
            if proj and getattr(proj, "solutionpath", ""):
                sp = getattr(proj, "solutionpath", "")
                base_dir = sp if os.path.isdir(sp) else os.path.dirname(sp)
            abs_list = []
            for p in (add_list or []):
                if not p:
                    continue
                if os.path.isabs(p):
                    abs_list.append(p)
                else:
                    abs_list.append(os.path.join(base_dir, os.path.basename(p)))
            add_list = abs_list
        except Exception:
            pass

        tests = Testcases.query.filter(Testcases.ProjectId == project_id).all()
        for test in tests:
            testcase_holder[test.Id] = [
                test.Name,
                test.Description,
                test.input,
                test.Output,
                add_list,
                bool(getattr(test, "Hidden", False)),
            ]
        json_object = json.dumps(testcase_holder)
        print(json_object, flush=True)
        return json_object

    def wipe_submissions(self, project_id:int):
        submissions = Submissions.query.filter(Submissions.Project == project_id).all()
        for student in student_progress:
            db.session.delete(student)
        db.session.commit()
        for submission in submissions:
            db.session.delete(submission)
        db.session.commit()

    def get_project_path(self, project_id):
        project = Projects.query.filter(Projects.Id==project_id).first()
        return project.solutionpath

    def get_project_desc_path(self, project_id):
        project = Projects.query.filter(Projects.Id==project_id).first()
        return project.AsnDescriptionPath

    def get_project_desc_file(self, project_id):
        project = Projects.query.filter(Projects.Id == project_id).first()
        filepath = project.AsnDescriptionPath
        with open(filepath, 'rb') as file:
            file_contents = file.read()
        return file_contents  # Return the contents of the PDF file