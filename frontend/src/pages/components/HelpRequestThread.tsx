import React from 'react'
import { FaPaperPlane } from 'react-icons/fa'

export interface HelpRequestConversationMessage {
    id: number
    senderRole: 'requester' | 'staff'
    authorLabel: string
    body: string
    createdAt: string | null | undefined
}

interface Props {
    classNamePrefix: 'ahr' | 'shr'
    messages: HelpRequestConversationMessage[]
    loading: boolean
    loadingText: string
    emptyText: string
    canReply: boolean
    closedText: string
    composerId: string
    composerLabel: string
    composerValue: string
    onComposerChange: (value: string) => void
    composerPlaceholder: string
    composerHint: string
    sending: boolean
    sendLabel: string
    sendingLabel: string
    onSend: () => void
    formatDateTime: (value: string | null | undefined) => string
    textareaRows?: number
    textareaRef?: React.Ref<HTMLTextAreaElement>
}

const HelpRequestThread: React.FC<Props> = ({
    classNamePrefix,
    messages,
    loading,
    loadingText,
    emptyText,
    canReply,
    closedText,
    composerId,
    composerLabel,
    composerValue,
    onComposerChange,
    composerPlaceholder,
    composerHint,
    sending,
    sendLabel,
    sendingLabel,
    onSend,
    formatDateTime,
    textareaRows = 4,
    textareaRef,
}) => {
    return (
        <>
            <div className={`${classNamePrefix}-messages`}>
                {loading ? (
                    <div className={`${classNamePrefix}-empty-state`}>{loadingText}</div>
                ) : messages.length === 0 ? (
                    <div className={`${classNamePrefix}-empty-state`}>{emptyText}</div>
                ) : (
                    messages.map((message) => (
                        <div
                            key={message.id}
                            className={`${classNamePrefix}-message ${message.senderRole === 'staff' ? 'is-staff' : 'is-requester'}`}
                        >
                            <div className={`${classNamePrefix}-message__meta`}>
                                <span className={`${classNamePrefix}-message__author`}>
                                    {message.authorLabel}
                                </span>
                                <span>{formatDateTime(message.createdAt)}</span>
                            </div>
                            <div className={`${classNamePrefix}-message__body`}>
                                {message.body}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className={`${classNamePrefix}-composer`}>
                {!canReply ? (
                    <div className={`${classNamePrefix}-composer__closed`}>
                        {closedText}
                    </div>
                ) : (
                    <>
                        <label htmlFor={composerId} className={`${classNamePrefix}-composer__label`}>
                            {composerLabel}
                        </label>
                        <textarea
                            ref={textareaRef}
                            id={composerId}
                            rows={textareaRows}
                            value={composerValue}
                            onChange={(e) => onComposerChange(e.target.value)}
                            placeholder={composerPlaceholder}
                            disabled={sending}
                        />
                        <div className={`${classNamePrefix}-composer__footer`}>
                            <span className={`${classNamePrefix}-composer__hint`}>
                                {composerHint}
                            </span>
                            <button
                                className="button button-accept"
                                disabled={sending || !composerValue.trim()}
                                onClick={onSend}
                            >
                                <FaPaperPlane /> {sending ? sendingLabel : sendLabel}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </>
    )
}

export default HelpRequestThread
