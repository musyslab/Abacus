from src.repositories.user_repository import UserRepository
from src.services.authentication_service import PAMAuthenticationService
from dependency_injector import containers, providers
from src.repositories.school_repository import SchoolRepository
from src.repositories.team_repository import TeamRepository
from src.repositories.project_repository import ProjectRepository
from src.repositories.submission_repository import SubmissionRepository

class Container(containers.DeclarativeContainer):
    config = providers.Configuration()
    school_repo = providers.Factory(SchoolRepository)
    team_repo = providers.Factory(TeamRepository)
    project_repo = providers.Factory(ProjectRepository)
    submission_repo = providers.Factory(SubmissionRepository)
    user_repo = providers.Factory(UserRepository)
    auth_service = providers.Factory(PAMAuthenticationService)