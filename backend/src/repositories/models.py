from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql.schema import ForeignKey
from sqlalchemy.types import Date

from src.repositories.database import db


class Projects(db.Model):
    __tablename__ = "Projects"
    Id = Column(Integer, primary_key=True, autoincrement=True, unique=True)
    Name = Column(String, nullable=False)
    Language = Column(String, nullable=False)
    Type = Column(String, nullable=False)
    Division = Column(String, nullable=True)
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


class GoldDivision(db.Model):
    __tablename__ = "GoldDivision"
    Id = Column(Integer, primary_key=True, autoincrement=True)
    Link = Column(String(255), nullable=False)
    StudentId = Column(Integer, ForeignKey('StudentUsers.Id'), nullable=False)
    SubmittedAt = Column(Date)
    Points = Column(Integer)          
    Feedback = Column(String)         
    AdminGraderId = Column(Integer, ForeignKey('AdminUsers.Id'), nullable=True)