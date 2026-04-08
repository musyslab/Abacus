import { Component } from 'react'
import axios from 'axios'
import '../../styling/HelpRequests.scss' 
import MenuComponent from '../components/MenuComponent'
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs"
import {
    FaHandshake,
    FaRegClock,
    FaCheckCircle,
    FaPlay,
    FaUndo,
    FaTimesCircle,
    FaSync,
} from 'react-icons/fa'

interface HelpRequestsState {
    helpRequests: Array<HelpRequestItem>
    historyPage: number
}

interface HelpRequestItem {
    id: number
    studentId: number
    teacherId: number
    teamDivision: string
    teamName: string
    teamSchool: string
    problemName: string | null
    reason: string
    description: string
    status: number // 0 = Waiting, 1 = In Progress, 2 = Complete, 3 = Canceled by Student
    adminName: string | null
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
        if (prevState.helpRequests !== this.state.helpRequests) {
            const history = this.state.helpRequests.filter((q) => q.status === 2)
            const totalPages = Math.max(1, Math.ceil(history.length / 5))
            if (this.state.historyPage > totalPages) {
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
                this.fetchRequests() 
            })
            .catch((err) => {

                if (err.response && err.response.status === 409) {
                    alert("Another admin or the student has already updated this request!")
                    this.fetchRequests() 
                } else {
                    console.error("Failed to update status:", err)
                    alert("Failed to update status. Please try again.")
                }
            })
    }

    calculateTimeDifference = (timestampStr: string) => {
        if (!timestampStr) return 0

        let safeTimestampStr = timestampStr.replace(" ", "T")
        
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
        
        let safeTimestampStr = timestampStr.replace(" ", "T")
        if (!safeTimestampStr.endsWith("Z")) {
            safeTimestampStr += "Z"
        }

        return new Date(safeTimestampStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    startFetchingInterval() {
        this.fetchRequests()
        this.fetchIntervalId = window.setInterval(this.fetchRequests, 500000) // Fetch every 5 minutes 
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

        const allActiveQuestions = helpRequests
            .filter((q) => q.status !== 2 && q.status !== 3)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) 

        const studentQueue = allActiveQuestions.filter((q) => q.studentId !== 0)
        const teacherQueue = allActiveQuestions.filter((q) => q.studentId === 0)

        const historyQuestions = helpRequests
            .filter((q) => q.status === 2 || q.status === 3)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) 

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
                            { label: "Admin Menu", to: "/admin" },
                            { label: "Help Requests" },
                        ]}
                    />

                    <div 
                        className="pageTitle" 
                        style={{ 
                            position: 'relative', 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center' 
                        }}
                    >
                        <span>Help Requests</span>
                        <button 
                            className="button" 
                            onClick={this.fetchRequests}
                            title="Refresh requests manually"
                            style={{ 
                                position: 'absolute', 
                                right: '15px', /* Adjust this to match your inner padding */
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px',
                                margin: 0 /* Ensures the button doesn't inherit unwanted margins */
                            }}
                        >
                            <FaSync aria-hidden="true" /> Refresh
                        </button>
                    </div>
                    {/* ======================= STUDENT QUEUE ======================= */}
                    <div className="table-section">
                        <div className="tableTitle">Student Queue</div>
                        <table border={1} className="question-queue-table oh-table">
                            <thead className="table-head">
                                <tr className="head-row">
                                    <th className="col-status">Status</th>
                                    <th className="col-position">Queue</th>
                                    <th className="col-division">Division</th>
                                    <th className="col-student">Team Name</th>
                                    <th className="col-school">Team School</th>
                                    <th className="col-problem">Problem</th>
                                    <th className="col-reason">Reason</th>
                                    <th className="col-description">Description</th>
                                    <th className="col-wait">Wait Time</th>
                                    <th className="col-feedback">Actions</th>
                                </tr>
                            </thead>

                            <tbody className="table-body">
                                {studentQueue.length === 0 ? (
                                    <tr className="empty-row">
                                        <td className="empty-cell" colSpan={9}>
                                            No students are currently waiting for help.
                                        </td>
                                    </tr>
                                ) : (
                                    studentQueue.map((item: HelpRequestItem, index) => (
                                        <tr
                                            key={item.id}
                                            className={`data-row ${item.status === 1 ? 'is-in-oh' : ''}`}
                                        >
                                            <td className="cell-status" aria-label={item.status === 1 ? 'In Progress' : 'Waiting'}>
                                                {item.status === 1 ? (
                                                    <span className="status in-oh" aria-hidden="true" title={`Being helped by ${item.adminName || 'an Admin'}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <FaHandshake /> 
                                                        <span style={{ fontSize: '0.85em', fontWeight: 'bold' }}>{item.adminName}</span>
                                                    </span>
                                                ) : (
                                                    <span className="status waiting" aria-hidden="true" title="Waiting in queue">
                                                        <FaRegClock />
                                                    </span>
                                                )}
                                            </td>

                                            <td className="cell-position">{index + 1}</td>
                                            <td className="cell-division"><strong>{item.teamDivision ? item.teamDivision : "N/A"}</strong></td>
                                            <td className="cell-student"><strong>{item.teamName !== "Team 0" ? item.teamName : "N/A"}</strong></td>
                                            <td className="cell-school"><strong>{item.teamSchool ? item.teamSchool : "N/A"}</strong></td>
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

                    {/* ======================= TEACHER QUEUE ======================= */}
                    <div className="table-section" style={{ marginTop: '2rem' }}>
                        <div className="tableTitle">Teacher Queue</div>
                        <table border={1} className="question-queue-table oh-table">
                            <thead className="table-head">
                                <tr className="head-row">
                                    <th className="col-status">Status</th>
                                    <th className="col-position">Queue</th>
                                    <th className="col-student">Name</th>
                                    <th className="col-school">School</th>
                                    <th className="col-problem">Problem</th>
                                    <th className="col-reason">Reason</th>
                                    <th className="col-description">Description</th>
                                    <th className="col-wait">Wait Time</th>
                                    <th className="col-feedback">Actions</th>
                                </tr>
                            </thead>

                            <tbody className="table-body">
                                {teacherQueue.length === 0 ? (
                                    <tr className="empty-row">
                                        <td className="empty-cell" colSpan={8}>
                                            No teachers are currently waiting for help.
                                        </td>
                                    </tr>
                                ) : (
                                    teacherQueue.map((item: HelpRequestItem, index) => (
                                        <tr
                                            key={item.id}
                                            className={`data-row ${item.status === 1 ? 'is-in-oh' : ''}`}
                                        >
                                            <td className="cell-status" aria-label={item.status === 1 ? 'In Progress' : 'Waiting'}>
                                                {item.status === 1 ? (
                                                    <span className="status in-oh" aria-hidden="true" title={`Being helped by ${item.adminName || 'an Admin'}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <FaHandshake /> 
                                                        <span style={{ fontSize: '0.85em', fontWeight: 'bold' }}>{item.adminName}</span>
                                                    </span>
                                                ) : (
                                                    <span className="status waiting" aria-hidden="true" title="Waiting in queue">
                                                        <FaRegClock />
                                                    </span>
                                                )}
                                            </td>

                                            <td className="cell-position">{index + 1}</td>
                                            <td className="cell-student"><strong>{item.teamName ? item.teamName : "N/A"}</strong></td>
                                            <td className="cell-school"><strong>{item.teamSchool ? item.teamSchool : "N/A"}</strong></td>
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

                    {/* ======================= HISTORY TABLE ======================= */}
                    <div className="table-section" style={{ marginTop: '2rem' }}>
                        <div className="tableTitle">History</div>
                        <table border={1} className="question-queue-table oh-table history-table">
                            <thead className="table-head">
                                <tr className="head-row">
                                    <th className="col-status">Status</th>
                                    <th className="col-role">Role</th>
                                    <th className="col-division">Team Division</th>
                                    <th className="col-student">Team/Teacher Name</th>
                                    <th className="col-school">Team School</th>
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
                                        <td className="empty-cell" colSpan={10}>
                                            No history yet.
                                        </td>
                                    </tr>
                                ) : (
                                    historySlice.map((item: HelpRequestItem) => (
                                        <tr key={`hist-${item.id}`} className="data-row is-history">
                                            <td className="cell-status" aria-label="Outcome">
                                                {item.status === 3 ? (
                                                    <span className="status" style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '5px' }} title="Canceled by Student">
                                                        <FaTimesCircle /> Canceled
                                                    </span>
                                                ) : (
                                                    <span className="status outcome-accepted" style={{ display: 'flex', alignItems: 'center', gap: '5px' }} title={`Resolved by ${item.adminName || 'Admin'}`}>
                                                        <FaCheckCircle /> 
                                                        <span>
                                                            Resolved {item.adminName && <span style={{ fontSize: '0.85em', opacity: 0.8 }}><br/>by {item.adminName}</span>}
                                                        </span>
                                                    </span>
                                                )}
                                            </td>
                                            <td className="cell-role"><strong>{item.studentId === 0 ? "Teacher" : "Student"}</strong></td>
                                            <td className="cell-division"><strong>{item.teamDivision ? item.teamDivision : "N/A"}</strong></td>
                                            <td className="cell-student"><strong>{item.teamName ? item.teamName : "N/A"}</strong></td>
                                            <td className="cell-school"><strong>{item.teamSchool ? item.teamSchool : "N/A"}</strong></td>
                                            <td className="cell-problem">{item.problemName?item.problemName:"General"}</td>
                                            <td className="cell-reason">{item.reason}</td>
                                            <td className="cell-description">{item.description}</td>
                                            <td className="cell-wait">{this.formatTime(item.createdAt)}</td>
                                            <td className="cell-feedback">{this.formatTime(item.completedAt)}</td>
                                            <td className="cell-actions">
                                                {item.status === 3 ? (
                                                    <span style={{ fontSize: '0.85em', color: '#666', fontStyle: 'italic' }}>
                                                        N/A
                                                    </span>
                                                ) : (
                                                    <button
                                                        className="button"
                                                        style={{ backgroundColor: '#f59e0b', color: 'white', border: 'none' }}
                                                        onClick={() => {
                                                            if (window.confirm("Are you sure you want to reopen this request?")) {
                                                                this.updateRequestStatus(item.id, 0)
                                                            }
                                                        }}
                                                        title="Send back to the active queue"
                                                    >
                                                        <FaUndo aria-hidden="true" /> Reopen
                                                    </button>
                                                )}
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