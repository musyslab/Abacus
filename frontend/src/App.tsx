import React, { Component } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import Scoreboard from './pages/public/Scoreboard';

import AdminMenu from './pages/abacus/AdminMenu';
import AdminSchoolRoster from './pages/abacus/AdminSchoolRoster';
import AdminProjectListBlue from './pages/abacus/AdminProjectListBlue';
import AdminProjectListGold from './pages/abacus/AdminProjectListGold';
import AdminBlueProjectManage from './pages/abacus/AdminBlueProjectManage';
import AdminGoldProjectManage from './pages/abacus/AdminGoldProjectManage';
import StudentSubmit from './pages/abacus/StudentSubmit';
import StudentSubmissions from './pages/abacus/AdminStudentSubmissions';
import AdminTeamManage from './pages/abacus/AdminTeamManage';
import AdminTeamSubmissions from './pages/abacus/AdminTeamSubmissions';
import AdminUpload from './pages/abacus/AdminUpload';
import StudentProjectSelection from './pages/abacus/StudentProjectSelection';
import StudentBlueProjectSelection from './pages/abacus/StudentBlueProjectSelection';
import StudentGoldProjectSelection from './pages/abacus/StudentGoldProjectSelection';
import AdminProblemReview from './pages/abacus/AdminProblemSubmissions';

import StudentGoldSubmissions from './pages/abacus/StudentGoldSubmissions';
import AdminGoldSubmissions from './pages/abacus/AdminGoldSubmissions';

import StudentEagleSubmissions from './pages/abacus/StudentEagleSubmissions';

import SubmissionView from './pages/abacus/SubmissionView';

import ProtectedRoute from './pages/components/ProtectedRoute';
import AdminHelpRequests from './pages/abacus/AdminHelpRequests';
import StudentHelpRequests from './pages/abacus/StudentHelpRequests';


class App extends Component {
    render() {
        axios.interceptors.response.use(
            function (successRes) {
                return successRes;
            },
            function (error) {
                if (
                    error.response &&
                    (error.response.status === 401 ||
                        error.response.status === 422 ||
                        error.response.status === 419)
                ) {
                    localStorage.removeItem('AUTOTA_AUTH_TOKEN');
                    window.location.href = '/home';
                }
                return Promise.reject(error);
            }
        );

        return (
            <BrowserRouter>
                <Routes>
                    <Route path="/home" element={<HomePage />} />
                    <Route path="/teacher-login" element={<TeacherLoginPage />} />
                    <Route path="/student-login" element={<StudentLoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route
                        path="/student-reset-password"
                        element={<StudentResetPasswordPage />}
                    />
                    <Route
                        path="/teacher-reset-password"
                        element={<TeacherResetPasswordPage />}
                    />
                    <Route path="/set-password" element={<SetPasswordPage />} />
                    <Route path="/scoreboard" element={<Scoreboard />} />

                    <Route path="/" element={<LandingPage />} />

                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute requiredAdminRole={1}>
                                <AdminMenu />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/admin/upload/submission/:id"
                        element={
                            <ProtectedRoute>
                                <SubmissionView />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/problem/:problemId/review/submission/:id"
                        element={
                            <ProtectedRoute requiredAdminRole={1}>
                                <SubmissionView />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/:school_id/team-manage/:teamId/submissions/:id"
                        element={
                            <ProtectedRoute requiredAdminRole={1}>
                                <SubmissionView />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/team-manage/:teamId/submissions/:id"
                        element={
                            <ProtectedRoute requiredAdminRole={0}>
                                <SubmissionView />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/student/gold-submissions/:projectId"
                        element={
                            <ProtectedRoute>
                                <StudentGoldSubmissions />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/gold-submissions"
                        element={
                            <ProtectedRoute requiredAdminRole={0}>
                                <AdminGoldSubmissions />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/gold-submissions/:projectId"
                        element={
                            <ProtectedRoute requiredAdminRole={0}>
                                <AdminGoldSubmissions />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/gold-submissions"
                        element={
                            <ProtectedRoute requiredAdminRole={1}>
                                <AdminGoldSubmissions />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/gold-submissions/:projectId"
                        element={
                            <ProtectedRoute requiredAdminRole={1}>
                                <AdminGoldSubmissions />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/student/eagle-submissions"
                        element={
                            <ProtectedRoute>
                                <StudentEagleSubmissions />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/submission/:id"
                        element={
                            <ProtectedRoute>
                                <SubmissionView />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/admin/schools"
                        element={
                            <ProtectedRoute requiredAdminRole={1}>
                                <AdminSchoolRoster />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/:school_id/team-manage"
                        element={
                            <ProtectedRoute requiredAdminRole={1}>
                                <AdminTeamManage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/:school_id/team-manage/:teamId/submissions"
                        element={
                            <ProtectedRoute requiredAdminRole={1}>
                                <AdminTeamSubmissions />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/:school_id/student/:student_id"
                        element={
                            <ProtectedRoute>
                                <StudentSubmissions />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/admin/blue/problems"
                        element={
                            <ProtectedRoute requiredAdminRole={1}>
                                <AdminProjectListBlue />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/gold/problems"
                        element={
                            <ProtectedRoute requiredAdminRole={1}>
                                <AdminProjectListGold />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/blue/problem/manage/:id"
                        element={
                            <ProtectedRoute requiredAdminRole={1}>
                                <AdminBlueProjectManage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/gold/problem/manage/:id"
                        element={
                            <ProtectedRoute requiredAdminRole={1}>
                                <AdminGoldProjectManage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/admin/problem/:id/review"
                        element={
                            <ProtectedRoute requiredAdminRole={1}>
                                <AdminProblemReview />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/upload"
                        element={
                            <ProtectedRoute requiredAdminRole={1}>
                                <AdminUpload />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/teacher/team-manage"
                        element={
                            <ProtectedRoute requiredAdminRole={0}>
                                <AdminTeamManage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/teacher/team-manage/:teamId/submissions"
                        element={
                            <ProtectedRoute requiredAdminRole={0}>
                                <AdminTeamSubmissions />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/student/problems"
                        element={
                            <ProtectedRoute>
                                <StudentProjectSelection />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/student/blue/problems"
                        element={
                            <ProtectedRoute>
                                <StudentBlueProjectSelection />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/student/gold/problems"
                        element={
                            <ProtectedRoute>
                                <StudentGoldProjectSelection />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/student/:projectId/submit"
                        element={
                            <ProtectedRoute>
                                <StudentSubmit />
                            </ProtectedRoute>
                        }
                    />

                    <Route path="/admin" element={
                        <ProtectedRoute requiredAdminRole={1}>
                            <AdminMenu />
                        </ProtectedRoute>
                    } />

                    <Route path="/admin/upload/submission/:id" element={
                        <ProtectedRoute>
                            <SubmissionView />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/problem/:problemId/review/submission/:id" element={
                        <ProtectedRoute requiredAdminRole={1}>
                            <SubmissionView />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/:school_id/team-manage/:teamId/submissions/:id" element={
                        <ProtectedRoute requiredAdminRole={1}>
                            <SubmissionView />
                        </ProtectedRoute>
                    } />
                    <Route path="/teacher/team-manage/:teamId/submissions/:id" element={
                        <ProtectedRoute requiredAdminRole={0}>
                            <SubmissionView />
                        </ProtectedRoute>
                    } />
                    <Route path="/submission/:id" element={
                        <ProtectedRoute>
                            <SubmissionView />
                        </ProtectedRoute>
                    } />

                    <Route path="/admin/schools" element={
                        <ProtectedRoute requiredAdminRole={1}>
                            <AdminSchoolRoster />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/:school_id/team-manage" element={
                        <ProtectedRoute requiredAdminRole={1}>
                            <AdminTeamManage />
                        </ProtectedRoute>
                    }
                    />
                    <Route path="/admin/:school_id/team-manage/:teamId/submissions" element={
                        <ProtectedRoute requiredAdminRole={1}>
                            <AdminTeamSubmissions />
                        </ProtectedRoute>
                    }
                    />
                    <Route path="/admin/:school_id/student/:student_id" element={
                        <ProtectedRoute>
                            <StudentSubmissions />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/problems" element={
                        <ProtectedRoute requiredAdminRole={1}>
                            <AdminProjectList />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/problem/manage/:id" element={
                        <ProtectedRoute requiredAdminRole={1}>
                            <AdminProjectManage />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/problem/:id/review" element={
                        <ProtectedRoute requiredAdminRole={1}>
                            <AdminProblemReview />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/upload" element={
                        <ProtectedRoute requiredAdminRole={1}>
                            <AdminUpload />
                        </ProtectedRoute>
                    } />

                    <Route path="/teacher/team-manage" element={
                        <ProtectedRoute requiredAdminRole={0}>
                            <AdminTeamManage />
                        </ProtectedRoute>
                    } />
                    <Route path="/teacher/team-manage/:teamId/submissions" element={
                        <ProtectedRoute requiredAdminRole={0}>
                            <AdminTeamSubmissions />
                        </ProtectedRoute>
                    } />

                    <Route path="/student/problems" element={
                        <ProtectedRoute>
                            <StudentProjectSelection />
                        </ProtectedRoute>
                    } />
                    <Route path="/student/:projectId/submit" element={
                        <ProtectedRoute>
                            <StudentSubmit />
                        </ProtectedRoute>
                    } />
                    <Route path = "/admin/help-requests" element={
                        <ProtectedRoute requiredAdminRole={1}>
                            <AdminHelpRequests />
                        </ProtectedRoute>
                    } />
                    <Route path = "/student/help-requests" element={
                        <ProtectedRoute>
                            <StudentHelpRequests />
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