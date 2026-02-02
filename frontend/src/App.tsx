import React, { Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';

import HomePage from './pages/public/Home';
import TeacherLoginPage from './pages/public/TeacherLogin';
import StudentLoginPage from './pages/public/StudentLogin';
import RegisterPage from './pages/public/Register';
import StudentResetPasswordPage from './pages/public/StudentResetPassword';
import TeacherResetPasswordPage from './pages/public/TeacherResetPassword';
import SetPasswordPage from './pages/public/SetPassword';
import LandingPage from './pages/public/Landing';
import NotFound from './pages/public/NotFound';

import StudentUpload from './pages/student/StudentUpload';
import StudentOutputDiff from './pages/student/StudentOutputDiff';
import StudentClassSelection from './pages/student/StudentClassSelection';
import StudentOfficeHours from './pages/student/StudentOfficeHours';
import StudentPastSubmissions from "./pages/student/StudentPastSubmissions";

import AdminGrading from './pages/admin/AdminGrading';
import AdminOfficeHours from './pages/admin/AdminOfficeHours';
import AdminPlagiarism from "./pages/admin/AdminPlagiarism";
import AdminProjectList from './pages/admin/AdminProjectList';
import AdminProjectManage from './pages/admin/AdminProjectManage';
import AdminStudentRoster from './pages/admin/AdminStudentRoster';
import AdminTeamManage from './pages/admin/AdminTeamManage';
import AdminUpload from './pages/admin/AdminUpload';
import AdminViewStudentCode from './pages/admin/AdminViewStudentCode';

import TeacherRoster from './pages/abacus/TeacherRoster';
import StudentRoster from './pages/abacus/StudentRoster';
import ProblemList from './pages/abacus/ProblemList';
import ProblemCreate from './pages/abacus/ProblemCreate';
import StudentSubmit from './pages/abacus/StudentSubmit';
import StudentSubmissions from './pages/abacus/StudentSubmissions';
import StudentDiff from './pages/abacus/StudentDiff';

import ProtectedRoute from './pages/components/ProtectedRoute';

class App extends Component {

    render() {
        axios.interceptors.response.use(
            function (successRes) {
                return successRes;
            },
            function (error) {
                if (error.response && (error.response.status === 401 || error.response.status === 422 || error.response.status === 419)) {
                    localStorage.removeItem("AUTOTA_AUTH_TOKEN");
                    window.location.href = "/home";
                }
                return Promise.reject(error);
            });

        return (
            <BrowserRouter>
                <Routes>
                    <Route path="/home" element={<HomePage />} />
                    <Route path="/teacher-login" element={<TeacherLoginPage />} />
                    <Route path="/student-login" element={<StudentLoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/student-reset-password" element={<StudentResetPasswordPage />} />
                    <Route path="/teacher-reset-password" element={<TeacherResetPasswordPage />} />
                    <Route path="/set-password" element={<SetPasswordPage />} />

                    <Route path="/" element={<LandingPage />} />
                    {/* Start Abacus Routes */}
                    <Route path="/admin/teachers" element={
                        <ProtectedRoute>
                            <TeacherRoster />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/:teacher_id/students" element={
                        <ProtectedRoute>
                            <StudentRoster />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/:teacher_id/student/:student_id" element={
                        <ProtectedRoute>
                            <StudentSubmissions />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/:teacher_id/student/:student_id/:problem_id/:id" element={
                        <ProtectedRoute>
                            <StudentDiff />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/problems" element={
                        <ProtectedRoute>
                            <ProblemList />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/problem/create" element={
                        <ProtectedRoute>
                            <ProblemCreate />
                        </ProtectedRoute>
                    } />

                    <Route path="/judge/teachers" element={
                        <ProtectedRoute>
                            <TeacherRoster />
                        </ProtectedRoute>
                    } />
                    <Route path="/judge/:teacher_id/students" element={
                        <ProtectedRoute>
                            <StudentRoster />
                        </ProtectedRoute>
                    } />
                    <Route path="/judge/:teacher_id/student/:student_id" element={
                        <ProtectedRoute>
                            <StudentSubmissions />
                        </ProtectedRoute>
                    } />
                    <Route path="/judge/:teacher_id/student/:student_id/:problem_id/:id" element={
                        <ProtectedRoute>
                            <StudentDiff />
                        </ProtectedRoute>
                    } />
                    <Route path="/judge/problems" element={
                        <ProtectedRoute>
                            <ProblemList />
                        </ProtectedRoute>
                    } />
                    <Route path="/judge/problem/create" element={
                        <ProtectedRoute>
                            <ProblemCreate />
                        </ProtectedRoute>
                    } />

                    <Route path="/teacher/students" element={
                        <ProtectedRoute>
                            <StudentRoster />
                        </ProtectedRoute>
                    } />
                    <Route path="/teacher/student/:student_id" element={
                        <ProtectedRoute>
                            <StudentSubmissions />
                        </ProtectedRoute>
                    } />
                    <Route path="/teacher/student/:student_id/:problem_id/:id" element={
                        <ProtectedRoute>
                            <StudentDiff />
                        </ProtectedRoute>
                    } />

                    <Route path="/student/problems" element={
                        <ProtectedRoute>
                            <ProblemList />
                        </ProtectedRoute>
                    } />
                    <Route path="/student/:problem_id/submit" element={
                        <ProtectedRoute>
                            <StudentSubmit />
                        </ProtectedRoute>
                    } />
                    <Route path="/student/:problem_id/:id" element={
                        <ProtectedRoute>
                            <StudentDiff />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/team-manage" element={
                        <ProtectedRoute>
                            <AdminTeamManage />
                        </ProtectedRoute>
                    }
                    />
                    <Route path="/admin/:id/projects/*" element={
                        <ProtectedRoute>
                            <AdminProjectList />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/:class_id/project/:id" element={
                        <ProtectedRoute>
                            <AdminStudentRoster />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/:class_id/project/manage/:id" element={
                        <ProtectedRoute>
                            <AdminProjectManage />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/:class_id/project/:project_id/grade/:id" element={
                        <ProtectedRoute>
                            <AdminGrading />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/:class_id/project/:project_id/codeview/:id" element={
                        <ProtectedRoute>
                            <AdminViewStudentCode />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/plagiarism" element={
                        <ProtectedRoute>
                            <AdminPlagiarism />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/OfficeHours" element={
                        <ProtectedRoute>
                            <AdminOfficeHours />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/upload" element={
                        <ProtectedRoute>
                            <AdminUpload />
                        </ProtectedRoute>
                    } />

                    <Route path="/student/classes" element={
                        <ProtectedRoute>
                            <StudentClassSelection />
                        </ProtectedRoute>
                    } />
                    <Route path="/student/:class_id/upload" element={
                        <ProtectedRoute>
                            <StudentUpload />
                        </ProtectedRoute>
                    } />
                    <Route path="/student/:class_id/code/:id?" element={
                        <ProtectedRoute>
                            <StudentOutputDiff />
                        </ProtectedRoute>
                    } />
                    <Route path="/student/PastSubmissions" element={
                        <ProtectedRoute>
                            <StudentPastSubmissions />
                        </ProtectedRoute>
                    } />
                    <Route path="/student/:id/OfficeHours" element={
                        <ProtectedRoute>
                            <StudentOfficeHours />
                        </ProtectedRoute>
                    } />
                    {/* Catch-all for 404 */}
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </BrowserRouter>
        );
    }
}

export default App;