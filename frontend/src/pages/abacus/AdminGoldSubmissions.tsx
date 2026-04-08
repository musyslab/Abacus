import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { useParams } from "react-router-dom";
import { FaExternalLinkAlt, FaHistory, FaPen } from "react-icons/fa";

import MenuComponent from "../components/MenuComponent";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";

import "../../styling/AdminGoldSubmissions.scss";

type SubmissionStatus =
  | "graded"
  | "needs_grading"
  | "not_submitted"
  | "regrade_requested";

type Submission = {
  id: number | null;
  link: string | null;
  studentId: number | null;
  projectId: number | null;
  teamId: number | null;
  teamName: string | null;
  teamNumber: number | null;
  schoolName: string | null;
  submittedAt: string | null;
  points: number | null;
  feedback: string | null;
  adminGraderId: number | null;
  hasSubmission: boolean;
  status: SubmissionStatus;
  regradeRequested: boolean;
  regradeRequestedAt: string | null;
  regradeRequestedByStudentId: number | null;
};

type VisibleSubmissionsResponse = {
  currentAdminId: number | null;
  canGrade: boolean;
  isTeacherView: boolean;
  projectId: number | null;
  projectName: string | null;
  submissions: Submission[];
};

type SubmissionHistoryItem = {
  id: number;
  link: string | null;
  studentId: number | null;
  projectId: number | null;
  teamId: number | null;
  submittedAt: string | null;
  points: number | null;
  feedback: string | null;
  adminGraderId: number | null;
  adminGraderName: string | null;
  status: SubmissionStatus;
  regradeRequested: boolean;
  regradeRequestedAt: string | null;
  regradeRequestedByStudentId: number | null;
};

type SubmissionHistoryResponse = {
  teamId: number | null;
  teamName: string | null;
  teamNumber: number | null;
  schoolName: string | null;
  projectId: number | null;
  projectName: string | null;
  history: SubmissionHistoryItem[];
};

const AdminGoldSubmissions = () => {
  const API = (import.meta.env.VITE_API_URL as string) || "";
  const { projectId } = useParams<{ projectId?: string }>();

  const parsedProjectId =
    projectId && !Number.isNaN(Number(projectId)) ? Number(projectId) : null;

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentAdminId, setCurrentAdminId] = useState<number | null>(null);
  const [canGrade, setCanGrade] = useState(false);
  const [isTeacherView, setIsTeacherView] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);

  const [pointsInput, setPointsInput] = useState<string>("");
  const [feedbackInput, setFeedbackInput] = useState<string>("");

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>("");

  const [modalOpen, setModalOpen] = useState(false);
  const [activeSubmission, setActiveSubmission] =
    useState<Submission | null>(null);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyContext, setHistoryContext] =
    useState<SubmissionHistoryResponse | null>(null);

  function authConfig() {
    const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  const fetchSubmissions = async (showLoader = false) => {
    if (showLoader) setLoading(true);

    try {
      const url = parsedProjectId
        ? `${API}/gold-division/visible?project_id=${parsedProjectId}`
        : `${API}/gold-division/visible`;

      const res = await axios.get<VisibleSubmissionsResponse>(url, authConfig());

      setSubmissions(res.data?.submissions || []);
      setCurrentAdminId(res.data?.currentAdminId ?? null);
      setCanGrade(Boolean(res.data?.canGrade));
      setIsTeacherView(Boolean(res.data?.isTeacherView));
      setProjectName(res.data?.projectName ?? null);
    } catch (err) {
      console.error("Failed to fetch submissions", err);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions(true);
    const interval = setInterval(() => fetchSubmissions(false), 3000);
    return () => clearInterval(interval);
  }, [API, parsedProjectId]);

  const openModal = (submission: Submission) => {
    if (!canGrade || !submission.hasSubmission || !submission.id) return;

    setActiveSubmission(submission);
    setPointsInput(submission.points?.toString() ?? "");
    setFeedbackInput(submission.feedback ?? "");
    setSaveError("");
    setSaved(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setActiveSubmission(null);
    setSaved(false);
    setSaveError("");
    setSaving(false);
  };

  const openHistoryModal = async (submission: Submission) => {
    if (!canGrade || !submission.hasSubmission || !submission.id) return;

    setHistoryModalOpen(true);
    setHistoryLoading(true);
    setHistoryError("");
    setHistoryContext(null);

    try {
      const res = await axios.get<SubmissionHistoryResponse>(
        `${API}/gold-division/history/${submission.id}`,
        authConfig()
      );
      setHistoryContext(res.data);
    } catch (err) {
      console.error("Failed to fetch submission history", err);
      setHistoryError("Failed to load history. Please try again.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistoryModal = () => {
    if (historyLoading) return;
    setHistoryModalOpen(false);
    setHistoryError("");
    setHistoryContext(null);
  };

  const saveEvaluation = async () => {
    if (!activeSubmission || !activeSubmission.id || !canGrade) return;

    const pointsValue = Number(pointsInput);
    if (Number.isNaN(pointsValue)) {
      setSaveError("Points must be a valid number.");
      return;
    }

    try {
      setSaving(true);
      setSaveError("");

      await axios.post(
        `${API}/gold-division/grade/${activeSubmission.id}`,
        {
          points: pointsValue,
          feedback: feedbackInput,
        },
        authConfig()
      );

      setSaved(true);
      await fetchSubmissions(false);

      setTimeout(() => {
        setModalOpen(false);
        setActiveSubmission(null);
        setSaved(false);
        setSaveError("");
        setSaving(false);
      }, 1200);
    } catch (err) {
      console.error("Failed to save evaluation", err);
      setSaving(false);
      setSaveError("Failed to save grade. Please try again.");
    }
  };

  const formatDateTime = (timestampStr: string | null) => {
    if (!timestampStr) return "—";
    const date = new Date(timestampStr);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  };

  const getStatusLabel = (status: SubmissionStatus) => {
    switch (status) {
      case "graded":
        return "Graded";
      case "needs_grading":
        return "Needs grading";
      case "regrade_requested":
        return "Regrade requested";
      case "not_submitted":
        return "Not submitted";
      default:
        return "—";
    }
  };

  const getStatusClassName = (status: SubmissionStatus) => {
    switch (status) {
      case "graded":
        return "graded";
      case "needs_grading":
        return "needs_grading";
      case "regrade_requested":
        return "needs_grading regrade-requested";
      case "not_submitted":
        return "not_submitted";
      default:
        return "";
    }
  };

  const reviewedProblemLabel = projectName
    ? `: ${projectName}`
    : parsedProjectId
      ? `: Problem ${parsedProjectId}`
      : "";

  const pageTitle = isTeacherView
    ? `Gold Division Projects${reviewedProblemLabel}`
    : `Gold Submissions${reviewedProblemLabel}`;

  const tableTitle = "Gold Division Team Submissions";

  const breadcrumbs = isTeacherView
    ? [
        { label: "Team Manage", to: "/teacher/team-manage" },
        { label: "Gold Division Projects" },
      ]
    : [
        { label: "Admin Menu", to: "/admin" },
        { label: "Gold Division Problem List", to: "/admin/gold/problems" },
        { label: pageTitle },
      ];

  const summary = useMemo(() => {
    const graded = submissions.filter((s) => s.status === "graded").length;
    const needsGrading = submissions.filter(
      (s) => s.status === "needs_grading"
    ).length;
    const regradeRequested = submissions.filter(
      (s) => s.status === "regrade_requested"
    ).length;
    const notSubmitted = submissions.filter(
      (s) => s.status === "not_submitted"
    ).length;

    return {
      graded,
      needsGrading,
      regradeRequested,
      notSubmitted,
      total: submissions.length,
    };
  }, [submissions]);

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
      </Helmet>

      <MenuComponent />

      <div className="gold-page">
        <DirectoryBreadcrumbs items={breadcrumbs} />

        <div className="pageTitle">{pageTitle}</div>

        <div className="table-section">
          <div className="tableTitle">{tableTitle}</div>

          {!loading && (
            <div className="gold-summary">
              <div className="summary-pill">
                <strong>Total teams:</strong> {summary.total}
              </div>
              <div className="summary-pill graded">
                <strong>Graded:</strong> {summary.graded}
              </div>
              <div className="summary-pill needs-grading">
                <strong>Needs grading:</strong> {summary.needsGrading}
              </div>
              <div className="summary-pill needs-grading">
                <strong>Regrade requested:</strong> {summary.regradeRequested}
              </div>
              <div className="summary-pill not-submitted">
                <strong>Not submitted:</strong> {summary.notSubmitted}
              </div>
            </div>
          )}

          {loading ? (
            <div className="gold-loading">Loading...</div>
          ) : (
            <table border={1} className="gold-submissions-table">
              <thead className="table-head">
                <tr className="head-row">
                  <th>Team</th>
                  <th>School</th>
                  <th>Submitted By</th>
                  <th>Project</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  {canGrade && <th>Points</th>}
                  {!isTeacherView && <th>Actions</th>}
                </tr>
              </thead>

              <tbody className="table-body">
                {submissions.map((s, index) => (
                  <tr
                    key={`${s.teamId ?? "team"}-${s.id ?? "none"}-${index}`}
                    className={`data-row status-${s.status} ${
                      s.status === "regrade_requested" ? "status-needs_grading" : ""
                    }`}
                  >
                    <td>
                      <div className="team-cell">
                        <strong>{s.teamName || "Unnamed Team"}</strong>
                        {s.teamNumber ? (
                          <span className="team-meta">Team #{s.teamNumber}</span>
                        ) : null}
                      </div>
                    </td>

                    <td>{s.schoolName || "—"}</td>

                    <td>{s.studentId ?? "—"}</td>

                    <td>
                      {s.hasSubmission && s.link ? (
                        <a
                          className="button button-view-code"
                          href={s.link}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FaExternalLinkAlt />
                          View
                        </a>
                      ) : (
                        <span className="muted-text">No submission yet</span>
                      )}
                    </td>

                    <td>{formatDateTime(s.submittedAt)}</td>

                    <td>
                      <span className={`status-badge ${getStatusClassName(s.status)}`}>
                        {getStatusLabel(s.status)}
                      </span>
                    </td>

                    {canGrade && <td>{s.hasSubmission ? s.points ?? "—" : "—"}</td>}

                    {!isTeacherView && (
                      <td className="cell-actions">
                        {canGrade && s.hasSubmission ? (
                          <>
                            <button
                              className="button button-history"
                              onClick={() => openHistoryModal(s)}
                            >
                              <FaHistory />
                              History
                            </button>

                            <button
                              className="button button-completed"
                              onClick={() => openModal(s)}
                            >
                              <FaPen />
                              {s.status === "graded"
                                ? "Edit Grade"
                                : s.status === "regrade_requested"
                                  ? "Review Regrade"
                                  : "Grade"}
                            </button>
                          </>
                        ) : (
                          <span className="muted-text">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {canGrade && modalOpen && activeSubmission && (
          <div className="modal-overlay">
            <div className="modal">
              <h2 className="modal-title">
                Grade Submission
                {activeSubmission.teamName ? ` — ${activeSubmission.teamName}` : ""}
              </h2>

              <div className="modal-subtitle">
                {activeSubmission.schoolName || "Gold Division Team"}
                {activeSubmission.regradeRequested ? " • Regrade requested" : ""}
              </div>

              <div className="form-group">
                <label>Points</label>
                <input
                  type="number"
                  value={pointsInput}
                  onChange={(e) => setPointsInput(e.target.value)}
                  placeholder="Enter score"
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label>Feedback</label>
                <textarea
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  placeholder="Write helpful feedback..."
                  disabled={saving}
                />
              </div>

              {saveError ? <div className="form-error">{saveError}</div> : null}

              <div className="modal-actions">
                <button
                  className={`button button-completed primary ${saved ? "is-saved" : ""}`}
                  onClick={saveEvaluation}
                  disabled={saving}
                >
                  {saved ? "✓ Saved" : saving ? "Saving..." : "Save Grade"}
                </button>

                <button
                  className="button secondary"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {canGrade && historyModalOpen && (
          <div className="modal-overlay">
            <div className="modal modal-history">
              <h2 className="modal-title">
                Submission History
                {historyContext?.teamName ? ` — ${historyContext.teamName}` : ""}
              </h2>

              <div className="modal-subtitle">
                {historyContext?.projectName || projectName || "Gold Division Project"}
                {historyContext?.schoolName ? ` • ${historyContext.schoolName}` : ""}
              </div>

              {historyLoading ? (
                <div className="gold-loading history-loading">Loading history...</div>
              ) : historyError ? (
                <div className="form-error">{historyError}</div>
              ) : historyContext?.history?.length ? (
                <div className="history-list">
                  {historyContext.history.map((item) => (
                    <div key={item.id} className="history-card">
                      <div className="history-card__header">
                        <div className="history-card__title">
                          Submission #{item.id}
                        </div>
                        <span
                          className={`status-badge ${getStatusClassName(item.status)}`}
                        >
                          {getStatusLabel(item.status)}
                        </span>
                      </div>

                      <div className="history-grid">
                        <div>
                          <span className="history-label">Submitted</span>
                          <div>{formatDateTime(item.submittedAt)}</div>
                        </div>

                        <div>
                          <span className="history-label">Submitted By</span>
                          <div>{item.studentId ?? "—"}</div>
                        </div>

                        <div>
                          <span className="history-label">Points</span>
                          <div>{item.points ?? "—"}</div>
                        </div>

                        <div>
                          <span className="history-label">Graded By</span>
                          <div>{item.adminGraderName || item.adminGraderId || "—"}</div>
                        </div>

                        <div className="history-grid__full">
                          <span className="history-label">Project Link</span>
                          <div>
                            {item.link ? (
                              <a
                                className="button button-view-code history-link-button"
                                href={item.link}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <FaExternalLinkAlt />
                                Open Submission
                              </a>
                            ) : (
                              "—"
                            )}
                          </div>
                        </div>

                        <div className="history-grid__full">
                          <span className="history-label">Feedback</span>
                          <div className="history-feedback">
                            {item.feedback?.trim() ? item.feedback : "—"}
                          </div>
                        </div>

                        {item.regradeRequested && (
                          <div className="history-grid__full">
                            <span className="history-label">Regrade Requested</span>
                            <div>
                              Requested by student {item.regradeRequestedByStudentId ?? "—"}{" "}
                              on {formatDateTime(item.regradeRequestedAt)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="gold-loading history-loading">
                  No history available.
                </div>
              )}

              <div className="modal-actions">
                <button
                  className="button secondary"
                  onClick={closeHistoryModal}
                  disabled={historyLoading}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminGoldSubmissions;