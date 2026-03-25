SET FOREIGN_KEY_CHECKS=0;

-- ============================================
-- Table structure for table `AdminUsers`
-- ============================================
CREATE TABLE `AdminUsers` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Firstname` varchar(45) NOT NULL,
  `Lastname` varchar(45) NOT NULL,
  `Email` varchar(256) NOT NULL,
  `SchoolId` int NOT NULL,
  `PasswordHash` varchar(255) DEFAULT NULL,
  `IsLocked` tinyint(1) NOT NULL DEFAULT 0,
  `Role` tinyint(1) NOT NULL DEFAULT 0,
  `Question1` varchar(255) DEFAULT NULL,
  `Question2` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `adminusers_email_unique` (`Email`),
  KEY `fk_adminusers_school_idx` (`SchoolId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table structure for table `LoginAttempts`
-- ============================================
CREATE TABLE `LoginAttempts` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Time` datetime NOT NULL,
  `IPAddress` varchar(39) NOT NULL,
  `Email` varchar(256) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `idx_loginattempts_email` (`Email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table structure for table `Projects`
-- ============================================
CREATE TABLE `Projects` (
  `Id` int NOT NULL AUTO_INCREMENT COMMENT 'Table to keep track of projects',
  `Name` varchar(1000) NOT NULL,
  `Language` varchar(45) NOT NULL,
  `Type` varchar(20) NOT NULL,
  `Difficulty` varchar(10) NOT NULL,
  `OrderIndex` int DEFAULT NULL,
  `solutionpath` varchar(1000) DEFAULT NULL,
  `AsnDescriptionPath` varchar(1000) DEFAULT NULL,
  `AdditionalFilePath` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `idProjects_UNIQUE` (`Id`),
  UNIQUE KEY `projects_orderindex_unique` (`OrderIndex`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table structure for table `Schools`
-- ============================================
CREATE TABLE `Schools` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(256) NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `schools_name_unique` (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table structure for table `Teams`
-- ============================================
CREATE TABLE `Teams` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `SchoolId` int NOT NULL,
  `TeamNumber` int NOT NULL,
  `Name` varchar(45) NOT NULL,
  `Division` varchar(5) DEFAULT NULL,
  `IsOnline` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`Id`),
  KEY `fk_teams_school_idx` (`SchoolId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table structure for table `StudentUsers`
-- ============================================
CREATE TABLE `StudentUsers` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `EmailHash` char(64) NOT NULL,
  `TeacherId` int NOT NULL,
  `SchoolId` int NOT NULL,
  `TeamId` int NOT NULL,
  `MemberId` int DEFAULT NULL,
  `PasswordHash` varchar(255) DEFAULT NULL,
  `IsLocked` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `studentusers_emailhash_unique` (`EmailHash`),
  KEY `fk_studentusers_teacher_idx` (`TeacherId`),
  KEY `fk_studentusers_school_idx` (`SchoolId`),
  KEY `fk_studentusers_team_idx` (`TeamId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table structure for table `Submissions`
-- ============================================
CREATE TABLE `Submissions` (
  `Id` int NOT NULL AUTO_INCREMENT COMMENT 'Table to keep track of submissions from users',
  `Team` int NOT NULL,
  `User` int NOT NULL,
  `Time` datetime NOT NULL,
  `OutputFilepath` varchar(256) NOT NULL,
  `Project` int NOT NULL,
  `CodeFilepath` varchar(256) NOT NULL,
  `IsPassing` tinyint(1) NOT NULL,
  `TestCaseResults` text,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `idSubmissions_UNIQUE` (`Id`),
  KEY `idx_submissions_team` (`Team`),
  KEY `idx_submissions_user` (`User`),
  KEY `idx_submissions_project` (`Project`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table structure for table `Testcases`
-- ============================================
CREATE TABLE `Testcases` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `ProjectId` int DEFAULT NULL,
  `Name` text,
  `Description` text,
  `input` text,
  `Output` text,
  `Hidden` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Id_UNIQUE` (`Id`),
  KEY `tc_fk_idx` (`ProjectId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table structure for table `HelpRequests`
-- ============================================
CREATE TABLE HelpRequests (
    Id int NOT NULL AUTO_INCREMENT, 
    StudentId int,
    TeacherId int,
    ProblemId int,
    Reason varchar(255) NOT NULL,
    Description text,
    Status int NOT NULL,         
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
    CompletedAt TIMESTAMP NULL,
    PRIMARY KEY (`Id`),
    UNIQUE KEY `Id_UNIQUE` (`Id`),
    FOREIGN KEY (`StudentId`) REFERENCES StudentUsers(Id) ON DELETE CASCADE,
    FOREIGN KEY (`TeacherId`) REFERENCES AdminUsers(Id) ON DELETE SET NULL,
    FOREIGN KEY (`ProblemId`) REFERENCES Projects(Id) ON DELETE SET NULL                
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Foreign keys (added after all tables exist)
-- ============================================

ALTER TABLE `AdminUsers`
  ADD CONSTRAINT `fk_adminusers_school`
  FOREIGN KEY (`SchoolId`) REFERENCES `Schools` (`Id`);

ALTER TABLE `StudentUsers`
  ADD CONSTRAINT `fk_studentusers_teacher`
  FOREIGN KEY (`TeacherId`) REFERENCES `AdminUsers` (`Id`);

ALTER TABLE `StudentUsers`
  ADD CONSTRAINT `fk_studentusers_school`
  FOREIGN KEY (`SchoolId`) REFERENCES `Schools` (`Id`);

ALTER TABLE `StudentUsers`
  ADD CONSTRAINT `fk_studentusers_team`
  FOREIGN KEY (`TeamId`) REFERENCES `Teams` (`Id`);

ALTER TABLE `Teams`
  ADD CONSTRAINT `fk_teams_school`
  FOREIGN KEY (`SchoolId`) REFERENCES `Schools` (`Id`);

ALTER TABLE `Submissions`
  ADD CONSTRAINT `fk_submissions_team`
  FOREIGN KEY (`Team`) REFERENCES `Teams` (`Id`);

ALTER TABLE `Submissions`
  ADD CONSTRAINT `fk_submissions_student`
  FOREIGN KEY (`User`) REFERENCES `StudentUsers` (`Id`);

ALTER TABLE `Submissions`
  ADD CONSTRAINT `fk_submissions_project`
  FOREIGN KEY (`Project`) REFERENCES `Projects` (`Id`);

ALTER TABLE `Testcases`
  ADD CONSTRAINT `tc_fk`
  FOREIGN KEY (`ProjectId`) REFERENCES `Projects` (`Id`);

-- ============================================
-- Seed Schools data
-- ============================================
INSERT INTO `Schools` (`Name`) VALUES
  ('Belleville High School'),
  ('Brookfield Academy'),
  ('Brookfield Central High School'),
  ('Cedarburg High School'),
  ('Craig High School'),
  ('De Pere High School'),
  ('Franklin High School'),
  ('High School of the Health Sciences'),
  ('Homestead High School'),
  ('Johnson Creek Schools'),
  ('Kettle Moraine High School'),
  ('Menomonee Falls High School'),
  ('New London High School'),
  ('Oak Creek High School'),
  ('Parker High School'),
  ('Reagan IB High School'),
  ('Reedsburg Area High School'),
  ('Rufus King High School'),
  ('Sauk Prairie High School'),
  ('St. Francis High School'),
  ('West De Pere High School');

SET FOREIGN_KEY_CHECKS=1;