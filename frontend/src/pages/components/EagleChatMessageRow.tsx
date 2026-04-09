import React from "react";

export type EagleChatSenderRole = "student" | "admin" | "teacher";

export type EagleChatMessageShape = {
    id: number;
    sender: string;
    senderRole?: EagleChatSenderRole;
    body: string;
    createdAt: string;
};

function resolveRole(m: EagleChatMessageShape): EagleChatSenderRole {
    if (m.senderRole === "student" || m.senderRole === "admin" || m.senderRole === "teacher") {
        return m.senderRole;
    }
    return m.sender === "student" ? "student" : "admin";
}

function labelForRole(role: EagleChatSenderRole, audience: "student" | "staff"): string {
    if (role === "student") {
        return audience === "student" ? "Your team" : "Student team";
    }
    if (role === "teacher") {
        return "Teacher";
    }
    return "Admin";
}

type Props = {
    message: EagleChatMessageShape;
    /** student page vs admin/teacher page wording for student-side label */
    audience: "student" | "staff";
};

export default function EagleChatMessageRow({ message, audience }: Props) {
    const role = resolveRole(message);
    const isStudent = role === "student";
    const label = labelForRole(role, audience);

    return (
        <div
            className={
                isStudent
                    ? "eagle-chat-row eagle-chat-row--student"
                    : "eagle-chat-row eagle-chat-row--staff"
            }
        >
            <span
                className={
                    role === "teacher"
                        ? "eagle-chat-sender-label eagle-chat-sender-label--teacher"
                        : role === "admin"
                          ? "eagle-chat-sender-label eagle-chat-sender-label--admin"
                          : "eagle-chat-sender-label eagle-chat-sender-label--student"
                }
            >
                {label}
            </span>
            <div
                className={
                    isStudent
                        ? "eagle-chat-bubble eagle-chat-bubble--student"
                        : "eagle-chat-bubble eagle-chat-bubble--admin"
                }
            >
                <div>{message.body}</div>
                <div className="eagle-chat-meta">{message.createdAt || ""}</div>
            </div>
        </div>
    );
}
