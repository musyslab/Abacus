import { Component } from 'react'
import axios from 'axios'
import '../../styling/AdminHelpRequests.scss' 
import MenuComponent from '../components/MenuComponent'
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs"
import {
    FaHandshake,
    FaRegClock,
    FaCheckCircle,
    FaPlay,
    FaUndo,
} from 'react-icons/fa'

interface HelpRequestsState {
    helpRequests: Array<HelpRequestItem>
    historyPage: number
}

interface HelpRequestItem {
    id: number
    studentId: number
    teamDivision: string
    teamName: string
    problemName: string | null
    reason: string
    description: string
    status: number // 0 = Waiting, 1 = In Progress, 2 = Complete
    createdAt: string
    completedAt: string | null
}

class AdminHelpRequests extends Component<{}, HelpRequestsState> {
    private fetchIntervalId: number | undefined

    constructor(props: {}) {
        super(props)
        this.state = {
            helpRequests: [],
            historyPage: 1,
        }
        this.fetchRequests = this.fetchRequests.bind(this)
        this.updateRequestStatus = this.updateRequestStatus.bind(this)
        this.startFetchingInterval = this.startFetchingInterval.bind(this)
        this.setHistoryPage = this.setHistoryPage.bind(this)
    }

    componentDidMount() {
        this.startFetchingInterval()
    }

    componentDidUpdate(_prevProps: {}, prevState: HelpRequestsState) {
        // Clamp history page if the history size shrinks
        if (prevState.helpRequests !== this.state.helpRequests) {
            const history = this.state.helpRequests.filter((q) => q.status === 2)
            const totalPages = Math.max(1, Math.ceil(history.length / 5))
            if (this.state.historyPage > totalPages) {
                // eslint-disable-next-line react/no-did-update-set-state
                this.setState({ historyPage: totalPages })
            }
        }
    }

    componentWillUnmount() {
        if (this.fetchIntervalId) {
            window.clearInterval(this.fetchIntervalId)
        }
    }

    fetchRequests = () => {
        axios
            .get(`${import.meta.env.VITE_API_URL}/submissions/help-requests`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('AUTOTA_AUTH_TOKEN')}`,
                },
            })
            .then((res) => {
                this.setState({ helpRequests: res.data })
            })
            .catch((err) => {
                console.error("Failed to fetch help requests:", err)
            })
    }

    // Handles changing status (0 -> 1 -> 2)
    updateRequestStatus = (id: number, newStatus: number) => {
        axios
            .put(
                `${import.meta.env.VITE_API_URL}/submissions/help-request/${id}`,
                { status: newStatus },
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('AUTOTA_AUTH_TOKEN')}`,
                        "Content-Type": "application/json",
                    },
                }
            )
            .then(() => {
                this.fetchRequests() // Refresh the queue immediately
            })
            .catch((err) => {
                console.error("Failed to update status:", err)
            })
    }

    calculateTimeDifference = (timestampStr: string) => {
        if (!timestampStr) return 0

        // 1. Replace space with T (Safari compatibility)
        let safeTimestampStr = timestampStr.replace(" ", "T")
        
        // 2. Force the browser to treat it as UTC by appending 'Z'
        if (!safeTimestampStr.endsWith("Z")) {
            safeTimestampStr += "Z"
        }

        const currentTime = new Date()
        const questionTimestamp = new Date(safeTimestampStr)
        
        const timeDifferenceInMilliseconds = currentTime.getTime() - questionTimestamp.getTime()
        const timeDifferenceInMinutes = Math.floor(timeDifferenceInMilliseconds / (1000 * 60))
        
        return Math.max(0, timeDifferenceInMinutes)
    }

    formatTime = (timestampStr: string | null) => {
        if (!timestampStr) return "—"
        
        // Do the exact same UTC fix for the visual timestamps!
        let safeTimestampStr = timestampStr.replace(" ", "T")
        if (!safeTimestampStr.endsWith("Z")) {
            safeTimestampStr += "Z"
        }

        // Now when it prints the time, it will perfectly match the judge's local clock
        return new Date(safeTimestampStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    startFetchingInterval() {
        this.fetchRequests()
        // Poll every 30 seconds for a live competition environment
        this.fetchIntervalId = window.setInterval(this.fetchRequests, 30000) 
    }
    formatWaitTimeDisplay = (timestampStr: string) => {
        const totalMinutes = this.calculateTimeDifference(timestampStr);
        
        if (totalMinutes === 0) return "Just now";
        
        const hours = Math.floor(totalMinutes / 60);
        const remainingMinutes = totalMinutes % 60;
        
        if (hours > 0) {
            return remainingMinutes > 0 
                ? `${hours} hr ${remainingMinutes} min` 
                : `${hours} hr`;
        }
        
        return `${totalMinutes} min`;
    }

    setHistoryPage(nextPage: number) {
        this.setState({ historyPage: nextPage })
    }

    render() {
        const { helpRequests } = this.state

        // Queue: Status 0 (Waiting) or 1 (In Progress)
        const queueQuestions = helpRequests
            .filter((q) => q.status !== 2)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) // Oldest first

        // History: Status 2 (Completed)
        const historyQuestions = helpRequests
            .filter((q) => q.status === 2)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) // Newest first

        const pageSize = 5
        const totalHistoryPages = Math.max(1, Math.ceil(historyQuestions.length / pageSize))
        const historyPage = Math.min(this.state.historyPage, totalHistoryPages)
        const historyStart = (historyPage - 1) * pageSize
        const historySlice = historyQuestions.slice(historyStart, historyStart + pageSize)
        return (
            <div className="oh-page">
                <>
                    <MenuComponent/>

                    <DirectoryBreadcrumbs
                        items={[
                            { label: "Help Requests" },
                        ]}
                    />

                    <div className="pageTitle">Help Requests</div>

                    <div className="table-section">
                        <div className="tableTitle">Current Queue</div>
                        <table border={1} className="question-queue-table oh-table">
                            <thead className="table-head">
                                <tr className="head-row">
                                    <th className="col-status">Status</th>
                                    <th className="col-position">Queue</th>
                                    <th className="col-role">Role</th>
                                    <th className="col-division">Division</th>
                                    <th className="col-student">Team Name</th>
                                    <th className="col-problem">Problem</th>
                                    <th className="col-reason">Reason</th>
                                    <th className="col-description">Description</th>
                                    <th className="col-wait">Wait Time</th>
                                    <th className="col-feedback">Actions</th>
                                </tr>
                            </thead>

                            <tbody className="table-body">
                                {queueQuestions.length === 0 ? (
                                    <tr className="empty-row">
                                        <td className="empty-cell" colSpan={7}>
                                            No teams are currently waiting for help.
                                        </td>
                                    </tr>
                                ) : (
                                    queueQuestions.map((item: HelpRequestItem, index) => (
                                        <tr
                                            key={item.id}
                                            className={`data-row ${item.status === 1 ? 'is-in-oh' : ''}`}
                                        >
                                            <td className="cell-status" aria-label={item.status === 1 ? 'In Progress' : 'Waiting'}>
                                                {item.status === 1 ? (
                                                    <span className="status in-oh" aria-hidden="true" title="A judge is helping them">
                                                        <FaHandshake />
                                                    </span>
                                                ) : (
                                                    <span className="status waiting" aria-hidden="true" title="Waiting in queue">
                                                        <FaRegClock />
                                                    </span>
                                                )}
                                            </td>

                                            <td className="cell-position">{index + 1}</td>
                                            <td className="cell-role"><strong>{item.teamName ? "Student" : "Teacher"}</strong></td>
                                            <td className="cell-division"><strong>{item.teamDivision}</strong></td>
                                            <td className="cell-student"><strong>{item.teamName}</strong></td>
                                            <td className="cell-problem">{item.problemName ? item.problemName : "General"}</td>
                                            <td className="cell-reason">{item.reason}</td>
                                            <td className="cell-description">{item.description}</td>
                                            <td className="cell-wait">
                                                {this.formatWaitTimeDisplay(item.createdAt)}
                                            </td>

                                            <td className="cell-feedback">
                                                {item.status === 0 ? (
                                                    <button
                                                        className="button button-accept"
                                                        onClick={() => this.updateRequestStatus(item.id, 1)}
                                                    >
                                                        <FaPlay aria-hidden="true" /> Start Helping
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="button button-completed"
                                                        onClick={() => this.updateRequestStatus(item.id, 2)}
                                                    >
                                                        <FaCheckCircle aria-hidden="true" /> Resolve
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="table-section">
                        <div className="tableTitle">History</div>
                        <table border={1} className="question-queue-table oh-table history-table">
                            <thead className="table-head">
                                <tr className="head-row">
                                    <th className="col-status">Status</th>
                                    <th className="col-role">Role</th>
                                    <th className="col-division">Team Division</th>
                                    <th className="col-student">Team Name</th>
                                    <th className="col-problem">Problem</th>
                                    <th className="col-reason">Reason</th>
                                    <th className="col-description">Description</th>
                                    <th className="col-wait">Requested At</th>
                                    <th className="col-feedback">Resolved At</th>
                                    <th className="col-actions">Actions</th>
                                </tr>
                            </thead>

                            <tbody className="table-body">
                                {historyQuestions.length === 0 ? (
                                    <tr className="empty-row">
                                        <td className="empty-cell" colSpan={6}>
                                            No history yet.
                                        </td>
                                    </tr>
                                ) : (
                                    historySlice.map((item: HelpRequestItem) => (
                                        <tr key={`hist-${item.id}`} className="data-row is-history">
                                            <td className="cell-status" aria-label="Outcome">
                                                <span className="status outcome-accepted" aria-hidden="true">
                                                    <FaCheckCircle />
                                                </span>
                                            </td>
                                            <td className="cell-role"><strong>{item.teamName ? "Student" : "Teacher"}</strong></td>
                                            <td className="cell-division"><strong>{item.teamDivision}</strong></td>
                                            <td className="cell-student"><strong>{item.teamName}</strong></td>
                                            <td className="cell-problem">{item.problemName?item.problemName:"General"}</td>
                                            <td className="cell-reason">{item.reason}</td>
                                            <td className="cell-description">{item.description}</td>
                                            <td className="cell-wait">{this.formatTime(item.createdAt)}</td>
                                            <td className="cell-feedback">{this.formatTime(item.completedAt)}</td>
                                            <td className="cell-actions">
                                                <button
                                                    className="button"
                                                    style={{ backgroundColor: '#f59e0b', color: 'white', border: 'none' }}
                                                    onClick={() => {
                                                        if(window.confirm("Are you sure you want to reopen this request?")) {
                                                            this.updateRequestStatus(item.id, 0)
                                                        }
                                                    }}
                                                    title="Send back to the active queue"
                                                >
                                                    <FaUndo aria-hidden="true" /> Reopen
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {historyQuestions.length > pageSize && (
                            <div className="pagination-controls" aria-label="History pagination">
                                <button
                                    className="button"
                                    onClick={() => this.setHistoryPage(Math.max(1, historyPage - 1))}
                                    disabled={historyPage <= 1}
                                >
                                    Prev
                                </button>
                                <div className="pagination-meta">
                                    Page {historyPage} of {totalHistoryPages}
                                </div>
                                <button
                                    className="button"
                                    onClick={() => this.setHistoryPage(Math.min(totalHistoryPages, historyPage + 1))}
                                    disabled={historyPage >= totalHistoryPages}
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </>
            </div>
        )
    }
}

export default AdminHelpRequests