import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { FaSync } from "react-icons/fa";

import MenuComponent from "../components/MenuComponent";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";
import EagleChatThread from "../components/EagleChatThread";
import "../../styling/EagleDivision.scss";

type EagleConversationStage =
    | "needs_admin_reply"
    | "waiting_for_requester"
    | "no_messages";

type TeamConversationRow = {
    id: number;
    name: string;
    teamNumber: number;
    schoolId: number;
    lastMessagePreview?: string | null;
    lastMessageAt?: string | null;
    lastMessageSenderRole?: "student" | "admin" | "teacher" | null;
    conversationStage?: EagleConversationStage;
    messageCount?: number;
};

type ApiConversationRow = {
    teamId: number;
    teamName: string;
    teamNumber: number;
    schoolId: number;
    lastMessagePreview?: string | null;
    lastMessageAt?: string | null;
    lastSenderRole?: "student" | "admin" | "teacher" | null;
    conversationStage?: EagleConversationStage;
    messageCount?: number;
};

type ChatRow = {
    id: number;
    sender: string;
    senderRole?: "student" | "admin" | "teacher";
    body: string;
    createdAt: string;
};

export default function AdminEagleChat() {
    const apiBase = (import.meta.env.VITE_API_URL as string) || "";

    const [teams, setTeams] = useState<TeamConversationRow[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
    const [messages, setMessages] = useState<ChatRow[]>([]);
    const [draft, setDraft] = useState("");
    const [teamsError, setTeamsError] = useState("");
    const [messagesError, setMessagesError] = useState("");
    const [sending, setSending] = useState(false);
    const [loadingTeams, setLoadingTeams] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);

    const authConfig = useCallback(() => {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        };
    }, []);

    const toSafeDate = useCallback((timestampStr: string | null | undefined) => {
        if (!timestampStr) return null;
        let safeTimestampStr = timestampStr.replace(" ", "T");
        if (!safeTimestampStr.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(safeTimestampStr)) {
            safeTimestampStr += "Z";
        }
        const parsed = new Date(safeTimestampStr);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }, []);

    const formatDateTime = useCallback((timestampStr: string | null | undefined) => {
        const parsed = toSafeDate(timestampStr);
        if (!parsed) return "-";
        return parsed.toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }, [toSafeDate]);

    const getConversationStage = useCallback((team: TeamConversationRow | null | undefined): EagleConversationStage => {
        if (!team) return "no_messages";
        if (team.conversationStage) return team.conversationStage;
        if ((team.messageCount ?? 0) === 0) return "no_messages";
        return team.lastMessageSenderRole === "student"
            ? "needs_admin_reply"
            : "waiting_for_requester";
    }, []);

    const getConversationLabel = useCallback((stage: EagleConversationStage) => {
        if (stage === "needs_admin_reply") return "Needs Admin Reply";
        if (stage === "waiting_for_requester") return "Waiting for Requester";
        return "No Messages Yet";
    }, []);

    const getTeamActivityTime = useCallback((team: TeamConversationRow) => {
        return toSafeDate(team.lastMessageAt)?.getTime() ?? 0;
    }, [toSafeDate]);

    const loadTeams = useCallback(async (showLoader = true) => {
        if (showLoader) setLoadingTeams(true);
        try {
            const res = await axios.get<ApiConversationRow[]>(
                `${apiBase}/eagle/conversations`,
                authConfig()
            );

            const normalized = Array.isArray(res.data)
                ? res.data.map((row) => ({
                    id: row.teamId,
                    name: row.teamName,
                    teamNumber: row.teamNumber,
                    schoolId: row.schoolId,
                    lastMessagePreview: row.lastMessagePreview ?? null,
                    lastMessageAt: row.lastMessageAt ?? null,
                    lastMessageSenderRole: row.lastSenderRole ?? null,
                    conversationStage: row.conversationStage,
                    messageCount: row.messageCount ?? 0,
                }))
                : [];

            setTeams(normalized);
            setTeamsError("");
        } catch {
            setTeamsError("Could not load Eagle teams.");
        } finally {
            if (showLoader) setLoadingTeams(false);
        }
    }, [apiBase, authConfig]);

    const loadMessages = useCallback(async (teamId: number | null, showLoader = true) => {
        if (!teamId) {
            setMessages([]);
            setMessagesError("");
            return;
        }

        if (showLoader) setLoadingMessages(true);
        try {
            const res = await axios.get<ChatRow[]>(
                `${apiBase}/eagle/messages?team_id=${teamId}`,
                authConfig()
            );
            setMessages(Array.isArray(res.data) ? res.data : []);
            setMessagesError("");
        } catch {
            setMessages([]);
            setMessagesError("Could not load messages for this team.");
        } finally {
            if (showLoader) setLoadingMessages(false);
        }
    }, [apiBase, authConfig]);

    const refreshAll = useCallback(async () => {
        await loadTeams();
        if (selectedTeamId) {
            await loadMessages(selectedTeamId, false);
        }
    }, [loadTeams, loadMessages, selectedTeamId]);

    useEffect(() => {
        loadTeams();
        const id = window.setInterval(() => {
            loadTeams(false);
            if (selectedTeamId) {
                loadMessages(selectedTeamId, false);
            }
        }, 30000);
        return () => window.clearInterval(id);
    }, [loadTeams, loadMessages, selectedTeamId]);

    const sortedTeams = useMemo(() => {
        return [...teams].sort((a, b) => {
            const stageCompare =
                getConversationStage(a).localeCompare(getConversationStage(b));
            if (stageCompare !== 0) {
                return stageCompare;
            }

            if (getConversationStage(a) === "no_messages") {
                if (a.schoolId !== b.schoolId) return a.schoolId - b.schoolId;
                if (a.teamNumber !== b.teamNumber) return a.teamNumber - b.teamNumber;
                return a.name.localeCompare(b.name);
            }

            return getTeamActivityTime(b) - getTeamActivityTime(a);
        });
    }, [teams, getConversationStage, getTeamActivityTime]);

    const needsAdminReplyTeams = useMemo(() => {
        return sortedTeams.filter((team) => getConversationStage(team) === "needs_admin_reply");
    }, [sortedTeams, getConversationStage]);

    const waitingForRequesterTeams = useMemo(() => {
        return sortedTeams.filter((team) => getConversationStage(team) === "waiting_for_requester");
    }, [sortedTeams, getConversationStage]);

    const noMessageTeams = useMemo(() => {
        return sortedTeams.filter((team) => getConversationStage(team) === "no_messages");
    }, [sortedTeams, getConversationStage]);

    useEffect(() => {
        if (teams.length === 0) {
            setSelectedTeamId(null);
            setMessages([]);
            return;
        }

        const selectedStillExists = teams.some((team) => team.id === selectedTeamId);
        if (selectedStillExists) return;

        const preferred =
            needsAdminReplyTeams[0] ||
            waitingForRequesterTeams[0] ||
            noMessageTeams[0] ||
            teams[0] ||
            null;

        setSelectedTeamId(preferred?.id ?? null);
    }, [teams, selectedTeamId, needsAdminReplyTeams, waitingForRequesterTeams, noMessageTeams]);

    useEffect(() => {
        loadMessages(selectedTeamId);
    }, [selectedTeamId, loadMessages]);

    const selectedTeam = useMemo(() => {
        return teams.find((team) => team.id === selectedTeamId) || null;
    }, [teams, selectedTeamId]);

    const selectedTeamLabel = useMemo(() => {
        if (!selectedTeam) return "Select a team";
        return `#${selectedTeam.teamNumber} - ${selectedTeam.name}`;
    }, [selectedTeam]);

    const selectedTeamMeta = useMemo(() => {
        if (!selectedTeam) return "";
        return `School ${selectedTeam.schoolId}`;
    }, [selectedTeam]);

    function handleTeamCardKeyDown(
        e: React.KeyboardEvent<HTMLDivElement>,
        teamId: number
    ) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSelectedTeamId(teamId);
        }
    }

    async function sendMessage(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!selectedTeamId || !draft.trim() || sending) return;

        setSending(true);
        setMessagesError("");
        try {
            await axios.post(
                `${apiBase}/eagle/messages`,
                { team_id: selectedTeamId, body: draft.trim() },
                authConfig()
            );
            setDraft("");
            await refreshAll();
            await loadMessages(selectedTeamId, false);
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { message?: string } } };
            setMessagesError(ax.response?.data?.message || "Send failed.");
        } finally {
            setSending(false);
        }
    }

    function renderTeamCard(team: TeamConversationRow) {
        const stage = getConversationStage(team);
        const selected = selectedTeamId === team.id;

        const footerText =
            stage === "no_messages"
                ? "No messages yet."
                : stage === "needs_admin_reply"
                    ? `Student messaged ${formatDateTime(team.lastMessageAt)}`
                    : `Staff replied ${formatDateTime(team.lastMessageAt)}`;

        return (
            <div
                key={team.id}
                className={`eagle-admin-team-card ${selected ? "is-selected" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedTeamId(team.id)}
                onKeyDown={(e) => handleTeamCardKeyDown(e, team.id)}
            >
                <div className="eagle-admin-team-card__top">
                    <span className={`eagle-admin-team-card__badge is-${stage.replaceAll("_", "-")}`}>
                        {getConversationLabel(stage)}
                    </span>
                    <span className="eagle-admin-team-card__count">
                        {team.messageCount ?? 0} messages
                    </span>
                </div>

                <div className="eagle-admin-team-card__title">
                    #{team.teamNumber} - {team.name}
                </div>

                <div className="eagle-admin-team-card__meta">
                    <span>School {team.schoolId}</span>
                </div>

                <div className="eagle-admin-team-card__preview">
                    {team.lastMessagePreview || "No messages yet."}
                </div>

                <div className="eagle-admin-team-card__footer">{footerText}</div>
            </div>
        );
    }

    function renderTeamSection(title: string, items: TeamConversationRow[], emptyText: string) {
        return (
            <section className="eagle-card eagle-card--team-list">
                <div className="eagle-admin-section__header">
                    <h2 className="eagle-admin-section__title">{title}</h2>
                    <span className="eagle-admin-section__count">{items.length}</span>
                </div>

                <div className="eagle-admin-team-list">
                    {items.length === 0 ? (
                        <div className="eagle-empty-chat">
                            {loadingTeams && teams.length === 0 ? "Loading teams..." : emptyText}
                        </div>
                    ) : (
                        items.map(renderTeamCard)
                    )}
                </div>
            </section>
        );
    }

    return (
        <>
            <Helmet>
                <title>[Admin] Abacus</title>
            </Helmet>
            <MenuComponent />
            <div className="eagle-home-root">
                <DirectoryBreadcrumbs
                    items={[{ label: "Admin Menu", to: "/admin" }, { label: "Eagle Division Admin Chat" }]}
                    trailingSeparator={true}
                />
                <div className="pageTitle">Eagle Division Admin Chat</div>
                <div className="eagle-home-content eagle-home-content--admin-chat-solo">
                    <p className="eagle-home__subtitle">
                        Teams are grouped by who should respond next so new student messages are easy to spot.
                    </p>

                    <div className="eagle-admin-chat-layout">
                        <aside className="eagle-admin-chat-layout__sidebar">
                            {teamsError ? (
                                <div className="eagle-alert eagle-alert--error" role="alert">
                                    {teamsError}
                                </div>
                            ) : null}

                            {renderTeamSection(
                                "Needs Admin Reply",
                                needsAdminReplyTeams,
                                "No teams are currently waiting on an admin reply."
                            )}

                            {renderTeamSection(
                                "Waiting for Requester",
                                waitingForRequesterTeams,
                                "No teams are currently waiting on a requester reply."
                            )}

                            {renderTeamSection(
                                "No Messages Yet",
                                noMessageTeams,
                                "Every Eagle team has already started a chat."
                            )}
                        </aside>

                        <section className="eagle-card eagle-card--chat eagle-card--admin-solo">
                            {!selectedTeam ? (
                                <div className="eagle-empty-chat">Select a team to view its thread.</div>
                            ) : (
                                <>
                                    <div className="eagle-card__eyebrow">Team thread</div>
                                    <div className="eagle-admin-thread-header">
                                        <div>
                                            <h2 className="eagle-card__heading">{selectedTeamLabel}</h2>
                                            <p className="eagle-card__body eagle-card__body--chat-intro">
                                                {selectedTeamMeta}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            className="eagle-btn eagle-btn--secondary"
                                            onClick={refreshAll}
                                        >
                                            <FaSync aria-hidden />
                                            Refresh
                                        </button>
                                    </div>

                                    {messagesError ? (
                                        <div className="eagle-alert eagle-alert--error" role="alert">
                                            {messagesError}
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
                                        disabled={!selectedTeam}
                                        placeholder="Reply to this team..."
                                        ariaLabel="Admin reply"
                                        submitLabel="Send reply"
                                        sendingLabel="Sending..."
                                        emptyText="No messages yet."
                                        audience="staff"
                                    />
                                </>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </>
    );
}