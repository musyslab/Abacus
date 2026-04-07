import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { FaPaperPlane } from "react-icons/fa";

import MenuComponent from "../components/MenuComponent";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";
import "../../styling/StudentEagleHome.scss";

type TeamOpt = { id: number; name: string; teamNumber: number; schoolId: number };
type ChatRow = { id: number; sender: string; body: string; createdAt: string };
type ProblemPayload = {
    projectId: number | null;
    name: string | null;
    preview: string | null;
    previewKind: string | null;
    filename: string | null;
    hint: string | null;
};

export default function AdminEagleChat() {
    const apiBase = (import.meta.env.VITE_API_URL as string) || "";

    const [teams, setTeams] = useState<TeamOpt[]>([]);
    const [teamId, setTeamId] = useState<number | "">("");
    const [messages, setMessages] = useState<ChatRow[]>([]);
    const [problem, setProblem] = useState<ProblemPayload | null>(null);
    const [draft, setDraft] = useState("");
    const [error, setError] = useState("");
    const [sending, setSending] = useState(false);

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

    const loadProblem = useCallback(async () => {
        try {
            const res = await axios.get<ProblemPayload>(`${apiBase}/eagle/problem`, authConfig());
            setProblem(res.data);
        } catch {
            setProblem(null);
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
        loadProblem();
    }, [loadTeams, loadProblem]);

    useEffect(() => {
        loadMessages();
        const id = window.setInterval(loadMessages, 10000);
        return () => window.clearInterval(id);
    }, [loadMessages]);

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

    const showTextPreview = problem?.previewKind === "text" && (problem?.preview || "").length > 0;

    return (
        <>
            <Helmet>
                <title>Eagle Division chat — Admin — Abacus</title>
            </Helmet>
            <MenuComponent />
            <div className="eagle-home-page">
                <DirectoryBreadcrumbs
                    items={[{ label: "Admin Menu", to: "/admin" }, { label: "Eagle division chat" }]}
                    trailingSeparator={false}
                />
                <h1 className="eagle-home__title">Eagle division — admin chat</h1>
                <p className="eagle-home__subtitle">
                    Select a virtual Eagle team, review the published problem summary, and reply in the shared
                    thread.
                </p>

                <div className="eagle-home__grid">
                    <section className="eagle-card eagle-card--problem">
                        <div className="eagle-card__eyebrow">Reference</div>
                        <h2 className="eagle-card__heading">{problem?.name || "Eagle competition problem"}</h2>
                        {problem?.hint ? <p className="eagle-card__body">{problem.hint}</p> : null}
                        {showTextPreview ? (
                            <div className="eagle-problem-preview">{problem?.preview}</div>
                        ) : null}
                        {!problem?.projectId ? (
                            <p className="eagle-card__body">
                                Configure a competition project (name containing &quot;Eagle&quot;) so students see
                                the correct brief.
                            </p>
                        ) : null}
                    </section>

                    <section className="eagle-card eagle-card--chat">
                        <div className="eagle-card__eyebrow">Team thread</div>
                        <h2 className="eagle-card__heading">Messages</h2>
                        <div className="eagle-admin-toolbar">
                            <label htmlFor="eagle-team-select">Eagle team</label>
                            <select
                                id="eagle-team-select"
                                className="eagle-team-select"
                                value={teamId === "" ? "" : String(teamId)}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setTeamId(v ? parseInt(v, 10) : "");
                                }}
                            >
                                <option value="">Select a team…</option>
                                {teams.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        #{t.teamNumber} — {t.name} (school {t.schoolId})
                                    </option>
                                ))}
                            </select>
                        </div>
                        {error ? (
                            <div className="eagle-alert eagle-alert--error" role="alert">
                                {error}
                            </div>
                        ) : null}
                        <div className="eagle-chat-log" role="log" aria-live="polite">
                            {!teamId ? (
                                <p className="eagle-empty-chat">Choose a team to load messages.</p>
                            ) : messages.length === 0 ? (
                                <p className="eagle-empty-chat">No messages yet.</p>
                            ) : (
                                messages.map((m) => (
                                    <div
                                        key={m.id}
                                        className={
                                            m.sender === "admin"
                                                ? "eagle-chat-bubble eagle-chat-bubble--admin"
                                                : "eagle-chat-bubble eagle-chat-bubble--student"
                                        }
                                    >
                                        <div>{m.body}</div>
                                        <div className="eagle-chat-meta">
                                            {m.sender === "admin" ? "Admin" : "Student team"} ·{" "}
                                            {m.createdAt || ""}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <form className="eagle-chat-form" onSubmit={sendMessage}>
                            <textarea
                                className="eagle-chat-input"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
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
        </>
    );
}
