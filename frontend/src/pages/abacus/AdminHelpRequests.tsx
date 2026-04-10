import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import axios from 'axios'
import '../../styling/AdminHelpRequests.scss'
import MenuComponent from '../components/MenuComponent'
import DirectoryBreadcrumbs from '../components/DirectoryBreadcrumbs'
import HelpRequestThread, {
    HelpRequestConversationMessage,
} from '../components/HelpRequestThread'
import {
    FaHandshake,
    FaRegClock,
    FaCheckCircle,
    FaPlay,
    FaUndo,
    FaTimesCircle,
    FaSync,
    FaPaperPlane,
} from 'react-icons/fa'

type ConversationStage =
    | 'waiting_for_admin'
    | 'awaiting_admin_reply'
    | 'awaiting_requester_reply'
    | 'resolved'
    | 'canceled'

interface HelpRequestsStateItem {
    id: number
    studentId: number
    teacherId: number
    teamDivision: string
    teamName: string
    teamSchool: string
    problemName: string | null
    reason: string
    description: string
    status: number
    adminName: string | null
    createdAt: string
    completedAt: string | null
    lastMessagePreview?: string | null
    lastMessageAt?: string | null
    lastMessageSenderRole?: 'requester' | 'staff' | null
    conversationStage?: ConversationStage
    messageCount?: number
}

interface HelpRequestMessage {
    id: number
    senderType: 'student' | 'admin'
    senderRole: 'requester' | 'staff'
    senderName: string
    body: string
    createdAt: string
}

const HISTORY_PAGE_SIZE = 6
const POLL_MS = 30000
const COMPOSER_MIN_HEIGHT = 56

const AdminHelpRequests: React.FC = () => {
    const [helpRequests, setHelpRequests] = useState<HelpRequestsStateItem[]>([])
    const [historyPage, setHistoryPage] = useState(1)
    const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
    const [messages, setMessages] = useState<HelpRequestMessage[]>([])
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [draftMessage, setDraftMessage] = useState('')
    const [sendingMessage, setSendingMessage] = useState(false)
    const [updatingStatus, setUpdatingStatus] = useState(false)

    const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null)

    const authConfig = useCallback(() => ({
        headers: {
            Authorization: `Bearer ${localStorage.getItem('AUTOTA_AUTH_TOKEN')}`,
            'Content-Type': 'application/json',
        },
    }), [])

    const toSafeDate = (timestampStr: string | null | undefined) => {
        if (!timestampStr) return null
        let safeTimestampStr = timestampStr.replace(' ', 'T')
        if (!safeTimestampStr.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(safeTimestampStr)) {
            safeTimestampStr += 'Z'
        }
        const parsed = new Date(safeTimestampStr)
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    const formatTime = (timestampStr: string | null | undefined) => {
        const parsed = toSafeDate(timestampStr)
        if (!parsed) return '-'
        return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const formatDateTime = (timestampStr: string | null | undefined) => {
        const parsed = toSafeDate(timestampStr)
        if (!parsed) return '-'
        return parsed.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    const calculateTimeDifference = (timestampStr: string) => {
        const parsed = toSafeDate(timestampStr)
        if (!parsed) return 0
        const timeDifferenceInMilliseconds = new Date().getTime() - parsed.getTime()
        const timeDifferenceInMinutes = Math.floor(timeDifferenceInMilliseconds / (1000 * 60))
        return Math.max(0, timeDifferenceInMinutes)
    }

    const formatWaitTimeDisplay = (timestampStr: string) => {
        const totalMinutes = calculateTimeDifference(timestampStr)

        if (totalMinutes === 0) return 'Just now'

        const hours = Math.floor(totalMinutes / 60)
        const remainingMinutes = totalMinutes % 60

        if (hours > 0) {
            return remainingMinutes > 0 ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`
        }

        return `${totalMinutes} min`
    }

    const getConversationStage = useCallback((item: HelpRequestsStateItem | null | undefined): ConversationStage => {
        if (!item) return 'waiting_for_admin'
        if (item.conversationStage) return item.conversationStage
        if (item.status === 2) return 'resolved'
        if (item.status === 3) return 'canceled'
        if (item.status === 0) return 'waiting_for_admin'
        return item.lastMessageSenderRole === 'staff'
            ? 'awaiting_requester_reply'
            : 'awaiting_admin_reply'
    }, [])

    const getConversationStageMeta = useCallback((item: HelpRequestsStateItem | null | undefined) => {
        const stage = getConversationStage(item)

        switch (stage) {
            case 'waiting_for_admin':
                return {
                    label: 'Waiting to be claimed',
                    className: 'is-waiting-for-admin',
                    Icon: FaRegClock,
                }
            case 'awaiting_admin_reply':
                return {
                    label: 'Needs admin reply',
                    className: 'is-awaiting-admin-reply',
                    Icon: FaPaperPlane,
                }
            case 'awaiting_requester_reply':
                return {
                    label: 'Waiting for requester',
                    className: 'is-awaiting-requester-reply',
                    Icon: FaHandshake,
                }
            case 'resolved':
                return {
                    label: 'Resolved',
                    className: 'is-resolved',
                    Icon: FaCheckCircle,
                }
            case 'canceled':
            default:
                return {
                    label: 'Canceled',
                    className: 'is-canceled',
                    Icon: FaTimesCircle,
                }
        }
    }, [getConversationStage])

    const getRequestActivityTime = useCallback((item: HelpRequestsStateItem) => {
        return toSafeDate(item.lastMessageAt || item.createdAt)?.getTime() ?? 0
    }, [])

    const resizeComposer = useCallback(() => {
        const textarea = composerTextareaRef.current
        if (!textarea) return

        textarea.style.height = 'auto'
        textarea.style.height = `${Math.max(textarea.scrollHeight, COMPOSER_MIN_HEIGHT)}px`
    }, [])

    useLayoutEffect(() => {
        resizeComposer()
    }, [draftMessage, selectedRequestId, resizeComposer])

    const fetchRequests = useCallback(async () => {
        try {
            const res = await axios.get(
                `${import.meta.env.VITE_API_URL}/submissions/help-requests`,
                authConfig()
            )
            setHelpRequests(res.data)
        } catch (err) {
            console.error('Failed to fetch help requests:', err)
        }
    }, [authConfig])

    const fetchMessages = useCallback(async (requestId: number, showLoader = true) => {
        if (showLoader) setLoadingMessages(true)
        try {
            const res = await axios.get(
                `${import.meta.env.VITE_API_URL}/submissions/help-request/${requestId}/messages`,
                authConfig()
            )
            setMessages(res.data)
        } catch (err) {
            console.error('Failed to fetch help request messages:', err)
            setMessages([])
        } finally {
            if (showLoader) setLoadingMessages(false)
        }
    }, [authConfig])

    const refreshAll = useCallback(async () => {
        await fetchRequests()
        if (selectedRequestId) {
            await fetchMessages(selectedRequestId, false)
        }
    }, [fetchRequests, fetchMessages, selectedRequestId])

    useEffect(() => {
        fetchRequests()
        const intervalId = window.setInterval(() => {
            fetchRequests()
            if (selectedRequestId) {
                fetchMessages(selectedRequestId, false)
            }
        }, POLL_MS)

        return () => window.clearInterval(intervalId)
    }, [fetchRequests, fetchMessages, selectedRequestId])

    const allActiveRequests = useMemo(() => {
        return [...helpRequests]
            .filter((q) => q.status !== 2 && q.status !== 3)
            .sort((a, b) => getRequestActivityTime(a) - getRequestActivityTime(b))
    }, [helpRequests, getRequestActivityTime])

    const unclaimedRequests = useMemo(
        () => allActiveRequests.filter((q) => getConversationStage(q) === 'waiting_for_admin'),
        [allActiveRequests, getConversationStage]
    )

    const needsAdminReplyRequests = useMemo(
        () => allActiveRequests.filter((q) => getConversationStage(q) === 'awaiting_admin_reply'),
        [allActiveRequests, getConversationStage]
    )

    const waitingForRequesterRequests = useMemo(
        () => allActiveRequests.filter((q) => getConversationStage(q) === 'awaiting_requester_reply'),
        [allActiveRequests, getConversationStage]
    )

    const historyRequests = useMemo(() => {
        return [...helpRequests]
            .filter((q) => q.status === 2 || q.status === 3)
            .sort((a, b) => {
                const aTime = toSafeDate(a.completedAt || a.createdAt)?.getTime() ?? 0
                const bTime = toSafeDate(b.completedAt || b.createdAt)?.getTime() ?? 0
                return bTime - aTime
            })
    }, [helpRequests])

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(historyRequests.length / HISTORY_PAGE_SIZE))
        if (historyPage > totalPages) {
            setHistoryPage(totalPages)
        }
    }, [historyRequests, historyPage])

    useEffect(() => {
        if (helpRequests.length === 0) {
            setSelectedRequestId(null)
            setMessages([])
            return
        }

        const selectedStillExists = helpRequests.some((item) => item.id === selectedRequestId)
        if (selectedStillExists) return

        const preferred =
            unclaimedRequests[0] ||
            needsAdminReplyRequests[0] ||
            waitingForRequesterRequests[0] ||
            historyRequests[0] ||
            helpRequests[0]

        setSelectedRequestId(preferred?.id ?? null)
    }, [
        helpRequests,
        selectedRequestId,
        unclaimedRequests,
        needsAdminReplyRequests,
        waitingForRequesterRequests,
        historyRequests,
    ])

    useEffect(() => {
        if (selectedRequestId) {
            fetchMessages(selectedRequestId)
        } else {
            setMessages([])
        }
    }, [selectedRequestId, fetchMessages])

    const selectedRequest = useMemo(() => {
        return helpRequests.find((item) => item.id === selectedRequestId) ?? null
    }, [helpRequests, selectedRequestId])

    const threadMessages = useMemo<HelpRequestConversationMessage[]>(() => {
        return messages.map((message) => ({
            id: message.id,
            senderRole: message.senderRole,
            authorLabel: message.senderName || (message.senderRole === 'staff' ? 'Staff' : 'Requester'),
            body: message.body,
            createdAt: message.createdAt,
        }))
    }, [messages])

    const updateRequestStatus = async (id: number, newStatus: number) => {
        setUpdatingStatus(true)
        try {
            await axios.put(
                `${import.meta.env.VITE_API_URL}/submissions/help-request/${id}`,
                { status: newStatus },
                authConfig()
            )
            await refreshAll()
        } catch (err: any) {
            if (err.response && err.response.status === 409) {
                alert(err.response?.data?.message || 'Another user already updated this request.')
                await refreshAll()
            } else {
                console.error('Failed to update status:', err)
                alert(err.response?.data?.message || 'Failed to update status. Please try again.')
            }
        } finally {
            setUpdatingStatus(false)
        }
    }

    const sendMessage = async () => {
        if (!selectedRequestId || !draftMessage.trim()) return

        setSendingMessage(true)
        try {
            await axios.post(
                `${import.meta.env.VITE_API_URL}/submissions/help-request/${selectedRequestId}/messages`,
                { body: draftMessage.trim() },
                authConfig()
            )
            setDraftMessage('')
            await refreshAll()
            await fetchMessages(selectedRequestId, false)
        } catch (err: any) {
            console.error('Failed to send message:', err)
            alert(err.response?.data?.message || 'Failed to send message.')
        } finally {
            setSendingMessage(false)
        }
    }

    const handleCardKeyDown = (
        e: React.KeyboardEvent<HTMLDivElement>,
        requestId: number
    ) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setSelectedRequestId(requestId)
        }
    }

    const renderStatusBadge = (item: HelpRequestsStateItem) => {
        if (item.status === 1) {
            return (
                <span className="ahr-status-badge is-progress">
                    <FaHandshake />
                    <span>{item.adminName ? `In Progress · ${item.adminName}` : 'In Progress'}</span>
                </span>
            )
        }

        if (item.status === 2) {
            return (
                <span className="ahr-status-badge is-resolved">
                    <FaCheckCircle />
                    <span>{item.adminName ? `Resolved · ${item.adminName}` : 'Resolved'}</span>
                </span>
            )
        }

        if (item.status === 3) {
            return (
                <span className="ahr-status-badge is-canceled">
                    <FaTimesCircle />
                    <span>Canceled</span>
                </span>
            )
        }

        return (
            <span className="ahr-status-badge is-waiting">
                <FaRegClock />
                <span>Waiting</span>
            </span>
        )
    }

    const renderConversationStageBadge = (item: HelpRequestsStateItem | null | undefined) => {
        const { label, className, Icon } = getConversationStageMeta(item)

        return (
            <span className={`ahr-conversation-badge ${className}`}>
                <Icon />
                <span>{label}</span>
            </span>
        )
    }

    const renderRequesterBadge = (item: HelpRequestsStateItem) => (
        <span className="ahr-requester-badge">
            {item.studentId === 0 ? 'Teacher Request' : 'Student Request'}
        </span>
    )

    const getCardFooterLead = (item: HelpRequestsStateItem) => {
        const stage = getConversationStage(item)
        const referenceTime = item.lastMessageAt || item.createdAt

        if (stage === 'waiting_for_admin') {
            return `Waiting ${formatWaitTimeDisplay(item.createdAt)}`
        }

        if (stage === 'awaiting_admin_reply') {
            return `Needs response since ${formatDateTime(referenceTime)}`
        }

        if (stage === 'awaiting_requester_reply') {
            return `Waiting since ${formatDateTime(referenceTime)}`
        }

        return `Updated ${formatDateTime(referenceTime)}`
    }

    const getCardAudienceLabel = (item: HelpRequestsStateItem) => {
        return item.teamDivision || (item.studentId === 0 ? 'Teacher' : 'Student')
    }

    const getCardTopicLabel = (item: HelpRequestsStateItem) => {
        return `${item.problemName || 'General'} · ${item.reason}`
    }

    const renderActiveRequestCard = (item: HelpRequestsStateItem) => (
        <div
            key={item.id}
            className={`ahr-request-card ${selectedRequestId === item.id ? 'is-selected' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedRequestId(item.id)}
            onKeyDown={(e) => handleCardKeyDown(e, item.id)}
        >
            <div className="ahr-request-card__top">
                {renderConversationStageBadge(item)}
                {renderRequesterBadge(item)}
            </div>

            <div className="ahr-request-card__title">{item.teamName || 'Unknown requester'}</div>

            <div className="ahr-request-card__meta">
                <span>{item.teamSchool || 'No school'}</span>
                <span>{getCardAudienceLabel(item)}</span>
            </div>

            <div className="ahr-request-card__topic">{getCardTopicLabel(item)}</div>

            <div className="ahr-request-card__footer">
                <span>{getCardFooterLead(item)}</span>
                <span>{item.messageCount ?? 0} replies</span>
            </div>
        </div>
    )

    const historyTotalPages = Math.max(1, Math.ceil(historyRequests.length / HISTORY_PAGE_SIZE))
    const safeHistoryPage = Math.min(historyPage, historyTotalPages)
    const historySlice = historyRequests.slice(
        (safeHistoryPage - 1) * HISTORY_PAGE_SIZE,
        safeHistoryPage * HISTORY_PAGE_SIZE
    )

    const canReply = !!selectedRequest && selectedRequest.status !== 2 && selectedRequest.status !== 3

    const composerHint = useMemo(() => {
        if (!selectedRequest) return ''

        const stage = getConversationStage(selectedRequest)
        if (stage === 'waiting_for_admin') {
            return 'Sending a message here will automatically move this request to In Progress.'
        }

        if (stage === 'awaiting_admin_reply') {
            return 'The requester is waiting on an admin response.'
        }

        if (stage === 'awaiting_requester_reply') {
            return 'You replied last. Send another message only if you need to add more context.'
        }

        return 'Use this thread to keep the conversation in one place.'
    }, [selectedRequest, getConversationStage])

    const renderResponseBanner = () => {
        if (!selectedRequest || !canReply) return null

        const stage = getConversationStage(selectedRequest)

        if (stage === 'waiting_for_admin') {
            return (
                <div className="ahr-response-banner is-admin">
                    This request is still unclaimed. Start helping or send a reply to claim it.
                </div>
            )
        }

        if (stage === 'awaiting_admin_reply') {
            return (
                <div className="ahr-response-banner is-admin">
                    The requester is waiting on an admin response.
                </div>
            )
        }

        if (stage === 'awaiting_requester_reply') {
            return (
                <div className="ahr-response-banner is-requester">
                    You replied last. The next response should usually come from the requester.
                </div>
            )
        }

        return null
    }

    return (
        <div className="ahr-page">
            <MenuComponent />

            <DirectoryBreadcrumbs
                items={[
                    { label: 'Admin Menu', to: '/admin' },
                    { label: 'Help Requests' },
                ]}
            />

            <div className="pageTitle">Help Requests</div>

            <div className="ahr-layout">
                <aside className="ahr-sidebar">
                    <section className="ahr-panel">
                        <div className="ahr-panel__header">
                            <h2>Unclaimed</h2>
                            <span className="ahr-panel__count">{unclaimedRequests.length}</span>
                        </div>

                        <div className="ahr-request-list">
                            {unclaimedRequests.length === 0 ? (
                                <div className="ahr-empty-state">No requests are waiting to be claimed.</div>
                            ) : (
                                unclaimedRequests.map(renderActiveRequestCard)
                            )}
                        </div>
                    </section>

                    <section className="ahr-panel">
                        <div className="ahr-panel__header">
                            <h2>Needs Admin Reply</h2>
                            <span className="ahr-panel__count">{needsAdminReplyRequests.length}</span>
                        </div>

                        <div className="ahr-request-list">
                            {needsAdminReplyRequests.length === 0 ? (
                                <div className="ahr-empty-state">No conversations are waiting on admin replies.</div>
                            ) : (
                                needsAdminReplyRequests.map(renderActiveRequestCard)
                            )}
                        </div>
                    </section>

                    <section className="ahr-panel">
                        <div className="ahr-panel__header">
                            <h2>Waiting for Requester</h2>
                            <span className="ahr-panel__count">{waitingForRequesterRequests.length}</span>
                        </div>

                        <div className="ahr-request-list">
                            {waitingForRequesterRequests.length === 0 ? (
                                <div className="ahr-empty-state">No conversations are currently waiting on a requester reply.</div>
                            ) : (
                                waitingForRequesterRequests.map(renderActiveRequestCard)
                            )}
                        </div>
                    </section>

                    <section className="ahr-panel">
                        <div className="ahr-panel__header">
                            <h2>History</h2>
                            <span className="ahr-panel__count">{historyRequests.length}</span>
                        </div>

                        <div className="ahr-request-list">
                            {historyRequests.length === 0 ? (
                                <div className="ahr-empty-state">No history yet.</div>
                            ) : (
                                historySlice.map((item) => (
                                    <div
                                        key={item.id}
                                        className={`ahr-request-card is-history ${selectedRequestId === item.id ? 'is-selected' : ''}`}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setSelectedRequestId(item.id)}
                                        onKeyDown={(e) => handleCardKeyDown(e, item.id)}
                                    >
                                        <div className="ahr-request-card__top">
                                            {renderStatusBadge(item)}
                                            {renderRequesterBadge(item)}
                                        </div>

                                        <div className="ahr-request-card__title">{item.teamName || 'Unknown requester'}</div>

                                        <div className="ahr-request-card__meta">
                                            <span>{item.teamSchool || 'No school'}</span>
                                            <span>{getCardAudienceLabel(item)}</span>
                                        </div>

                                        <div className="ahr-request-card__topic">{getCardTopicLabel(item)}</div>

                                        <div className="ahr-request-card__footer">
                                            <span>Requested {formatDateTime(item.createdAt)}</span>
                                            <span>Closed {formatDateTime(item.completedAt)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {historyRequests.length > HISTORY_PAGE_SIZE && (
                            <div className="ahr-pagination" aria-label="History pagination">
                                <button
                                    className="button"
                                    onClick={() => setHistoryPage(Math.max(1, safeHistoryPage - 1))}
                                    disabled={safeHistoryPage <= 1}
                                >
                                    Prev
                                </button>
                                <div className="ahr-pagination__meta">
                                    Page {safeHistoryPage} of {historyTotalPages}
                                </div>
                                <button
                                    className="button"
                                    onClick={() => setHistoryPage(Math.min(historyTotalPages, safeHistoryPage + 1))}
                                    disabled={safeHistoryPage >= historyTotalPages}
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </section>
                </aside>

                <section className="ahr-thread-panel">
                    {!selectedRequest ? (
                        <div className="ahr-thread-panel__empty">
                            Select a help request to view the conversation.
                        </div>
                    ) : (
                        <>
                            <div className="ahr-thread-panel__header">
                                <div>
                                    <div className="ahr-thread-panel__eyebrow">
                                        {selectedRequest.studentId === 0 ? 'Teacher Request' : 'Student Request'}
                                    </div>
                                    <h2>{selectedRequest.teamName || 'Unknown requester'}</h2>
                                    <div className="ahr-thread-panel__meta">
                                        <span>{selectedRequest.teamSchool || 'No school'}</span>
                                        <span>{selectedRequest.teamDivision || (selectedRequest.studentId === 0 ? 'Teacher' : 'Student')}</span>
                                        <span>Opened {formatDateTime(selectedRequest.createdAt)}</span>
                                    </div>
                                </div>

                                <div className="ahr-thread-panel__actions">
                                    <button
                                        className="button"
                                        onClick={refreshAll}
                                        title="Refresh"
                                    >
                                        <FaSync /> Refresh
                                    </button>

                                    {selectedRequest.status === 0 && (
                                        <button
                                            className="button button-accept"
                                            disabled={updatingStatus}
                                            onClick={() => updateRequestStatus(selectedRequest.id, 1)}
                                        >
                                            <FaPlay /> Start Helping
                                        </button>
                                    )}

                                    {selectedRequest.status === 1 && (
                                        <button
                                            className="button button-completed"
                                            disabled={updatingStatus}
                                            onClick={() => updateRequestStatus(selectedRequest.id, 2)}
                                        >
                                            <FaCheckCircle /> Resolve
                                        </button>
                                    )}

                                    {(selectedRequest.status === 2 || selectedRequest.status === 3) && (
                                        <button
                                            className="button ahr-button-reopen"
                                            disabled={updatingStatus}
                                            onClick={() => {
                                                if (window.confirm('Are you sure you want to reopen this request?')) {
                                                    updateRequestStatus(selectedRequest.id, 0)
                                                }
                                            }}
                                        >
                                            <FaUndo /> Reopen
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="ahr-summary-grid">
                                <div className="ahr-summary-card">
                                    <div className="ahr-summary-card__label">Status</div>
                                    <div className="ahr-summary-card__value">{renderStatusBadge(selectedRequest)}</div>
                                </div>

                                <div className="ahr-summary-card">
                                    <div className="ahr-summary-card__label">Reply State</div>
                                    <div className="ahr-summary-card__value">{renderConversationStageBadge(selectedRequest)}</div>
                                </div>

                                <div className="ahr-summary-card">
                                    <div className="ahr-summary-card__label">Problem</div>
                                    <div className="ahr-summary-card__value">{selectedRequest.problemName || 'General'}</div>
                                </div>

                                <div className="ahr-summary-card">
                                    <div className="ahr-summary-card__label">Reason</div>
                                    <div className="ahr-summary-card__value">{selectedRequest.reason}</div>
                                </div>

                                <div className="ahr-summary-card">
                                    <div className="ahr-summary-card__label">Requested</div>
                                    <div className="ahr-summary-card__value">{formatTime(selectedRequest.createdAt)}</div>
                                </div>
                            </div>

                            <div className="ahr-original-request">
                                <div className="ahr-original-request__label">Original request</div>
                                <div className="ahr-original-request__body">{selectedRequest.description}</div>
                            </div>

                            {renderResponseBanner()}

                            <HelpRequestThread
                                classNamePrefix="ahr"
                                messages={threadMessages}
                                loading={loadingMessages}
                                loadingText="Loading conversation..."
                                emptyText="No replies yet."
                                canReply={canReply}
                                closedText="This request is closed. Reopen it to continue the conversation."
                                composerId="admin-help-request-reply"
                                composerLabel="Reply"
                                composerValue={draftMessage}
                                onComposerChange={setDraftMessage}
                                composerPlaceholder="Reply with an update, follow-up question, or next steps."
                                composerHint={composerHint}
                                sending={sendingMessage}
                                sendLabel="Send Reply"
                                sendingLabel="Sending..."
                                onSend={sendMessage}
                                formatDateTime={formatDateTime}
                                textareaRows={2}
                                textareaRef={composerTextareaRef}
                            />
                        </>
                    )}
                </section>
            </div>
        </div>
    )
}

export default AdminHelpRequests