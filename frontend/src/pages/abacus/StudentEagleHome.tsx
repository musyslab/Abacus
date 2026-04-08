import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { FaDownload, FaPaperPlane } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import MenuComponent from "../components/MenuComponent";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";
import "../../styling/StudentEagleHome.scss";

type ProblemPayload = {
    projectId: number | null;
    name: string | null;
    preview: string | null;
    previewKind: string | null;
    filename: string | null;
    hint: string | null;
};

type ChatRow = {
    id: number;
    sender: string;
    body: string;
    createdAt: string;
};

export default function StudentEagleHome() {
    const apiBase = (import.meta.env.VITE_API_URL as string) || "";
    const navigate = useNavigate();

    const [problem, setProblem] = useState<ProblemPayload | null>(null);
    const [problemError, setProblemError] = useState("");
    const [messages, setMessages] = useState<ChatRow[]>([]);
    const [chatError, setChatError] = useState("");
    const [draft, setDraft] = useState("");
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

    const loadProblem = useCallback(async () => {
        setProblemError("");
        try {
            const res = await axios.get<ProblemPayload>(`${apiBase}/eagle/problem`, authConfig());
            setProblem(res.data);
        } catch (err: unknown) {
            const ax = err as { response?: { status?: number; data?: { message?: string } } };
            if (ax.response?.status === 403) {
                navigate("/student/problems", { replace: true });
                return;
            }
            setProblemError(ax.response?.data?.message || "Could not load the Eagle problem.");
        }
    }, [apiBase, authConfig, navigate]);

    const loadMessages = useCallback(async () => {
        try {
            const res = await axios.get<ChatRow[]>(`${apiBase}/eagle/messages`, authConfig());
            setMessages(Array.isArray(res.data) ? res.data : []);
            setChatError("");
        } catch (err: unknown) {
            const ax = err as { response?: { status?: number } };
            if (ax.response?.status === 403) {
                navigate("/student/problems", { replace: true });
                return;
            }
            setChatError(
                "Could not load messages. If this persists, ask an admin to run the EagleTeamMessages database setup."
            );
        }
    }, [apiBase, authConfig, navigate]);

    useEffect(() => {
        loadProblem();
    }, [loadProblem]);

    useEffect(() => {
        loadMessages();
        const id = window.setInterval(loadMessages, 12000);
        return () => window.clearInterval(id);
    }, [loadMessages]);

    function downloadInstructions() {
        setProblemError("");
        axios
            .get(`${apiBase}/eagle/instructions`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("AUTOTA_AUTH_TOKEN")}` },
                responseType: "blob",
            })
            .then((res) => {
                const type = (res.headers as Record<string, string>)["content-type"] || "application/pdf";
                const blob = new Blob([res.data], { type });
                const name = "Eagle-Division-2026.pdf";
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = name;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            })
            .catch(() => setProblemError("Download failed. Try again or contact an admin."));
    }

    async function sendMessage(e: React.FormEvent) {
        e.preventDefault();
        const text = draft.trim();
        if (!text || sending) return;
        setSending(true);
        setChatError("");
        try {
            await axios.post(`${apiBase}/eagle/messages`, { body: text }, authConfig());
            setDraft("");
            await loadMessages();
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { message?: string } } };
            setChatError(ax.response?.data?.message || "Failed to send.");
        } finally {
            setSending(false);
        }
    }

    const previewKind = problem?.previewKind || "";
    const showTextPreview = previewKind === "text" && (problem?.preview || "").length > 0;

    return (
        <>
            <Helmet>
                <title>Eagle Division — Abacus</title>
            </Helmet>
            <MenuComponent />
            <div className="eagle-home-root">
                <DirectoryBreadcrumbs
                    items={[{ label: "Eagle Division", to: "/student/eagle-home" }, { label: "Home" }]}
                    trailingSeparator={true}
                />
                <div className="pageTitle">Eagle Division</div>
                <div className="eagle-home-content">
                    <p className="eagle-home__subtitle">
                        Your team&apos;s competition brief and a direct line to administrators for virtual
                        competition support.
                    </p>

                    <div className="eagle-home__grid">
                        <section className="eagle-card eagle-card--problem" aria-labelledby="eagle-problem-heading">
                            <div className="eagle-card__eyebrow">Competition problem</div>
                            <h2 id="eagle-problem-heading" className="eagle-card__heading">
                                {problem?.name || "Eagle problem"}
                            </h2>
                            <div className="eagle-card__main">
                                {problemError ? (
                                    <div className="eagle-alert eagle-alert--error" role="alert">
                                        {problemError}
                                    </div>
                                ) : null}
                                <p className="eagle-card__body">
                                    Official Eagle Division rules and problem details are in the instructions PDF.
                                    Use the button below to download it.
                                </p>
                                {showTextPreview ? (
                                    <div className="eagle-problem-preview">{problem?.preview}</div>
                                ) : null}
                                {(previewKind === "pdf" || previewKind === "other" || previewKind === "missing") &&
                                problem?.projectId ? (
                                    <p className="eagle-card__body">
                                        Full instructions are in{" "}
                                        <strong>{problem.filename || "the assignment file"}</strong>. Use download to
                                        open it.
                                    </p>
                                ) : null}
                            </div>
                            <div className="eagle-actions">
                                <button
                                    type="button"
                                    className="eagle-btn eagle-btn--primary"
                                    onClick={downloadInstructions}
                                >
                                    <FaDownload aria-hidden />
                                    Download instructions
                                </button>
                            </div>
                        </section>

                        <section className="eagle-card eagle-card--chat" aria-labelledby="eagle-chat-heading">
                            <div className="eagle-card__eyebrow">Admin chat</div>
                            <h2 id="eagle-chat-heading" className="eagle-card__heading">
                                Message administrators
                            </h2>
                            <p className="eagle-card__body eagle-card__body--chat-intro">
                                Messages here are visible to competition administrators for your team only. Check back
                                for replies.
                            </p>
                            {chatError ? (
                                <div className="eagle-alert eagle-alert--error" role="alert">
                                    {chatError}
                                </div>
                            ) : null}
                            <div className="eagle-chat-log" role="log" aria-live="polite">
                            {messages.length === 0 ? (
                                <p className="eagle-empty-chat">No messages yet. Say hello below.</p>
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
                                            {m.sender === "admin" ? "Administrator" : "Your team"} ·{" "}
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
                                placeholder="Type a message to admins…"
                                maxLength={8000}
                                aria-label="Message to administrators"
                            />
                            <button
                                type="submit"
                                className="eagle-btn eagle-btn--primary"
                                disabled={sending || !draft.trim()}
                            >
                                <FaPaperPlane aria-hidden />
                                {sending ? "Sending…" : "Send"}
                            </button>
                        </form>
                        </section>
                    </div>
                </div>
            </div>
        </>
    );
}
