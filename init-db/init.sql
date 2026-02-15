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
-- Table structure for table `OHVisits`
-- ============================================
CREATE TABLE `OHVisits` (
  `Sqid` int NOT NULL AUTO_INCREMENT,
  `StudentQuestionsCol` varchar(10000) DEFAULT NULL,
  `ruling` int DEFAULT NULL,
  `dismissed` int DEFAULT NULL,
  `StudentId` int DEFAULT NULL,
  `TimeSubmitted` datetime DEFAULT NULL,
  `ProjectId` int DEFAULT NULL,
  `TimeAccepted` datetime DEFAULT NULL,
  `TimeCompleted` datetime DEFAULT NULL,
  PRIMARY KEY (`Sqid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table structure for table `Projects`
-- ============================================
CREATE TABLE `Projects` (
  `Id` int NOT NULL AUTO_INCREMENT COMMENT 'Table to keep track of projects',
  `Name` varchar(1000) NOT NULL,
  `Language` varchar(45) NOT NULL,
  `solutionpath` varchar(1000) DEFAULT NULL,
  `AsnDescriptionPath` varchar(1000) DEFAULT NULL,
  `AdditionalFilePath` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `idProjects_UNIQUE` (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table structure for table `Schools`
-- ============================================
CREATE TABLE `Schools` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(256) NOT NULL,
  `PublicId` varchar(10) NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `schools_name_unique` (`Name`),
  UNIQUE KEY `schools_publicid_unique` (`PublicId`)
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
-- Table structure for table `StudentGrades`
-- ============================================
CREATE TABLE `StudentGrades` (
  `Sid` int NOT NULL,
  `Pid` int NOT NULL,
  `Grade` int NOT NULL,
  `SubmissionId` int DEFAULT NULL,
  `ScoringMode` varchar(20) DEFAULT NULL,
  `ErrorPointsJson` text,
  `ErrorDefsJson` text,
  `UpdatedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`Sid`,`Pid`),
  KEY `fk_studentgrades_pid_idx` (`Pid`),
  KEY `fk_studentgrades_submission_idx` (`SubmissionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table structure for table `StudentSuggestions`
-- ============================================
CREATE TABLE `StudentSuggestions` (
  `idStudentSuggestions` int NOT NULL AUTO_INCREMENT,
  `UserId` int DEFAULT NULL,
  `StudentSuggestionscol` text,
  `TimeSubmitted` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`idStudentSuggestions`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table structure for table `StudentUnlocks`
-- ============================================
CREATE TABLE `StudentUnlocks` (
  `UserId` int NOT NULL,
  `ProjectId` int NOT NULL,
  `Time` datetime DEFAULT NULL,
  PRIMARY KEY (`UserId`,`ProjectId`),
  KEY `fk_studentunlocks_project_idx` (`ProjectId`)
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
-- Table structure for table `SubmissionChargeRedeptions`
-- ============================================
CREATE TABLE `SubmissionChargeRedeptions` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `UserId` int DEFAULT NULL,
  `SchoolId` int DEFAULT NULL,
  `ProjectId` int DEFAULT NULL,
  `Type` varchar(45) DEFAULT NULL,
  `ClaimedTime` datetime DEFAULT NULL,
  `RedeemedTime` datetime DEFAULT NULL,
  `SubmissionId` int DEFAULT NULL,
  `Recouped` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `fk_scr_user_idx` (`UserId`),
  KEY `fk_scr_school_idx` (`SchoolId`),
  KEY `fk_scr_project_idx` (`ProjectId`),
  KEY `fk_scr_submission_idx` (`SubmissionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table structure for table `SubmissionCharges`
-- ============================================
CREATE TABLE `SubmissionCharges` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `UserId` int DEFAULT NULL,
  `SchoolId` int DEFAULT NULL,
  `BaseCharge` int DEFAULT NULL,
  `RewardCharge` int DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `fk_sc_user_idx` (`UserId`),
  KEY `fk_sc_school_idx` (`SchoolId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table structure for table `SubmissionManualErrors`
-- ============================================
CREATE TABLE `SubmissionManualErrors` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `SubmissionId` int NOT NULL,
  `StartLine` int NOT NULL,
  `EndLine` int NOT NULL,
  `ErrorId` varchar(45) NOT NULL,
  `Count` int NOT NULL DEFAULT 1,
  `Note` text,
  PRIMARY KEY (`Id`),
  KEY `fk_sub_errors_idx` (`SubmissionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Table structure for table `Submissions`
-- ============================================
CREATE TABLE `Submissions` (
  `Id` int NOT NULL AUTO_INCREMENT COMMENT 'Table to keep track of submissions from users',
  `User` int NOT NULL,
  `Time` datetime NOT NULL,
  `OutputFilepath` varchar(256) NOT NULL,
  `Project` int NOT NULL,
  `CodeFilepath` varchar(256) NOT NULL,
  `IsPassing` tinyint(1) NOT NULL,
  `TestCaseResults` text,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `idSubmissions_UNIQUE` (`Id`),
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
  ADD CONSTRAINT `fk_submissions_student`
  FOREIGN KEY (`User`) REFERENCES `StudentUsers` (`Id`);

ALTER TABLE `Submissions`
  ADD CONSTRAINT `fk_submissions_project`
  FOREIGN KEY (`Project`) REFERENCES `Projects` (`Id`);

ALTER TABLE `StudentGrades`
  ADD CONSTRAINT `fk_studentgrades_student`
  FOREIGN KEY (`Sid`) REFERENCES `StudentUsers` (`Id`);

ALTER TABLE `StudentGrades`
  ADD CONSTRAINT `fk_studentgrades_project`
  FOREIGN KEY (`Pid`) REFERENCES `Projects` (`Id`);

ALTER TABLE `StudentGrades`
  ADD CONSTRAINT `fk_studentgrades_submission`
  FOREIGN KEY (`SubmissionId`) REFERENCES `Submissions` (`Id`) ON DELETE SET NULL;

ALTER TABLE `StudentUnlocks`
  ADD CONSTRAINT `fk_studentunlocks_student`
  FOREIGN KEY (`UserId`) REFERENCES `StudentUsers` (`Id`);

ALTER TABLE `StudentUnlocks`
  ADD CONSTRAINT `fk_studentunlocks_project`
  FOREIGN KEY (`ProjectId`) REFERENCES `Projects` (`Id`);

ALTER TABLE `Testcases`
  ADD CONSTRAINT `tc_fk`
  FOREIGN KEY (`ProjectId`) REFERENCES `Projects` (`Id`);

ALTER TABLE `SubmissionManualErrors`
  ADD CONSTRAINT `fk_sub_errors`
  FOREIGN KEY (`SubmissionId`) REFERENCES `Submissions` (`Id`) ON DELETE CASCADE;

ALTER TABLE `SubmissionCharges`
  ADD CONSTRAINT `fk_submissioncharges_student`
  FOREIGN KEY (`UserId`) REFERENCES `StudentUsers` (`Id`) ON DELETE SET NULL;

ALTER TABLE `SubmissionCharges`
  ADD CONSTRAINT `fk_submissioncharges_school`
  FOREIGN KEY (`SchoolId`) REFERENCES `Schools` (`Id`) ON DELETE SET NULL;

ALTER TABLE `SubmissionChargeRedeptions`
  ADD CONSTRAINT `fk_submissionchargeredeptions_student`
  FOREIGN KEY (`UserId`) REFERENCES `StudentUsers` (`Id`) ON DELETE SET NULL;

ALTER TABLE `SubmissionChargeRedeptions`
  ADD CONSTRAINT `fk_submissionchargeredeptions_school`
  FOREIGN KEY (`SchoolId`) REFERENCES `Schools` (`Id`) ON DELETE SET NULL;

ALTER TABLE `SubmissionChargeRedeptions`
  ADD CONSTRAINT `fk_submissionchargeredeptions_project`
  FOREIGN KEY (`ProjectId`) REFERENCES `Projects` (`Id`) ON DELETE SET NULL;

ALTER TABLE `SubmissionChargeRedeptions`
  ADD CONSTRAINT `fk_submissionchargeredeptions_submission`
  FOREIGN KEY (`SubmissionId`) REFERENCES `Submissions` (`Id`) ON DELETE SET NULL;

SET FOREIGN_KEY_CHECKS=1;