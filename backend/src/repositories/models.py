from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql.schema import ForeignKey
from sqlalchemy.types import Date
from sqlalchemy.sql import func

from src.repositories.database import db


class Projects(db.Model):
    __tablename__ = "Projects"
    Id = Column(Integer, primary_key=True, autoincrement=True, unique=True)
    Name = Column(String, nullable=False)
    Language = Column(String, nullable=False)
    Type = Column(String, nullable=False)
    OrderIndex = Column(Integer)
    Submissions = relationship('Submissions')
    solutionpath = Column(String)
    AsnDescriptionPath = Column(String)
    AdditionalFilePath = Column(String)


class Submissions(db.Model):
    __tablename__ = "Submissions"
    Id = Column(Integer, primary_key=True)
    OutputFilepath = Column(String)
    CodeFilepath = Column(String)
    IsPassing = Column(Boolean)
    Time = Column(Date)
    Team = Column(Integer, ForeignKey('Teams.Id'))
    User = Column(Integer, ForeignKey('StudentUsers.Id'))
    Project = Column(Integer, ForeignKey('Projects.Id'))
    TestCaseResults = Column(String)


class LoginAttempts(db.Model):
    __tablename__ = "LoginAttempts"
    Id = Column(Integer, primary_key=True)
    Time = Column(Date)
    IPAddress = Column(String)
    Email = Column(String(256), nullable=False)


class Testcases(db.Model):
    __tablename__ = "Testcases"
    Id = Column(Integer, primary_key=True, autoincrement=True)
    ProjectId = Column(Integer, ForeignKey('Projects.Id'))
    Name = Column(String)
    Description = Column(String)
    input = Column(String)
    Output = Column(String)
    Hidden = Column(Boolean, default=False)


class Schools(db.Model):
    __tablename__ = "Schools"
    Id = Column(Integer, primary_key=True, autoincrement=True)
    Name = Column(String(256), nullable=False, unique=True)


class Teams(db.Model):
    __tablename__ = "Teams"
    Id = Column(Integer, primary_key=True, autoincrement=True)
    SchoolId = Column(Integer, ForeignKey('Schools.Id'), nullable=False)
    TeamNumber = Column(Integer, nullable=False)
    Name = Column(String(45), nullable=False)
    Division = Column(String(5))
    IsOnline = Column(Boolean, default=False)


class AdminUsers(db.Model):
    __tablename__ = "AdminUsers"
    Id = Column(Integer, primary_key=True, autoincrement=True)
    Firstname = Column(String)
    Lastname = Column(String)
    Email = Column(String(256), unique=True, nullable=False)
    SchoolId = Column(Integer, ForeignKey('Schools.Id'), nullable=False)
    PasswordHash = Column(String(255))
    IsLocked = Column(Boolean, default=False)
    Role = Column(Integer, nullable=False, default=0)
    Question1 = Column(String(255))
    Question2 = Column(String(255))


class StudentUsers(db.Model):
    __tablename__ = "StudentUsers"
    Id = Column(Integer, primary_key=True, autoincrement=True)
    EmailHash = Column(String(64), unique=True, nullable=False)  # sha256 hex
    TeacherId = Column(Integer, ForeignKey('AdminUsers.Id'), nullable=False)
    SchoolId = Column(Integer, ForeignKey('Schools.Id'), nullable=False)
    TeamId = Column(Integer, ForeignKey('Teams.Id'), nullable=False)
    MemberId = Column(Integer, nullable=True)
    PasswordHash = Column(String(255))
    IsLocked = Column(Boolean, default=False)

class HelpRequests(db.Model):
    __tablename__ = "HelpRequests"

    Id = Column(Integer, primary_key=True, autoincrement=True)
    StudentId = Column(Integer, ForeignKey('StudentUsers.Id'), nullable=True)
    TeacherId = Column(Integer, ForeignKey('AdminUsers.Id'), nullable=True)
    ProblemId = Column(Integer, ForeignKey('Projects.Id'), nullable=True)
    Reason = Column(String(255), nullable=False)
    Description = Column(Text, nullable=False)
    Status = Column(Integer, default=0, nullable=False)
    CurrentAdminId = Column(Integer, ForeignKey('AdminUsers.Id'), nullable=True)
    # Timestamp
    CreatedAt = Column(DateTime, default=func.now(), nullable=False)
    
    # Stays null until compelted
    CompletedAt = Column(DateTime, nullable=True)


class TeamProjectStats(db.Model):
    __tablename__ = "TeamProjectStats"
    Id = Column(Integer, primary_key=True, autoincrement=True)
    TeamId = Column(Integer, ForeignKey('Teams.Id'), nullable=False)
    ProjectId = Column(Integer, ForeignKey('Projects.Id'), nullable=False)
    Attempts = Column(Integer, nullable=False, default=0)
    Solved = Column(Boolean, nullable=False, default=False)
    AcceptedTimeMinutes = Column(Integer, nullable=True)
    CurrentSubmissionId = Column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint('TeamId', 'ProjectId', name='teamprojectstats_team_project_unique'),
    )

class ScoreboardSnapshots(db.Model):
    __tablename__ = "ScoreboardSnapshots"
    Id = Column(Integer, primary_key=True, autoincrement=True)
    Division = Column(String(5), nullable=False)
    IsOnline = Column(Boolean, nullable=False)
    Minute = Column(Integer, nullable=False)
    TimeStamp = Column(DateTime, nullable=False)
    Payload = Column(Text, nullable=False)

    __table_args__ = (
        UniqueConstraint('Division', 'IsOnline', 'Minute', name='scoreboardsnapshots_division_online_minute_unique'),
    )