import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { FaPaperPlane } from "react-icons/fa";

import MenuComponent from "../components/MenuComponent";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";
import EagleChatMessageRow from "../components/EagleChatMessageRow";
import "../../styling/StudentEagleHome.scss";

type TeamOpt = { id: number; name: string; teamNumber: number; schoolId: number };
type ChatRow = {
    id: number;
    sender: string;
    senderRole?: "student" | "admin" | "teacher";
    body: string;
    createdAt: string;
};

export default function AdminEagleChat() {
    const apiBase = (import.meta.env.VITE_API_URL as string) || "";

    const [teams, setTeams] = useState<TeamOpt[]>([]);
    const [teamId, setTeamId] = useState<number | "">("");
    const [messages, setMessages] = useState<ChatRow[]>([]);
    const [draft, setDraft] = useState("");
    const [error, setError] = useState("");
    const [sending, setSending] = useState(false);
    const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
    const teamDropdownRef = useRef<HTMLDivElement | null>(null);
    const chatLogRef = useRef<HTMLDivElement | null>(null);
    const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);

    const selectedTeamLabel = useMemo(() => {
        if (!teamId) return "Select a team…";
        const t = teams.find((x) => x.id === teamId) || null;
        if (!t) return "Select a team…";
        return `#${t.teamNumber} — ${t.name} (school ${t.schoolId})`;
    }, [teams, teamId]);

    const authConfig = useCallback(() => {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        };
    }, []);

    const loadTeams = useCallback(async () => {
        try {
            const res = await axios.get<TeamOpt[]>(`${apiBase}/eagle/teams`, authConfig());
            setTeams(Array.isArray(res.data) ? res.data : []);
        } catch {
            setError("Could not load Eagle teams.");
        }
    }, [apiBase, authConfig]);

    const loadMessages = useCallback(async () => {
        if (!teamId) {
            setMessages([]);
            return;
        }
        try {
            const res = await axios.get<ChatRow[]>(
                `${apiBase}/eagle/messages?team_id=${teamId}`,
                authConfig()
            );
            setMessages(Array.isArray(res.data) ? res.data : []);
            setError("");
        } catch {
            setError("Could not load messages for this team.");
        }
    }, [apiBase, authConfig, teamId]);

    useEffect(() => {
        loadTeams();
    }, [loadTeams]);

    useEffect(() => {
        loadMessages();
        const id = window.setInterval(loadMessages, 30000);
        return () => window.clearInterval(id);
    }, [loadMessages]);

    useEffect(() => {
        if (!teamDropdownOpen) return;
        function onDocMouseDown(e: MouseEvent) {
            const el = teamDropdownRef.current;
            if (!el) return;
            if (e.target instanceof Node && el.contains(e.target)) return;
            setTeamDropdownOpen(false);
        }
        document.addEventListener("mousedown", onDocMouseDown);
        return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, [teamDropdownOpen]);

    useEffect(() => {
        if (!isPinnedToBottom) return;
        const el = chatLogRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [messages, isPinnedToBottom]);

    async function sendMessage(e: React.FormEvent) {
        e.preventDefault();
        if (!teamId || !draft.trim() || sending) return;
        setSending(true);
        setError("");
        try {
            await axios.post(
                `${apiBase}/eagle/messages`,
                { team_id: teamId, body: draft.trim() },
                authConfig()
            );
            setDraft("");
            await loadMessages();
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { message?: string } } };
            setError(ax.response?.data?.message || "Send failed.");
        } finally {
            setSending(false);
        }
    }

    return (
        <>
            <Helmet>
                <title>Eagle Division chat — Admin — Abacus</title>
            </Helmet>
            <MenuComponent />
            <div className="eagle-home-root">
                <DirectoryBreadcrumbs
                    items={[{ label: "Admin Menu", to: "/admin" }, { label: "Eagle division chat" }]}
                    trailingSeparator={true}
                />
                <div className="pageTitle">Eagle division — admin chat</div>
                <div className="eagle-home-content eagle-home-content--admin-chat-solo">
                    <p className="eagle-home__subtitle">
                        Select a virtual Eagle team and reply in the shared thread.
                    </p>

                    <div className="eagle-home__grid eagle-home__grid--admin-solo">
                        <section className="eagle-card eagle-card--chat eagle-card--admin-solo">
                            <div className="eagle-card__eyebrow">Team thread</div>
                            <h2 className="eagle-card__heading">Messages</h2>
                            <div className="eagle-admin-toolbar">
                                <span className="eagle-team-select-label">Eagle team</span>
                                <div
                                    ref={teamDropdownRef}
                                    className="eagle-team-select-wrap"
                                >
                                    <button
                                        type="button"
                                        className="eagle-team-select-trigger"
                                        aria-haspopup="listbox"
                                        aria-expanded={teamDropdownOpen}
                                        onClick={() => setTeamDropdownOpen((v) => !v)}
                                    >
                                        {selectedTeamLabel}
                                    </button>
                                    {teamDropdownOpen ? (
                                        <div className="eagle-team-select-menu" role="listbox" aria-label="Eagle team">
                                            <button
                                                type="button"
                                                className={!teamId ? "eagle-team-select-option is-selected" : "eagle-team-select-option"}
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => {
                                                    setTeamId("");
                                                    setTeamDropdownOpen(false);
                                                }}
                                                role="option"
                                                aria-selected={!teamId}
                                            >
                                                Select a team…
                                            </button>
                                            {teams.map((t) => {
                                                const selected = teamId === t.id;
                                                return (
                                                    <button
                                                        key={t.id}
                                                        type="button"
                                                        className={
                                                            selected
                                                                ? "eagle-team-select-option is-selected"
                                                                : "eagle-team-select-option"
                                                        }
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => {
                                                            setTeamId(t.id);
                                                            setTeamDropdownOpen(false);
                                                        }}
                                                        role="option"
                                                        aria-selected={selected}
                                                    >
                                                        #{t.teamNumber} — {t.name} (school {t.schoolId})
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
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
                            {!teamId ? (
                                <p className="eagle-empty-chat">Choose a team to load messages.</p>
                            ) : messages.length === 0 ? (
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
                                placeholder={teamId ? "Reply to this team…" : "Select a team first"}
                                maxLength={8000}
                                disabled={!teamId}
                                aria-label="Admin reply"
                            />
                            <button
                                type="submit"
                                className="eagle-btn eagle-btn--primary"
                                disabled={sending || !teamId || !draft.trim()}
                            >
                                <FaPaperPlane aria-hidden />
                                {sending ? "Sending…" : "Send reply"}
                            </button>
                        </form>
                        </section>
                    </div>
                </div>
            </div>
        </>
    );
}
