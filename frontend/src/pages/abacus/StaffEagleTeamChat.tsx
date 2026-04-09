import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { FaPaperPlane } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";

import MenuComponent from "../components/MenuComponent";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";
import EagleChatMessageRow from "../components/EagleChatMessageRow";
import "../../styling/StudentEagleHome.scss";

type ChatRow = {
    id: number;
    sender: string;
    senderRole?: "student" | "admin" | "teacher";
    body: string;
    createdAt: string;
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
    const chatLogRef = useRef<HTMLDivElement | null>(null);
    const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);

    const authConfig = useCallback(() => {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        };
    }, []);

    const loadMessages = useCallback(async () => {
        if (!Number.isFinite(teamIdNum) || teamIdNum <= 0) {
            setError("Invalid team id.");
            setMessages([]);
            return;
        }
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
        }
    }, [apiBase, authConfig, teamIdNum]);

    useEffect(() => {
        loadMessages();
        const id = window.setInterval(loadMessages, 10000);
        return () => window.clearInterval(id);
    }, [loadMessages]);

    useEffect(() => {
        if (!isPinnedToBottom) return;
        const el = chatLogRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [messages, isPinnedToBottom]);

    async function sendMessage(e: React.FormEvent) {
        e.preventDefault();
        const text = draft.trim();
        if (!text || sending) return;
        if (!Number.isFinite(teamIdNum) || teamIdNum <= 0) return;
        setSending(true);
        setError("");
        try {
            await axios.post(`${apiBase}/eagle/messages`, { team_id: teamIdNum, body: text }, authConfig());
            setDraft("");
            await loadMessages();
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

    const title = viewer === "admin" ? "Eagle team chat — Admin" : "Eagle team chat — Teacher";

    return (
        <>
            <Helmet>
                <title>{title} — Abacus</title>
            </Helmet>
            <MenuComponent />
            <div className="eagle-home-root">
                <DirectoryBreadcrumbs items={breadcrumbs} trailingSeparator={true} />
                <div className="pageTitle">Eagle team chat</div>
                <div className="eagle-home-content eagle-home-content--admin-chat-solo">
                    <p className="eagle-home__subtitle">
                        Reply to this Eagle team. Messages stay in sync with what the student team sees.
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

                            <div
                                ref={chatLogRef}
                                className="eagle-chat-log"
                                role="log"
                                aria-live="polite"
                                onScroll={() => {
                                    const el = chatLogRef.current;
                                    if (!el) return;
                                    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                                    setIsPinnedToBottom(nearBottom);
                                }}
                            >
                                {messages.length === 0 ? (
                                    <p className="eagle-empty-chat">No messages yet.</p>
                                ) : (
                                    messages.map((m) => (
                                        <EagleChatMessageRow key={m.id} message={m} audience="staff" />
                                    ))
                                )}
                            </div>

                            <form className="eagle-chat-form" onSubmit={sendMessage}>
                                <textarea
                                    className="eagle-chat-input"
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key !== "Enter" || e.shiftKey) return;
                                        e.preventDefault();
                                        (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                                    }}
                                    placeholder="Reply to this team…"
                                    maxLength={8000}
                                    aria-label="Staff reply"
                                />
                                <button
                                    type="submit"
                                    className="eagle-btn eagle-btn--primary"
                                    disabled={sending || !draft.trim()}
                                >
                                    <FaPaperPlane aria-hidden />
                                    {sending ? "Sending…" : "Send"}
                                </button>
                                <button
                                    type="button"
                                    className="eagle-btn eagle-btn--secondary"
                                    onClick={() => navigate(-1)}
                                >
                                    Back
                                </button>
                            </form>
                        </section>
                    </div>
                </div>
            </div>
        </>
    );
}

