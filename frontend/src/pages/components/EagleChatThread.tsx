import React, { useEffect, useRef, useState } from "react";
import { FaPaperPlane } from "react-icons/fa";

export interface EagleChatConversationMessage {
    id: number;
    sender: string;
    senderRole?: "student" | "admin" | "teacher";
    body: string;
    createdAt: string;
}

interface Props {
    messages: EagleChatConversationMessage[];
    loading?: boolean;
    loadingText?: string;
    draft: string;
    onDraftChange: (value: string) => void;
    onSend: (e: React.FormEvent<HTMLFormElement>) => void;
    sending: boolean;
    disabled?: boolean;
    placeholder: string;
    ariaLabel: string;
    submitLabel: string;
    sendingLabel: string;
    emptyText: string;
    audience: "student" | "staff";
    extraActions?: React.ReactNode;
    ownSenderLabel?: string;
}

function toSafeDate(timestampStr: string | null | undefined) {
    if (!timestampStr) return null;
    let safeTimestampStr = timestampStr.replace(" ", "T");
    if (!safeTimestampStr.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(safeTimestampStr)) {
        safeTimestampStr += "Z";
    }
    const parsed = new Date(safeTimestampStr);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(timestampStr: string | null | undefined) {
    const parsed = toSafeDate(timestampStr);
    if (!parsed) return "-";
    return parsed.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function isOwnMessage(
    message: EagleChatConversationMessage,
    audience: "student" | "staff"
) {
    if (audience === "student") {
        return message.senderRole === "student";
    }

    return message.senderRole === "admin" || message.senderRole === "teacher";
}

function getSenderLabel(
    message: EagleChatConversationMessage,
    audience: "student" | "staff",
    own: boolean,
    ownSenderLabel?: string
) {
    if (own) {
        const label = ownSenderLabel?.trim();
        return label || "You";
    }

    if (message.senderRole === "admin") return "Admin";
    if (message.senderRole === "teacher") return "Teacher";
    if (message.senderRole === "student") {
        return audience === "student" ? "Your team" : "Student team";
    }

    const rawSender = message.sender?.trim();
    if (rawSender) {
        const normalized = rawSender.toLowerCase();
        if (normalized === "admin") return "Admin";
        if (normalized === "teacher") return "Teacher";
        if (normalized === "student") {
            return audience === "student" ? "Your team" : "Student team";
        }
        return rawSender;
    }

    return "Unknown sender";
}

export default function EagleChatThread({
    messages,
    loading = false,
    loadingText = "Loading messages...",
    draft,
    onDraftChange,
    onSend,
    sending,
    disabled = false,
    placeholder,
    ariaLabel,
    submitLabel,
    sendingLabel,
    emptyText,
    audience,
    extraActions,
    ownSenderLabel,
}: Props) {
    const chatLogRef = useRef<HTMLDivElement | null>(null);
    const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);

    useEffect(() => {
        if (!isPinnedToBottom) return;
        const el = chatLogRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [messages, isPinnedToBottom, loading]);

    return (
        <>
            <div
                ref={chatLogRef}
                className="eagle-chat-log"
                role="log"
                aria-live="polite"
                aria-busy={loading}
                onScroll={() => {
                    const el = chatLogRef.current;
                    if (!el) return;
                    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                    setIsPinnedToBottom(nearBottom);
                }}
            >
                {loading ? (
                    <p className="eagle-empty-chat">{loadingText}</p>
                ) : messages.length === 0 ? (
                    <p className="eagle-empty-chat">{emptyText}</p>
                ) : (
                    messages.map((message) => {
                        const own = isOwnMessage(message, audience);
                        const senderLabel = getSenderLabel(message, audience, own, ownSenderLabel);

                        return (
                            <div
                                key={message.id}
                                className={`eagle-chat-message ${own ? "is-own" : "is-other"}`}
                            >
                                <div className="eagle-chat-message__meta">
                                    <span
                                        className={`eagle-chat-message__author ${message.senderRole ? `is-${message.senderRole}` : ""}`}
                                    >
                                        {senderLabel}
                                    </span>
                                    <span>{formatDateTime(message.createdAt)}</span>
                                </div>

                                <div
                                    className={`eagle-chat-message__bubble ${own ? "is-own" : "is-other"}`}
                                >
                                    {message.body}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <form className="eagle-chat-form" onSubmit={onSend}>
                <textarea
                    className="eagle-chat-input"
                    value={draft}
                    onChange={(e) => onDraftChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (disabled) return;
                        if (e.key !== "Enter" || e.shiftKey) return;
                        e.preventDefault();
                        (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                    }}
                    placeholder={placeholder}
                    maxLength={8000}
                    disabled={disabled || sending}
                    aria-label={ariaLabel}
                />

                <div className="eagle-chat-form__actions">
                    <button
                        type="submit"
                        className="eagle-btn eagle-btn--primary"
                        disabled={disabled || sending || !draft.trim()}
                    >
                        <FaPaperPlane aria-hidden />
                        {sending ? sendingLabel : submitLabel}
                    </button>
                    {extraActions}
                </div>
            </form>
        </>
    );
}