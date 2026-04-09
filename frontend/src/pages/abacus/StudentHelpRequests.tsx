import React, { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
    FaPaperPlane,
    FaRegClock,
    FaHandshake,
    FaCheckCircle,
    FaTimesCircle,
    FaSync,
} from 'react-icons/fa'
import MenuComponent from '../components/MenuComponent'
import DirectoryBreadcrumbs from '../components/DirectoryBreadcrumbs'
import '../../styling/StudentHelpRequests.scss'

type ConversationStage =
    | 'waiting_for_admin'
    | 'awaiting_admin_reply'
    | 'awaiting_requester_reply'
    | 'resolved'
    | 'canceled'

interface HelpRequestItem {
    id: number
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

interface Project {
    id: number
    name: string
}

const HISTORY_PAGE_SIZE = 6
const POLL_MS = 30000

const StudentHelpRequests: React.FC = () => {
    const [helpRequests, setHelpRequests] = useState<HelpRequestItem[]>([])
    const [availableProblems, setAvailableProblems] = useState<Project[]>([])
    const [historyPage, setHistoryPage] = useState(1)

    const [selectedProblemId, setSelectedProblemId] = useState<string>('')
    const [reason, setReason] = useState('')
    const [description, setDescription] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
    const [messages, setMessages] = useState<HelpRequestMessage[]>([])
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [draftMessage, setDraftMessage] = useState('')
    const [sendingMessage, setSendingMessage] = useState(false)

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
        const timeDiffMs = new Date().getTime() - parsed.getTime()
        return Math.max(0, Math.floor(timeDiffMs / (1000 * 60)))
    }

    const formatWaitTimeDisplay = (timestampStr: string) => {
        const totalMinutes = calculateTimeDifference(timestampStr)
        if (totalMinutes === 0) return 'Just now'
        const hours = Math.floor(totalMinutes / 60)
        const mins = totalMinutes % 60
        if (hours > 0) return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`
        return `${totalMinutes} min`
    }

    const getConversationStage = useCallback((item: HelpRequestItem | null | undefined): ConversationStage => {
        if (!item) return 'waiting_for_admin'
        if (item.conversationStage) return item.conversationStage
        if (item.status === 2) return 'resolved'
        if (item.status === 3) return 'canceled'
        if (item.status === 0) return 'waiting_for_admin'
        return item.lastMessageSenderRole === 'staff'
            ? 'awaiting_requester_reply'
            : 'awaiting_admin_reply'
    }, [])

    const getConversationStageMeta = useCallback((item: HelpRequestItem | null | undefined) => {
        const stage = getConversationStage(item)

        switch (stage) {
            case 'waiting_for_admin':
                return {
                    label: 'Waiting in queue',
                    className: 'is-waiting-for-admin',
                    Icon: FaRegClock,
                }
            case 'awaiting_admin_reply':
                return {
                    label: 'Awaiting admin reply',
                    className: 'is-awaiting-admin-reply',
                    Icon: FaRegClock,
                }
            case 'awaiting_requester_reply':
                return {
                    label: 'Admin replied',
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

    const fetchRequests = useCallback(async () => {
        try {
            const res = await axios.get(
                `${import.meta.env.VITE_API_URL}/submissions/my-help-requests`,
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

    useEffect(() => {
        fetchRequests()

        axios.get(`${import.meta.env.VITE_API_URL}/projects/my_competition`, authConfig())
            .then((res) => setAvailableProblems(res.data as Project[]))
            .catch((err) => console.error(err))

        const intervalId = window.setInterval(() => {
            fetchRequests()
            if (selectedRequestId) {
                fetchMessages(selectedRequestId, false)
            }
        }, POLL_MS)

        return () => clearInterval(intervalId)
    }, [fetchRequests, fetchMessages, authConfig, selectedRequestId])

    const activeRequests = useMemo(() => {
        return [...helpRequests]
            .filter((q) => q.status !== 2 && q.status !== 3)
            .sort((a, b) => {
                const aTime = toSafeDate(a.createdAt)?.getTime() ?? 0
                const bTime = toSafeDate(b.createdAt)?.getTime() ?? 0
                return aTime - bTime
            })
    }, [helpRequests])

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
            activeRequests[0] ||
            historyRequests[0] ||
            helpRequests[0]

        setSelectedRequestId(preferred?.id ?? null)
    }, [helpRequests, selectedRequestId, activeRequests, historyRequests])

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

    const refreshAll = useCallback(async () => {
        await fetchRequests()
        if (selectedRequestId) {
            await fetchMessages(selectedRequestId, false)
        }
    }, [fetchRequests, fetchMessages, selectedRequestId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!selectedProblemId || !reason || !description.trim()) {
            setError('Please select a problem, reason, and describe your issue.')
            return
        }

        setIsSubmitting(true)
        try {
            const problemIdPayload = selectedProblemId === 'general' ? null : parseInt(selectedProblemId, 10)

            const res = await axios.post(
                `${import.meta.env.VITE_API_URL}/submissions/help-request`,
                {
                    problemId: problemIdPayload,
                    reason,
                    description,
                },
                authConfig()
            )

            const createdId = Number(res.data?.id)

            setSelectedProblemId('')
            setReason('')
            setDescription('')
            await fetchRequests()

            if (Number.isFinite(createdId) && createdId > 0) {
                setSelectedRequestId(createdId)
            }
        } catch (err: any) {
            const serverMessage = err.response?.data?.message || 'Failed to send request. Please try again.'
            setError(serverMessage)
            console.error('Backend Error:', err.response?.data || err)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCancelRequest = async (requestId: number) => {
        if (!window.confirm('Are you sure you want to cancel this help request?')) return

        try {
            await axios.put(
                `${import.meta.env.VITE_API_URL}/submissions/help-request/${requestId}`,
                { status: 3 },
                authConfig()
            )
            await refreshAll()
        } catch (err: any) {
            const serverMessage = err.response?.data?.message || 'Failed to cancel request.'
            alert(serverMessage)
            console.error('Failed to cancel:', err)
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

    const renderStatusBadge = (item: HelpRequestItem) => {
        if (item.status === 1) {
            return (
                <span className="shr-status-badge is-progress">
                    <FaHandshake />
                    <span>{item.adminName ? `Being helped by ${item.adminName}` : 'In Progress'}</span>
                </span>
            )
        }

        if (item.status === 2) {
            return (
                <span className="shr-status-badge is-resolved">
                    <FaCheckCircle />
                    <span>{item.adminName ? `Resolved by ${item.adminName}` : 'Resolved'}</span>
                </span>
            )
        }

        if (item.status === 3) {
            return (
                <span className="shr-status-badge is-canceled">
                    <FaTimesCircle />
                    <span>Canceled</span>
                </span>
            )
        }

        return (
            <span className="shr-status-badge is-waiting">
                <FaRegClock />
                <span>Waiting</span>
            </span>
        )
    }

    const renderConversationStageBadge = (item: HelpRequestItem | null | undefined) => {
        const { label, className, Icon } = getConversationStageMeta(item)

        return (
            <span className={`shr-conversation-badge ${className}`}>
                <Icon />
                <span>{label}</span>
            </span>
        )
    }

    const getCardFooterLead = (item: HelpRequestItem) => {
        const stage = getConversationStage(item)
        const referenceTime = item.lastMessageAt || item.createdAt

        if (stage === 'waiting_for_admin') {
            return `Queued ${formatWaitTimeDisplay(item.createdAt)}`
        }

        if (stage === 'awaiting_admin_reply') {
            return `Awaiting admin since ${formatDateTime(referenceTime)}`
        }

        if (stage === 'awaiting_requester_reply') {
            return `Admin replied ${formatDateTime(referenceTime)}`
        }

        return `Updated ${formatDateTime(referenceTime)}`
    }

    const historyTotalPages = Math.max(1, Math.ceil(historyRequests.length / HISTORY_PAGE_SIZE))
    const safeHistoryPage = Math.min(historyPage, historyTotalPages)
    const historySlice = historyRequests.slice(
        (safeHistoryPage - 1) * HISTORY_PAGE_SIZE,
        safeHistoryPage * HISTORY_PAGE_SIZE
    )

    const canReply = !!selectedRequest && selectedRequest.status !== 2 && selectedRequest.status !== 3
    const canCancelRequest = !!selectedRequest && selectedRequest.status !== 2 && selectedRequest.status !== 3
    const canSubmitRequest = !!selectedProblemId && !!reason && !!description.trim()

    const composerHint = useMemo(() => {
        if (!selectedRequest) return ''

        const stage = getConversationStage(selectedRequest)
        if (stage === 'awaiting_requester_reply') {
            return 'An admin replied. Continue here if you still need help.'
        }

        return 'You can add more context here instead of opening a new request.'
    }, [selectedRequest, getConversationStage])

    const renderResponseBanner = () => {
        if (!selectedRequest || !canReply) return null

        const stage = getConversationStage(selectedRequest)

        if (stage === 'waiting_for_admin') {
            return (
                <div className="shr-response-banner is-admin">
                    Your request is still in the queue. An admin has not picked it up yet.
                </div>
            )
        }

        if (stage === 'awaiting_admin_reply') {
            return (
                <div className="shr-response-banner is-admin">
                    You are waiting on an admin response.
                </div>
            )
        }

        if (stage === 'awaiting_requester_reply') {
            return (
                <div className="shr-response-banner is-requester">
                    An admin replied. Respond here if you still need help.
                </div>
            )
        }

        return null
    }

    return (
        <div className="shr-page">
            <MenuComponent />
            <DirectoryBreadcrumbs items={[{ label: 'My Help Requests' }]} />
            <div className="pageTitle">My Help Requests</div>

            <div className="shr-layout">
                <aside className="shr-sidebar">
                    <section className="shr-panel shr-panel--form">
                        <div className="shr-panel__header">
                            <h2>Submit a New Request</h2>
                        </div>

                        <form className="shr-form" onSubmit={handleSubmit}>
                            {error && <div className="shr-form__error">{error}</div>}

                            <div className="shr-form__row">
                                <div className="shr-form__field">
                                    <label htmlFor="problem-select">Related to</label>
                                    <select
                                        id="problem-select"
                                        value={selectedProblemId}
                                        onChange={(e) => setSelectedProblemId(e.target.value)}
                                        disabled={isSubmitting}
                                    >
                                        <option value="" disabled>Select the problem...</option>
                                        <option value="general">General Issue</option>
                                        {availableProblems.map((p) => (
                                            <option key={p.id} value={p.id.toString()}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="shr-form__field">
                                    <label htmlFor="reason-select">Reason</label>
                                    <select
                                        id="reason-select"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        disabled={isSubmitting}
                                    >
                                        <option value="" disabled>Select a reason...</option>
                                        <option value="Technical Issue">Technical Issue</option>
                                        <option value="Bug Report">Bug Report</option>
                                        <option value="Need Clarification">Need Clarification</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div className="shr-form__field">
                                <label htmlFor="issue-description">Description</label>
                                <textarea
                                    id="issue-description"
                                    rows={4}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    disabled={isSubmitting}
                                    placeholder="Describe what you need help with."
                                />
                            </div>

                            <div className="shr-form__footer">
                                <button
                                    type="submit"
                                    className="button button-accept"
                                    disabled={isSubmitting || !canSubmitRequest}
                                >
                                    <FaPaperPlane /> {isSubmitting ? 'Sending...' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </section>

                    <section className="shr-panel">
                        <div className="shr-panel__header">
                            <h2>Active Requests</h2>
                            <span className="shr-panel__count">{activeRequests.length}</span>
                        </div>

                        <div className="shr-request-list">
                            {activeRequests.length === 0 ? (
                                <div className="shr-empty-state">You have no active help requests.</div>
                            ) : (
                                activeRequests.map((item) => (
                                    <div
                                        key={item.id}
                                        className={`shr-request-card ${selectedRequestId === item.id ? 'is-selected' : ''}`}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setSelectedRequestId(item.id)}
                                        onKeyDown={(e) => handleCardKeyDown(e, item.id)}
                                    >
                                        <div className="shr-request-card__top">
                                            {renderConversationStageBadge(item)}
                                        </div>

                                        <div className="shr-request-card__title">
                                            {item.problemName || 'General'}
                                        </div>

                                        <div className="shr-request-card__meta">
                                            <span>{item.reason}</span>
                                            <span>Opened {formatDateTime(item.createdAt)}</span>
                                        </div>

                                        <p className="shr-request-card__description">{item.description}</p>

                                        <div className="shr-request-card__footer">
                                            <span>{getCardFooterLead(item)}</span>
                                            <span>{item.messageCount ?? 0} replies</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    <section className="shr-panel">
                        <div className="shr-panel__header">
                            <h2>History</h2>
                            <span className="shr-panel__count">{historyRequests.length}</span>
                        </div>

                        <div className="shr-request-list">
                            {historyRequests.length === 0 ? (
                                <div className="shr-empty-state">No history yet.</div>
                            ) : (
                                historySlice.map((item) => (
                                    <div
                                        key={item.id}
                                        className={`shr-request-card is-history ${selectedRequestId === item.id ? 'is-selected' : ''}`}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setSelectedRequestId(item.id)}
                                        onKeyDown={(e) => handleCardKeyDown(e, item.id)}
                                    >
                                        <div className="shr-request-card__top">
                                            {renderStatusBadge(item)}
                                        </div>

                                        <div className="shr-request-card__title">
                                            {item.problemName || 'General'}
                                        </div>

                                        <div className="shr-request-card__meta">
                                            <span>{item.reason}</span>
                                            <span>Requested {formatDateTime(item.createdAt)}</span>
                                        </div>

                                        <p className="shr-request-card__description">{item.description}</p>

                                        <div className="shr-request-card__footer">
                                            <span>Resolved {formatTime(item.completedAt)}</span>
                                            <span>{item.messageCount ?? 0} replies</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {historyRequests.length > HISTORY_PAGE_SIZE && (
                            <div className="shr-pagination">
                                <button
                                    className="button"
                                    onClick={() => setHistoryPage(Math.max(1, safeHistoryPage - 1))}
                                    disabled={safeHistoryPage <= 1}
                                >
                                    Prev
                                </button>
                                <div className="shr-pagination__meta">
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

                <section className="shr-thread-panel">
                    {!selectedRequest ? (
                        <div className="shr-thread-panel__empty">
                            Select a request to view its conversation.
                        </div>
                    ) : (
                        <>
                            <div className="shr-thread-panel__header">
                                <div>
                                    <div className="shr-thread-panel__eyebrow">Conversation</div>
                                    <h2>{selectedRequest.problemName || 'General Issue'}</h2>
                                    <div className="shr-thread-panel__meta">
                                        <span>{selectedRequest.reason}</span>
                                        <span>Opened {formatDateTime(selectedRequest.createdAt)}</span>
                                    </div>
                                </div>

                                <div className="shr-thread-panel__actions">
                                    <button className="button" onClick={refreshAll}>
                                        <FaSync /> Refresh
                                    </button>

                                    {canCancelRequest && (
                                        <button
                                            className="button shr-button-cancel"
                                            onClick={() => handleCancelRequest(selectedRequest.id)}
                                        >
                                            <FaTimesCircle /> Cancel Request
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="shr-summary-grid">
                                <div className="shr-summary-card">
                                    <div className="shr-summary-card__label">Status</div>
                                    <div className="shr-summary-card__value">{renderStatusBadge(selectedRequest)}</div>
                                </div>

                                <div className="shr-summary-card">
                                    <div className="shr-summary-card__label">Reply State</div>
                                    <div className="shr-summary-card__value">{renderConversationStageBadge(selectedRequest)}</div>
                                </div>

                                <div className="shr-summary-card">
                                    <div className="shr-summary-card__label">Assigned Admin</div>
                                    <div className="shr-summary-card__value">{selectedRequest.adminName || 'Not assigned yet'}</div>
                                </div>

                                <div className="shr-summary-card">
                                    <div className="shr-summary-card__label">Requested</div>
                                    <div className="shr-summary-card__value">{formatTime(selectedRequest.createdAt)}</div>
                                </div>

                                <div className="shr-summary-card">
                                    <div className="shr-summary-card__label">Resolved</div>
                                    <div className="shr-summary-card__value">{formatTime(selectedRequest.completedAt)}</div>
                                </div>
                            </div>

                            <div className="shr-original-request">
                                <div className="shr-original-request__label">Original request</div>
                                <div className="shr-original-request__body">{selectedRequest.description}</div>
                            </div>

                            {renderResponseBanner()}

                            <div className="shr-messages">
                                {loadingMessages ? (
                                    <div className="shr-empty-state">Loading conversation...</div>
                                ) : messages.length === 0 ? (
                                    <div className="shr-empty-state">No replies yet.</div>
                                ) : (
                                    messages.map((message) => (
                                        <div
                                            key={message.id}
                                            className={`shr-message ${message.senderRole === 'requester' ? 'is-requester' : 'is-staff'}`}
                                        >
                                            <div className="shr-message__meta">
                                                <span className="shr-message__author">
                                                    {message.senderRole === 'requester' ? 'You' : message.senderName}
                                                </span>
                                                <span>{formatDateTime(message.createdAt)}</span>
                                            </div>
                                            <div className="shr-message__body">{message.body}</div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="shr-composer">
                                {!canReply ? (
                                    <div className="shr-composer__closed">
                                        This request is closed. Start a new request if you need more help.
                                    </div>
                                ) : (
                                    <>
                                        <label htmlFor="student-help-request-reply" className="shr-composer__label">
                                            Send a follow-up
                                        </label>
                                        <textarea
                                            id="student-help-request-reply"
                                            rows={4}
                                            value={draftMessage}
                                            onChange={(e) => setDraftMessage(e.target.value)}
                                            placeholder="Add context, answer a follow-up question, or share what changed."
                                            disabled={sendingMessage}
                                        />
                                        <div className="shr-composer__footer">
                                            <span className="shr-composer__hint">
                                                {composerHint}
                                            </span>
                                            <button
                                                className="button button-accept"
                                                disabled={sendingMessage || !draftMessage.trim()}
                                                onClick={sendMessage}
                                            >
                                                <FaPaperPlane /> {sendingMessage ? 'Sending...' : 'Send Message'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    )
}

export default StudentHelpRequests