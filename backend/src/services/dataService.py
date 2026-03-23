import os
from typing import List, Dict, Any, Optional
from src.repositories.submission_repository import SubmissionRepository
from src.repositories.user_repository import UserRepository
from src.repositories.project_repository import ProjectRepository

def all_submissions(
    projectid: int,
    userId: int,  # kept for signature compatibility; not used
    submission_repository: SubmissionRepository,
    user_repository: UserRepository,
    project_repository: ProjectRepository,
) -> Dict[str, Any]:
    # userId is intentionally unused; we no longer email results.
    return run_local_plagiarism(projectid, submission_repository, user_repository, project_repository)
