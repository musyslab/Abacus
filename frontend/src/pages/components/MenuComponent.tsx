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
    FaQuestionCircle,
    FaClipboardList,
    FaInbox,
} from "react-icons/fa";

interface MenuComponentProps {
    variant?: "app" | "home" | "public";
    onScrollToSection?: (key: "about" | "event" | "rules") => void;
    onRequestHelp?: () => void;
}

type DashboardInfo = {
    label: string;
    path: string;
};

interface MenuComponentState {
    dashboardLabel: string;
    dashboardPath: string;
    isRoleLoaded: boolean;
    isStudent: boolean;
    isAdminRole: boolean;
    isEagleStudent: boolean;
    isStaff: boolean;
    mailboxOpen: boolean;
    inboxItems: EagleInboxItem[];
    inboxError: string;
}

type EagleInboxItem = {
    teamId: number;
    teamNumber: number;
    teamName: string;
    schoolId: number;
    lastMessageId: number;
    lastMessageAt: string;
    lastSenderRole: "student" | "admin" | "teacher";
    lastPreview: string;
};

class MenuComponent extends Component<MenuComponentProps, MenuComponentState> {
    mailboxPollId: number | null = null;

    constructor(props: MenuComponentProps) {
        super(props);
        this.state = {
            dashboardLabel: "Dashboard",
            dashboardPath: "/home",
            isRoleLoaded: false,
            isStudent: false,
            isAdminRole: false,
            isEagleStudent: false,
            isStaff: false,
            mailboxOpen: false,
            inboxItems: [],
            inboxError: "",
        };
    }

    isLoggedIn = () => localStorage.getItem("AUTOTA_AUTH_TOKEN") !== null;

    componentDidMount() {
        if (this.isLoggedIn()) {
            this.fetchDashboardRoute();
        }
    }

    componentDidUpdate(_: MenuComponentProps, prevState: MenuComponentState) {
        const nowStaff = this.state.isRoleLoaded && this.state.isStaff && this.isLoggedIn();
        const prevStaff = prevState.isRoleLoaded && prevState.isStaff && this.isLoggedIn();

        if (nowStaff && !prevStaff) {
            this.fetchEagleInbox();
            this.mailboxPollId = window.setInterval(() => this.fetchEagleInbox(), 15000);
        }
        if (!nowStaff && prevStaff && this.mailboxPollId !== null) {
            window.clearInterval(this.mailboxPollId);
            this.mailboxPollId = null;
        }
    }

    componentWillUnmount() {
        if (this.mailboxPollId !== null) {
            window.clearInterval(this.mailboxPollId);
            this.mailboxPollId = null;
        }
    }

    goHome = () => {
        window.location.replace("/home");
    };

    // Logout and redirect
    handleLogout = () => {
        localStorage.removeItem("AUTOTA_AUTH_TOKEN");
        window.location.replace("/home");
    };

    fetchDashboardRoute = async (): Promise<DashboardInfo> => {
        try {
            const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/auth/get-role`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const status = String(res.data?.status || "");
            const role = Number(res.data?.role);

            if (status === "student") {
                try {
                    const teamRes = await axios.get(`${import.meta.env.VITE_API_URL}/teams/me`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const div = String(teamRes.data?.division ?? "").trim();
                    if (div === "Eagle") {
                        const info = { label: "Eagle Division home", path: "/student/eagle-home" };
                        this.setState({
                            dashboardLabel: info.label,
                            dashboardPath: info.path,
                            isRoleLoaded: true,
                            isStudent: true,
                            isAdminRole: false,
                            isEagleStudent: true,
                        });
                        return info;
                    }
                } catch {
                }
                const info = { label: "Problem Select", path: "/student/problems" };
                this.setState({
                    dashboardLabel: info.label,
                    dashboardPath: info.path,
                    isRoleLoaded: true,
                    isStudent: true,
                    isAdminRole: false,
                    isEagleStudent: false,
                });
                return info;
            }

            // AdminUsers: Role 0 = teacher, Role 1 = admin
            if (status === "admin") {
                const isAdmin = role === 1;
                if (isAdmin) {
                    const info = { label: "Admin Menu", path: "/admin" };
                    this.setState({
                        dashboardLabel: info.label,
                        dashboardPath: info.path,
                        isRoleLoaded: true,
                        isAdminRole: true,
                        isEagleStudent: false,
                        isStaff: true,
                    });
                    return info;
                }

                const info = { label: "Team Manage", path: "/teacher/team-manage" };

                this.setState({
                    dashboardLabel: info.label,
                    dashboardPath: info.path,
                    isRoleLoaded: true,
                    isEagleStudent: false,
                    isStaff: true,
                    isAdminRole: false,
                });
                return info;
            }

            const fallback = { label: "Dashboard", path: "/home" };
            this.setState({
                dashboardLabel: fallback.label,
                dashboardPath: fallback.path,
                isRoleLoaded: true,
                isEagleStudent: false,
                isStaff: false,
            });
            return fallback;
        } catch {
            const fallback = { label: "Dashboard", path: "/home" };
            this.setState({
                dashboardLabel: fallback.label,
                dashboardPath: fallback.path,
                isRoleLoaded: true,
                isEagleStudent: false,
                isStaff: false,
            });
            return fallback;
        }
    };

    getSeenMap(): Record<string, number> {
        try {
            const raw = localStorage.getItem("EAGLE_INBOX_LAST_SEEN") || "{}";
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch {
            return {};
        }
    }

    setSeen(teamId: number, lastMessageId: number) {
        const map = this.getSeenMap();
        map[String(teamId)] = Math.max(Number(map[String(teamId)] || 0), Number(lastMessageId || 0));
        localStorage.setItem("EAGLE_INBOX_LAST_SEEN", JSON.stringify(map));
    }

    unreadCount(): number {
        const map = this.getSeenMap();
        return (this.state.inboxItems || []).filter((it) => {
            const seen = Number(map[String(it.teamId)] || 0);
            return Number(it.lastMessageId || 0) > seen;
        }).length;
    }

    fetchEagleInbox = async () => {
        if (!this.state.isRoleLoaded || !this.state.isStaff) return;
        try {
            const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/eagle/inbox`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const items = Array.isArray(res.data) ? (res.data as EagleInboxItem[]) : [];
            this.setState({ inboxItems: items, inboxError: "" });
        } catch {
            this.setState({ inboxError: "Could not load Eagle inbox." });
        }
    };

    openTeamChat = (item: EagleInboxItem) => {
        this.setSeen(item.teamId, item.lastMessageId);
        this.setState({ mailboxOpen: false });
        const path = this.state.isAdminRole
            ? `/admin/eagle-team-chat/${item.teamId}`
            : `/teacher/eagle-team-chat/${item.teamId}`;
        window.location.assign(path);
    };

    renderMailbox(unread: number) {
        if (!(this.state.isRoleLoaded && this.state.isStaff && this.isLoggedIn())) return null;

        return (
            <div className="menu__mailboxWrap">
                <button
                    type="button"
                    className="menu__item menu__item--link"
                    onClick={() => this.setState((s) => ({ mailboxOpen: !s.mailboxOpen }))}
                    title="Eagle inbox"
                    aria-haspopup="menu"
                    aria-expanded={this.state.mailboxOpen}
                >
                    <FaInbox className="menu__icon" aria-hidden="true" />
                    <span className="menu__text">Inbox</span>
                    {unread > 0 ? <span className="menu__badge">{unread}</span> : null}
                </button>
                {this.state.mailboxOpen ? (
                    <div className="menu__mailboxPanel" role="menu" aria-label="Eagle inbox">
                        <div className="menu__mailboxHeader">Eagle messages</div>
                        {this.state.inboxError ? (
                            <div className="menu__mailboxEmpty">{this.state.inboxError}</div>
                        ) : this.state.inboxItems.length === 0 ? (
                            <div className="menu__mailboxEmpty">No recent messages.</div>
                        ) : (
                            <div className="menu__mailboxList">
                                {this.state.inboxItems.map((it) => {
                                    const seen = Number(this.getSeenMap()[String(it.teamId)] || 0);
                                    const isUnread = Number(it.lastMessageId || 0) > seen;
                                    return (
                                        <button
                                            key={it.teamId}
                                            type="button"
                                            className={
                                                isUnread
                                                    ? "menu__mailboxItem menu__mailboxItem--unread"
                                                    : "menu__mailboxItem"
                                            }
                                            onClick={() => this.openTeamChat(it)}
                                            role="menuitem"
                                        >
                                            <div className="menu__mailboxTop">
                                                <span className="menu__mailboxTeam">
                                                    #{it.teamNumber} — {it.teamName || "Eagle team"}
                                                </span>
                                                <span className="menu__mailboxTime">{it.lastMessageAt || ""}</span>
                                            </div>
                                            <div className="menu__mailboxPreview">{it.lastPreview || ""}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        );
    }

    // Role-based routing when logged in
    handleRoleHome = () => {
        if (this.state.isRoleLoaded) {
            window.location.replace(this.state.dashboardPath);
            return;
        }

        this.fetchDashboardRoute()
            .then((info) => window.location.replace(info.path))
            .catch(() => window.location.replace("/home"));
    };

    // Compute dynamic class upload ID (more general: any /class/:id/... path)
    getClassIdFromUrl(): string | null {
        const match = window.location.href.match(/\/student\/(\d+)/);
        return match ? match[1] : null;
    }

    render() {
        const classId = this.getClassIdFromUrl();

        const variant = this.props.variant ?? "app";
        const isPublic = variant === "public";
        const isHome = variant === "home";
        const loggedIn = this.isLoggedIn();
        const unread = this.state.isRoleLoaded && this.state.isStaff ? this.unreadCount() : 0;

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

                            <button
                                type="button"
                                className="menu__item"
                                onClick={() => this.props.onScrollToSection?.("about")}
                            >
                                About
                            </button>
                            <button
                                type="button"
                                className="menu__item"
                                onClick={() => this.props.onScrollToSection?.("event")}
                            >
                                Event
                            </button>
                            <button
                                type="button"
                                className="menu__item"
                                onClick={() => this.props.onScrollToSection?.("rules")}
                            >
                                Registration & Rules
                            </button>

                            <div className="menu__right">
                                {loggedIn ? (
                                    <>
                                        {this.state.isRoleLoaded && !this.state.isAdminRole && (
                                            <Link to="/student/help-requests" className="menu__item menu__item--link" title="My Help Requests">
                                                <FaQuestionCircle className="menu__icon" aria-hidden="true" />
                                                <span className="menu__text">Help Requests</span>
                                            </Link>
                                        )}
                                        {this.state.isRoleLoaded && this.state.isAdminRole && (
                                            <Link to="/admin/help-requests" className="menu__item menu__item--link" title="View Help Queue">
                                                <FaClipboardList className="menu__icon" aria-hidden="true" />
                                                <span className="menu__text">Help Queue</span>
                                            </Link>
                                        )}
                                        <button type="button" className="menu__item" onClick={this.handleRoleHome}>
                                            <FaHome className="menu__icon" aria-hidden="true" />
                                            <span className="menu__text">{this.state.dashboardLabel}</span>
                                        </button>
                                        {this.renderMailbox(unread)}
                                        <button
                                            type="button"
                                            className="menu__item menu__item--link menu__logout"
                                            onClick={this.handleLogout}
                                            title="Log Out"
                                        >
                                            <FaSignOutAlt className="menu__icon" aria-hidden="true" />
                                            <span className="menu__text">Log Out</span>
                                        </button>
                                    </>
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
                                    <>
                                        {this.state.isRoleLoaded && !this.state.isAdminRole && (
                                            <Link to="/student/help-requests" className="menu__item menu__item--link" title="My Help Requests">
                                                <FaQuestionCircle className="menu__icon" aria-hidden="true" />
                                                <span className="menu__text">Help Requests</span>
                                            </Link>
                                        )}
                                        {this.state.isRoleLoaded && this.state.isAdminRole && (
                                            <Link to="/admin/help-requests" className="menu__item menu__item--link" title="View Help Queue">
                                                <FaClipboardList className="menu__icon" aria-hidden="true" />
                                                <span className="menu__text">Help Queue</span>
                                            </Link>
                                        )}
                                        <button type="button" className="menu__item" onClick={this.handleRoleHome}>
                                            <FaHome className="menu__icon" aria-hidden="true" />
                                            <span className="menu__text">{this.state.dashboardLabel}</span>
                                        </button>
                                        {this.renderMailbox(unread)}
                                        <button
                                            type="button"
                                            className="menu__item menu__item--link menu__logout"
                                            onClick={this.handleLogout}
                                            title="Log Out"
                                        >
                                            <FaSignOutAlt className="menu__icon" aria-hidden="true" />
                                            <span className="menu__text">Log Out</span>
                                        </button>
                                    </>
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
                                <img
                                    className="menu__brandImg menu__brandImg--inline"
                                    src={abacusLogo}
                                    alt="Abacus logo"
                                />
                            </button>

                            <div className="menu__right">
                                {this.state.isRoleLoaded && !this.state.isAdminRole && (
                                    <Link
                                        to="/student/help-requests"
                                        className="menu__item menu__item--link"
                                        title="My Help Requests"
                                    >
                                        <FaQuestionCircle className="menu__icon" aria-hidden="true" />
                                        <span className="menu__text">Help Requests</span>
                                    </Link>
                                )}
                                {this.state.isRoleLoaded && this.state.isAdminRole && (
                                    <Link
                                        to="/admin/help-requests"
                                        className="menu__item menu__item--link"
                                        title="View Help Queue"
                                    >
                                        <FaClipboardList className="menu__icon" aria-hidden="true" />
                                        <span className="menu__text">Help Queue</span>
                                    </Link>
                                )}
                                {!this.state.isEagleStudent && (
                                    <button
                                        type="button"
                                        className="menu__item menu__item--link"
                                        onClick={this.handleRoleHome}
                                        title="Go to dashboard"
                                    >
                                        <FaHome className="menu__icon" aria-hidden="true" />
                                        <span className="menu__text">{this.state.dashboardLabel}</span>
                                    </button>
                                )}
                                {this.renderMailbox(unread)}
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