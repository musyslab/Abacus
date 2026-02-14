from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql.schema import ForeignKey
from sqlalchemy.sql.sqltypes import DateTime
from sqlalchemy.types import Date

from src.repositories.database import db


class Projects(db.Model):
    __tablename__ = "Projects"
    Id = Column(Integer, primary_key=True, autoincrement=True)
    Name = Column(String)
    Language = Column(String)
    Submissions=relationship('Submissions') 
    StudentUnlocks=relationship('StudentUnlocks') 
    solutionpath=Column(String)
    AsnDescriptionPath = Column(String)
    AdditionalFilePath = Column(String)

class Submissions(db.Model):
    __tablename__ = "Submissions"
    Id = Column(Integer, primary_key=True)
    OutputFilepath = Column(String)
    CodeFilepath = Column(String)
    IsPassing = Column(Boolean)
    Time = Column(Date)
    User = Column(Integer, ForeignKey('StudentUsers.Id'))
    Project = Column(Integer, ForeignKey('Projects.Id'))
    TestCaseResults=Column(String)

class LoginAttempts(db.Model):
    __tablename__ = "LoginAttempts"
    Id = Column(Integer, primary_key=True)
    Time = Column(Date)
    IPAddress = Column(String)
    Email = Column(String(256), nullable=False)

class StudentUnlocks(db.Model):
    __tablename__ = "StudentUnlocks"
    UserId = Column(Integer, ForeignKey('StudentUsers.Id'), primary_key=True)
    ProjectId = Column(Integer, ForeignKey('Projects.Id'), primary_key=True)
    Time = Column(DateTime)

class Testcases(db.Model):
    __tablename__ = "Testcases"
    Id = Column(Integer, primary_key=True, autoincrement=True)
    ProjectId = Column(Integer, ForeignKey('Projects.Id'))
    Name = Column(String)
    Description = Column(String)
    input = Column(String)
    Output = Column(String)
    Hidden = Column(Boolean, default=False)

class OHVisits(db.Model):
    __tablename__ = "OHVisits"
    Sqid = Column(Integer, primary_key=True, autoincrement=True)
    StudentQuestionscol = Column(String)
    ruling = Column(Integer)
    dismissed = Column(Integer)
    StudentId = Column(Integer, ForeignKey('StudentUsers.Id'))
    TimeSubmitted = Column(DateTime)
    projectId = Column(Integer, ForeignKey('Projects.Id'))
    TimeAccepted = Column(DateTime)
    TimeCompleted = Column(DateTime)

class StudentGrades(db.Model):
    __tablename__ = "StudentGrades"
    Sid = Column(Integer, ForeignKey('StudentUsers.Id'), primary_key=True)
    Pid = Column(Integer, ForeignKey('Projects.Id'), primary_key=True)
    Grade = Column(Integer)
    SubmissionId = Column(Integer, ForeignKey('Submissions.Id'))
    ScoringMode = Column(String(20))
    ErrorPointsJson = Column(String(10000))
    ErrorDefsJson = Column(String(20000))
    UpdatedAt = Column(DateTime)

class StudentSuggestions(db.Model):
    __tablename__ = "StudentSuggestions"
    idStudentSuggestions = Column(Integer, primary_key=True, autoincrement=True)
    UserId = Column(Integer)
    StudentSuggestionscol = Column(String)
    TimeSubmitted = Column(DateTime)

class SubmissionCharges(db.Model):
    __tablename__ = "SubmissionCharges"
    Id = Column(Integer, primary_key=True, autoincrement=True)
    UserId = Column(Integer)
    ClassId = Column(Integer)
    BaseCharge = Column(Integer)
    RewardCharge = Column(Integer)
    
class SubmissionChargeRedeptions(db.Model):
    __tablename__ = "SubmissionChargeRedeptions"
    Id = Column(Integer, primary_key=True, autoincrement=True)
    UserId = Column(Integer)
    ClassId = Column(Integer)
    projectId = Column(Integer)
    Type = Column(String)
    ClaimedTime = Column(DateTime)
    RedeemedTime = Column(DateTime)
    SubmissionId = Column(Integer)
    Recouped = Column(Integer)
    
class SubmissionManualErrors(db.Model):
    __tablename__ = "SubmissionManualErrors"
    Id = Column(Integer, primary_key=True, autoincrement=True)
    SubmissionId = Column(Integer, ForeignKey('Submissions.Id'))
    StartLine = Column(Integer)
    EndLine = Column(Integer)
    ErrorId = Column(String(80))
    Count = Column(Integer)
    Note = Column(String(2000))

class Schools(db.Model):
    __tablename__ = "Schools"
    Id = Column(Integer, primary_key=True, autoincrement=True)
    Name = Column(String(256), nullable=False, unique=True)
    PublicId = Column(String(10), nullable=False, unique=True)

class Teams(db.Model):
    __tablename__ = "Teams"
    Id = Column(Integer, primary_key=True, autoincrement=True)
    SchoolId = Column(Integer, ForeignKey('Schools.Id'), nullable=False)
    TeamNumber = Column(Integer, nullable=False)
    Name = Column(String(100), nullable=False, unique=True)
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

