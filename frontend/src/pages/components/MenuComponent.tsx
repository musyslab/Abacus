import { Component } from "react";
import axios from "axios";
import "../../styling/MenuComponent.scss";
import { Link } from "react-router-dom";
import abacusLogo from "../../images/AbacusLogo.png";

import {
    FaHome,
    FaSignOutAlt,
    FaChalkboardTeacher,
    FaUserCircle,
} from "react-icons/fa";

interface MenuComponentProps {
    showUpload: boolean;
    showAdminUpload: boolean;
    showHelp: boolean;
    showCreate: boolean;
    showReviewButton: boolean;
    showLast: boolean;
    variant?: "app" | "home" | "public";
    onScrollToSection?: (key: "hero" | "about" | "abacus" | "contact") => void;
}

class MenuComponent extends Component<MenuComponentProps> {

    isLoggedIn = () => localStorage.getItem("AUTOTA_AUTH_TOKEN") !== null;

    goHome = () => {
        window.location.replace("/home");
    };

    // Logout and redirect
    handleLogout = () => {
        localStorage.removeItem("AUTOTA_AUTH_TOKEN");
        window.location.replace("/home");
    };

    // Role-based routing when logged in
    handleRoleHome = () => {
        axios
            .get(`${import.meta.env.VITE_API_URL}/auth/get-role`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("AUTOTA_AUTH_TOKEN")}`,
                },
            })
            .then((res) => {
                const role = Number(res.data?.role);
                const path = role === 1 ? "/admin/team-manage" : "/student/classes";
                window.location.replace(path);
            })
            .catch(() => window.location.replace("/home"));
    };

    // Compute dynamic class upload ID (more general: any /class/:id/... path)
    getClassIdFromUrl(): string | null {
        const match = window.location.href.match(/\/student\/(\d+)/);
        return match ? match[1] : null;
    }

    render() {
        const classId = this.getClassIdFromUrl();
        const officeHoursPath = classId ? `/student/${classId}/OfficeHours` : "/student/classes";

        const variant = this.props.variant ?? "app";
        const isPublic = variant === "public";
        const isHome = variant === "home";
        const loggedIn = this.isLoggedIn();

        return (
            <nav className="menu menu--top menu--inverted menu--borderless menu--huge">
                <div className="menu__container">
                    {isHome ? (
                        <>
                            <button
                                type="button"
                                className="menu__brand"
                                onClick={this.goHome}
                                aria-label="Home"
                            >
                                <img className="menu__brandImg" src={abacusLogo} alt="Abacus logo" />
                            </button>

                            <button type="button" className="menu__item" onClick={() => this.props.onScrollToSection?.("about")}>
                                About
                            </button>
                            <button type="button" className="menu__item" onClick={() => this.props.onScrollToSection?.("abacus")}>
                                Abacus
                            </button>
                            <button type="button" className="menu__item" onClick={() => this.props.onScrollToSection?.("contact")}>
                                Contact
                            </button>

                            <div className="menu__right">
                                {loggedIn ? (
                                    <button type="button" className="menu__item" onClick={this.handleRoleHome}>
                                        <FaHome className="menu__icon" aria-hidden="true" />
                                        <span className="menu__text">Go to dashboard</span>
                                    </button>
                                ) : (
                                    <>
                                        <Link className="menu__item" to="/teacher-login">
                                            <FaChalkboardTeacher className="menu__icon" aria-hidden="true" />
                                            <span className="menu__text">Teacher Login</span>
                                        </Link>
                                        <Link className="menu__item" to="/student-login">
                                            <FaUserCircle className="menu__icon" aria-hidden="true" />
                                            <span className="menu__text">Student Login</span>
                                        </Link>
                                    </>
                                )}
                            </div>
                        </>
                    ) : isPublic ? (
                        <>
                            <Link to="/home" className="menu__brand" aria-label="Home">
                                <img className="menu__brandImg" src={abacusLogo} alt="Abacus logo" />
                            </Link>


                            <div className="menu__spacer" />

                            <div className="menu__right">
                                {loggedIn ? (
                                    <button type="button" className="menu__item" onClick={this.handleRoleHome}>
                                        <FaHome className="menu__icon" aria-hidden="true" />
                                        <span className="menu__text">Go to dashboard</span>
                                    </button>
                                ) : (
                                    <>
                                        <Link className="menu__item" to="/teacher-login">
                                            <FaChalkboardTeacher className="menu__icon" aria-hidden="true" />
                                            <span className="menu__text">Teacher Login</span>
                                        </Link>
                                        <Link className="menu__item" to="/student-login">
                                            <FaUserCircle className="menu__icon" aria-hidden="true" />
                                            <span className="menu__text">Student Login</span>
                                        </Link>
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                className="menu__item menu__item--header menu__item--brand"
                                onClick={this.goHome}
                                aria-label="Home"
                            >
                                <img className="menu__brandImg menu__brandImg--inline" src={abacusLogo} alt="Abacus logo" />
                            </button>

                            <div className="menu__right">
                                <button
                                    type="button"
                                    className="menu__item menu__item--link"
                                    onClick={this.handleRoleHome}
                                    title="Go to dashboard"
                                >
                                    <FaHome className="menu__icon" aria-hidden="true" />
                                    <span className="menu__text">Dashboard</span>
                                </button>
                                <button
                                    type="button"
                                    className="menu__item menu__item--link menu__logout"
                                    onClick={this.handleLogout}
                                    title="Log Out"
                                >
                                    <FaSignOutAlt className="menu__icon" aria-hidden="true" />
                                    <span className="menu__text">Log Out</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </nav>
        );
    }
}

export default MenuComponent;
