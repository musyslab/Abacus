import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FaPaperPlane, FaRegClock, FaHandshake, FaCheckCircle } from 'react-icons/fa';
import MenuComponent from '../components/MenuComponent';
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";
import '../../styling/HelpRequests.scss';


interface HelpRequestItem {
    id: number;
    problemName: string | null;
    reason: string;
    description: string;
    status: number; // 0 = Waiting, 1 = In Progress, 2 = Complete, 3 = Student Canceled
    adminName: string | null;
    createdAt: string;
    completedAt: string | null;
}

interface Project {
    Id: number;
    Name: string;
}

const StudentHelpRequests: React.FC = () => {

    const [helpRequests, setHelpRequests] = useState<HelpRequestItem[]>([]);
    const [availableProblems, setAvailableProblems] = useState<Project[]>([]);
    const [historyPage, setHistoryPage] = useState(1);


    const [selectedProblemId, setSelectedProblemId] = useState<string>("");    
    const [reason, setReason] = useState("");
    const [description, setDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const authConfig = useCallback(() => ({
        headers: {
            Authorization: `Bearer ${localStorage.getItem('AUTOTA_AUTH_TOKEN')}`,
            "Content-Type": "application/json",
        }
    }), []);

    const fetchRequests = useCallback(async () => {
        try {
            const res = await axios.get(
                `${import.meta.env.VITE_API_URL}/submissions/my-help-requests`,
                authConfig()
            );
            setHelpRequests(res.data);
        } catch (err) {
            console.error("Failed to fetch help requests:", err);
        }
    }, [authConfig]);


    useEffect(() => {
        fetchRequests();
        const intervalId = setInterval(fetchRequests, 30000); // Poll every 30s
        

        axios.get(`${import.meta.env.VITE_API_URL}/projects/all_projects`, authConfig())
            .then(res => setAvailableProblems(res.data))
            .catch(err => console.error(err));

        return () => clearInterval(intervalId);
    }, [fetchRequests, authConfig]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!selectedProblemId || !reason || !description.trim()) {
            setError("Please select a problem, reason, and describe your issue.");
            return;
        }

        setIsSubmitting(true);
        try {

            const problemIdPayload = selectedProblemId === "general" ? null : parseInt(selectedProblemId, 10);

            await axios.post(
                `${import.meta.env.VITE_API_URL}/submissions/help-request`,
                {
                    problemId: problemIdPayload,
                    reason,
                    description
                },
                authConfig()
            );
            
            // Reset the form
            setSelectedProblemId("");
            setReason("");
            setDescription("");
            fetchRequests(); 
        } catch (err: any) {
            const serverMessage = err.response?.data?.message || "Failed to send request. Please try again.";
            setError(serverMessage);
            console.error("Backend Error:", err.response?.data || err);
        } finally {
            setIsSubmitting(false);
        }
    };
    const handleCancelRequest = async (requestId: number) => {
        if (!window.confirm("Are you sure you want to cancel this help request?")) return;

        try {
            // Change from axios.delete to axios.put, and pass the new status payload
            await axios.put(
                `${import.meta.env.VITE_API_URL}/submissions/help-request/${requestId}`,
                { status: 3 }, // 3 = Canceled
                authConfig()
            );
            fetchRequests(); 
        } catch (err: any) {
            const serverMessage = err.response?.data?.message || "Failed to cancel request.";
            alert(serverMessage); 
            console.error("Failed to cancel:", err);
        }
    };

    const calculateTimeDifference = (timestampStr: string) => {
        if (!timestampStr) return 0;
        let safeTimestampStr = timestampStr.replace(" ", "T");
        if (!safeTimestampStr.endsWith("Z")) safeTimestampStr += "Z";
        const timeDiffMs = new Date().getTime() - new Date(safeTimestampStr).getTime();
        return Math.max(0, Math.floor(timeDiffMs / (1000 * 60)));
    };

    const formatWaitTimeDisplay = (timestampStr: string) => {
        const totalMinutes = calculateTimeDifference(timestampStr);
        if (totalMinutes === 0) return "Just now";
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        if (hours > 0) return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
        return `${totalMinutes} min`;
    };

    const formatTime = (timestampStr: string | null) => {
        if (!timestampStr) return "—";
        let safeTimestampStr = timestampStr.replace(" ", "T");
        if (!safeTimestampStr.endsWith("Z")) safeTimestampStr += "Z";
        return new Date(safeTimestampStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };


    const activeRequests = helpRequests
        .filter(q => q.status !== 2 && q.status !== 3)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const historyRequests = helpRequests
        .filter(q => q.status === 2 || q.status === 3)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const pageSize = 5;
    const totalHistoryPages = Math.max(1, Math.ceil(historyRequests.length / pageSize));
    const safeHistoryPage = Math.min(historyPage, totalHistoryPages);
    const historySlice = historyRequests.slice((safeHistoryPage - 1) * pageSize, safeHistoryPage * pageSize);

    return (
        <div className="oh-page">
            <MenuComponent />
            <DirectoryBreadcrumbs items={[{ label: "My Help Requests" }]} />
            <div className="pageTitle">My Help Requests</div>

            {/* Submit Request Section */}
            <div className="table-section" style={{ padding: '20px', backgroundColor: 'var(--panel-bg, #fff)', borderRadius: '8px', marginBottom: '30px' }}>
                <div className="tableTitle">Submit a New Request</div>
                <form className="help-modal__form" onSubmit={handleSubmit} style={{ marginTop: '15px' }}>
                    {error && <div className="help-modal__error">{error}</div>}
                    
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                        <div className="help-modal__field" style={{ flex: 1 }}>
                            <label htmlFor="problem-select">Related to:</label>
                            <select 
                                id="problem-select" 
                                value={selectedProblemId} 
                                onChange={(e) => setSelectedProblemId(e.target.value)}
                                disabled={isSubmitting}
                            >
                                <option value="" disabled>Select the problem...</option>
                                <option value="general">General System / Environment Issue</option>
                                {availableProblems.map((p) => (
                                    <option key={p.Id} value={p.Id.toString()}>{p.Name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="help-modal__field" style={{ flex: 1 }}>
                            <label htmlFor="reason-select">Reason:</label>
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
                    
                    <div className="help-modal__field">
                        <label htmlFor="issue-description">Description:</label>
                        <textarea 
                            id="issue-description" 
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="help-modal__footer" style={{ marginTop: '15px', justifyContent: 'flex-start' }}>
                        <button type="submit" className="btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? "Sending..." : (
                                <><FaPaperPlane style={{ marginRight: "8px" }} /> Submit Request</>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Active Queue Section */}
            <div className="table-section">
                <div className="tableTitle">Active Requests</div>
                <table border={1} className="question-queue-table oh-table">
                    <thead className="table-head">
                        <tr className="head-row">
                            <th className="col-status">Status</th>
                            <th className="col-problem">Problem</th>
                            <th className="col-reason">Reason</th>
                            <th className="col-description">Description</th>
                            <th className="col-wait">Wait Time</th>
                            <th className="col-actions">Actions</th> 
                        </tr>
                    </thead>
                    <tbody className="table-body">
                        {activeRequests.length === 0 ? (
                            <tr className="empty-row">
                                <td className="empty-cell" colSpan={6}>You have no active help requests.</td>
                            </tr>
                        ) : (
                            activeRequests.map((item) => (
                                <tr key={item.id} className={`data-row ${item.status === 1 ? 'is-in-oh' : ''}`}>
                                    <td className="cell-status">
                                        {item.status === 1 ? (
                                            <span 
                                                className="status in-oh" 
                                                title={`Being helped by ${item.adminName || 'an Admin'}`}
                                                style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                                            >
                                                <FaHandshake /> 
                                                <span>
                                                    Helped by <strong style={{ fontWeight: '600' }}>{item.adminName || 'Admin'}</strong>
                                                </span>
                                            </span>
                                        ) : (
                                            <span className="status waiting" title="Waiting in queue">
                                                <FaRegClock /> Waiting
                                            </span>
                                        )}
                                    </td>
                                    <td className="cell-problem">{item.problemName || "General"}</td>
                                    <td className="cell-reason">{item.reason}</td>
                                    <td className="cell-description">{item.description}</td>
                                    <td className="cell-wait">{formatWaitTimeDisplay(item.createdAt)}</td>
                                    
                                    <td className="cell-actions">
                                        {item.status === 0 ? (
                                            <button 
                                                className="button" 
                                                style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                                                onClick={() => handleCancelRequest(item.id)}
                                            >
                                                Cancel
                                            </button>
                                        ) : (
                                            <span style={{ fontSize: '0.85em', color: '#666' }}>Locked</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* History Section */}
            <div className="table-section">
                <div className="tableTitle">History</div>
                <table border={1} className="question-queue-table oh-table history-table">
                    <thead className="table-head">
                        <tr className="head-row">
                            <th className="col-status">Status</th>
                            <th className="col-problem">Problem</th>
                            <th className="col-reason">Reason</th>
                            <th className="col-description">Description</th>
                            <th className="col-wait">Requested At</th>
                            <th className="col-feedback">Resolved At</th>
                        </tr>
                    </thead>
                    <tbody className="table-body">
                        {historyRequests.length === 0 ? (
                            <tr className="empty-row">
                                <td className="empty-cell" colSpan={6}>No history yet.</td>
                            </tr>
                        ) : (
                            historySlice.map((item) => (
                                <tr key={`hist-${item.id}`} className="data-row is-history">
                                    <td className="cell-status">
                                        <span 
                                            className="status outcome-accepted" 
                                            title={`Resolved by ${item.adminName || 'Admin'}`}
                                            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                                        >
                                            <FaCheckCircle /> 
                                            <span>
                                                Resolved 
                                                {item.adminName && (
                                                    <span style={{ fontSize: '0.85em', opacity: 0.8, display: 'block' }}>
                                                        by {item.adminName}
                                                    </span>
                                                )}
                                            </span>
                                        </span>
                                    </td>
                                    <td className="cell-problem">{item.problemName || "General"}</td>
                                    <td className="cell-reason">{item.reason}</td>
                                    <td className="cell-description">{item.description}</td>
                                    <td className="cell-wait">{formatTime(item.createdAt)}</td>
                                    <td className="cell-feedback">{formatTime(item.completedAt)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {historyRequests.length > pageSize && (
                    <div className="pagination-controls">
                        <button className="button" onClick={() => setHistoryPage(Math.max(1, safeHistoryPage - 1))} disabled={safeHistoryPage <= 1}>
                            Prev
                        </button>
                        <div className="pagination-meta">
                            Page {safeHistoryPage} of {totalHistoryPages}
                        </div>
                        <button className="button" onClick={() => setHistoryPage(Math.min(totalHistoryPages, safeHistoryPage + 1))} disabled={safeHistoryPage >= totalHistoryPages}>
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentHelpRequests;