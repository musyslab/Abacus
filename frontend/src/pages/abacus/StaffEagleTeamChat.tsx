import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { useNavigate, useParams } from "react-router-dom";

import MenuComponent from "../components/MenuComponent";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";
import EagleChatThread from "../components/EagleChatThread";
import "../../styling/EagleDivision.scss";

type ChatRow = {
    id: number;
    sender: string;
    senderRole?: "student" | "admin" | "teacher";
    body: string;
    createdAt: string;
};

type EagleTeamSummary = {
    id: number;
    name: string;
    teamNumber: number;
    schoolId: number;
};

type Props = {
    viewer: "admin" | "teacher";
};

export default function StaffEagleTeamChat({ viewer }: Props) {
    const apiBase = (import.meta.env.VITE_API_URL as string) || "";
    const navigate = useNavigate();
    const { teamId } = useParams();

    const teamIdNum = useMemo(() => Number(teamId), [teamId]);

    const [messages, setMessages] = useState<ChatRow[]>([]);
    const [draft, setDraft] = useState("");
    const [error, setError] = useState("");
    const [sending, setSending] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [teamName, setTeamName] = useState("");

    const isTeacherView = viewer === "teacher";

    const authConfig = useCallback(() => {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        };
    }, []);

    const loadTeamName = useCallback(async () => {
        if (!Number.isFinite(teamIdNum) || teamIdNum <= 0) {
            setTeamName("");
            return;
        }

        try {
            const res = await axios.get<EagleTeamSummary[]>(
                `${apiBase}/eagle/teams`,
                authConfig()
            );

            const teams = Array.isArray(res.data) ? res.data : [];
            const team = teams.find((row) => row.id === teamIdNum);
            setTeamName(team?.name?.trim() || "");
        } catch {
            setTeamName("");
        }
    }, [apiBase, authConfig, teamIdNum]);

    const loadMessages = useCallback(async (showLoader = true) => {
        if (!Number.isFinite(teamIdNum) || teamIdNum <= 0) {
            setError("Invalid team id.");
            setMessages([]);
            return;
        }

        if (showLoader) setLoadingMessages(true);
        try {
            const res = await axios.get<ChatRow[]>(
                `${apiBase}/eagle/messages?team_id=${teamIdNum}`,
                authConfig()
            );
            setMessages(Array.isArray(res.data) ? res.data : []);
            setError("");
        } catch (err: any) {
            const msg = err?.response?.data?.message || "Could not load messages for this team.";
            setError(msg);
        } finally {
            if (showLoader) setLoadingMessages(false);
        }
    }, [apiBase, authConfig, teamIdNum]);

    useEffect(() => {
        loadTeamName();
    }, [loadTeamName]);

    useEffect(() => {
        loadMessages();
        const id = window.setInterval(() => loadMessages(false), 30000);
        return () => window.clearInterval(id);
    }, [loadMessages]);

    async function sendMessage(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (isTeacherView) {
            return;
        }

        const text = draft.trim();
        if (!text || sending) return;
        if (!Number.isFinite(teamIdNum) || teamIdNum <= 0) return;

        setSending(true);
        setError("");
        try {
            await axios.post(`${apiBase}/eagle/messages`, { team_id: teamIdNum, body: text }, authConfig());
            setDraft("");
            await loadMessages(false);
        } catch (err: any) {
            const msg = err?.response?.data?.message || "Send failed.";
            setError(msg);
        } finally {
            setSending(false);
        }
    }

    const breadcrumbs = viewer === "admin"
        ? [{ label: "Admin Menu", to: "/admin" }, { label: "School List", to: "/admin/schools" }, { label: "Team Manage", to: "/admin/schools" }, { label: "Eagle team chat" }]
        : [{ label: "Team Manage", to: "/teacher/team-manage" }, { label: "Eagle team chat" }];

    const title = viewer === "admin" ? "Eagle team chat - Admin" : "Eagle team chat - Teacher";

    return (
        <>
            <Helmet>
                <title>{title} - Abacus</title>
            </Helmet>
            <MenuComponent />
            <div className="eagle-home-root">
                <DirectoryBreadcrumbs items={breadcrumbs} trailingSeparator={true} />
                <div className="pageTitle">Eagle team chat</div>
                <div className="eagle-home-content eagle-home-content--admin-chat-solo">
                    <p className="eagle-home__subtitle">
                        {isTeacherView
                            ? "Viewing this thread as the student team sees it. Teachers can review messages here, but cannot reply."
                            : "Reply to this Eagle team. Messages stay in sync with what the student team sees."}
                    </p>

                    <div className="eagle-home__grid eagle-home__grid--admin-solo">
                        <section className="eagle-card eagle-card--chat eagle-card--admin-solo">
                            <div className="eagle-card__eyebrow">Team thread</div>
                            <h2 className="eagle-card__heading">Messages</h2>

                            {error ? (
                                <div className="eagle-alert eagle-alert--error" role="alert">
                                    {error}
                                </div>
                            ) : null}

                            <EagleChatThread
                                messages={messages}
                                loading={loadingMessages}
                                loadingText="Loading messages..."
                                draft={draft}
                                onDraftChange={setDraft}
                                onSend={sendMessage}
                                sending={sending}
                                disabled={isTeacherView}
                                placeholder={
                                    isTeacherView
                                        ? "Teachers can view this chat but cannot reply."
                                        : "Reply to this team..."
                                }
                                ariaLabel={isTeacherView ? "Read-only team chat" : "Staff reply"}
                                submitLabel={isTeacherView ? "Reply disabled" : "Send"}
                                sendingLabel="Sending..."
                                emptyText="No messages yet."
                                audience={isTeacherView ? "student" : "staff"}
                                ownSenderLabel={isTeacherView ? (teamName || "Team") : undefined}
                                extraActions={
                                    <button
                                        type="button"
                                        className="eagle-btn eagle-btn--secondary"
                                        onClick={() => navigate(-1)}
                                    >
                                        Back
                                    </button>
                                }
                            />
                        </section>
                    </div>
                </div>
            </div>
        </>
    );
}