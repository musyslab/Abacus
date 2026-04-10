import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { useLocation, useParams } from "react-router-dom";
import { FaExternalLinkAlt, FaHistory, FaPen, FaTimes } from "react-icons/fa";

import MenuComponent from "../components/MenuComponent";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";

import "../../styling/AdminGoldSubmissions.scss";

type SubmissionStatus =
  | "graded"
  | "needs_grading"
  | "not_submitted"
  | "regrade_requested";

type GoldProblemType = "normal" | "creative";

type Submission = {
  id: number | null;
  link: string | null;
  docLink: string | null;
  studentId: number | null;
  projectId: number | null;
  projectName: string | null;
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

type SubmissionHistoryEventType = "submission" | "regrade_request";

type SubmissionHistoryItem = {
  eventId: string;
  eventType: SubmissionHistoryEventType;
  eventTimestamp: string | null;
  id: number;
  submissionNumber: number | null;
  link: string | null;
  docLink: string | null;
  studentId: number | null;
  projectId: number | null;
  projectName: string | null;
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

type TeamContext = {
  teamId: number | null;
  teamName: string | null;
  teamNumber: number | null;
  schoolName: string | null;
};

type VisibleSubmissionsResponse = {
  currentAdminId: number | null;
  canGrade: boolean;
  isTeacherView: boolean;
  projectId: number | null;
  projectName: string | null;
  teamId: number | null;
  teamName: string | null;
  teamNumber: number | null;
  schoolName: string | null;
  submissions: Submission[];
};

type ProjectMetaResponse = {
  name?: string | null;
  type?: string | null;
  division?: string | null;
  goldProblemType?: GoldProblemType | null;
};

const getMaxPointsForGoldProblemType = (problemType: GoldProblemType) =>
  problemType === "creative" ? 15 : 7;

const getGoldProblemTypeLabel = (problemType: GoldProblemType) =>
  problemType === "creative" ? "Creative" : "Normal";

const AdminGoldSubmissions = () => {
  const API = (import.meta.env.VITE_API_URL as string) || "";
  const { projectId } = useParams<{ projectId?: string }>();
  const location = useLocation();

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const parsedProjectId =
    projectId && !Number.isNaN(Number(projectId)) ? Number(projectId) : null;

  const teamIdParam = searchParams.get("team_id");
  const parsedTeamId =
    teamIdParam && !Number.isNaN(Number(teamIdParam)) ? Number(teamIdParam) : null;

  const schoolIdParam = searchParams.get("school_id");
  const parsedSchoolId =
    schoolIdParam && !Number.isNaN(Number(schoolIdParam))
      ? Number(schoolIdParam)
      : null;

  const fromTeamManage = searchParams.get("from") === "team-manage";
  const isTeamSpecificView = parsedTeamId !== null && parsedTeamId > 0;

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentAdminId, setCurrentAdminId] = useState<number | null>(null);
  const [canGrade, setCanGrade] = useState(false);
  const [isTeacherView, setIsTeacherView] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [teamContext, setTeamContext] = useState<TeamContext>({
    teamId: null,
    teamName: null,
    teamNumber: null,
    schoolName: null,
  });

  const [pointsInput, setPointsInput] = useState<string>("");
  const [feedbackInput, setFeedbackInput] = useState<string>("");

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>("");

  const [modalOpen, setModalOpen] = useState(false);
  const [activeSubmission, setActiveSubmission] =
    useState<Submission | null>(null);

  const [activeGoldProblemType, setActiveGoldProblemType] =
    useState<GoldProblemType>("normal");
  const [activeMaxPoints, setActiveMaxPoints] = useState<number>(7);
  const [projectMetaLoading, setProjectMetaLoading] = useState(false);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyContext, setHistoryContext] =
    useState<SubmissionHistoryResponse | null>(null);

  function authConfig() {
    const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  const loadProjectMeta = async (pid: number | null) => {
    if (!pid) {
      setActiveGoldProblemType("normal");
      setActiveMaxPoints(7);
      return;
    }

    try {
      setProjectMetaLoading(true);
      const res = await axios.get<ProjectMetaResponse>(
        `${API}/projects/get_project_id?id=${pid}`,
        authConfig()
      );

      const rawType = res.data?.goldProblemType;
      const normalizedType: GoldProblemType =
        rawType === "creative" ? "creative" : "normal";

      setActiveGoldProblemType(normalizedType);
      setActiveMaxPoints(getMaxPointsForGoldProblemType(normalizedType));
    } catch (err) {
      console.error("Failed to load gold problem metadata", err);
      setActiveGoldProblemType("normal");
      setActiveMaxPoints(7);
    } finally {
      setProjectMetaLoading(false);
    }
  };

  const fetchSubmissions = async (showLoader = false) => {
    if (showLoader) setLoading(true);

    try {
      const params = new URLSearchParams();

      if (parsedProjectId) {
        params.set("project_id", String(parsedProjectId));
      }

      if (isTeamSpecificView && parsedTeamId) {
        params.set("team_id", String(parsedTeamId));
      }

      const url = `${API}/gold-division/visible${params.toString() ? `?${params.toString()}` : ""
        }`;

      const res = await axios.get<VisibleSubmissionsResponse>(url, authConfig());
      const data = res.data;

      setSubmissions(Array.isArray(data?.submissions) ? data.submissions : []);
      setCurrentAdminId(data?.currentAdminId ?? null);
      setCanGrade(Boolean(data?.canGrade));
      setIsTeacherView(Boolean(data?.isTeacherView));
      setProjectName(data?.projectName ?? null);
      setTeamContext({
        teamId: data?.teamId ?? parsedTeamId ?? null,
        teamName: data?.teamName ?? null,
        teamNumber: data?.teamNumber ?? null,
        schoolName: data?.schoolName ?? null,
      });

      const singleProjectId = data?.projectId ?? parsedProjectId ?? null;
      if (singleProjectId) {
        loadProjectMeta(singleProjectId);
      }
    } catch (err) {
      console.error("Failed to fetch submissions", err);
      setSubmissions([]);
      setTeamContext({
        teamId: parsedTeamId ?? null,
        teamName: null,
        teamNumber: null,
        schoolName: null,
      });
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions(true);
    const interval = setInterval(() => fetchSubmissions(false), 30000);
    return () => clearInterval(interval);
  }, [API, parsedProjectId, parsedTeamId, isTeamSpecificView]);

  const openModal = async (submission: Submission) => {
    if (!canGrade || !submission.hasSubmission || !submission.id) return;

    setActiveSubmission(submission);
    setPointsInput(submission.points?.toString() ?? "");
    setFeedbackInput(submission.feedback ?? "");
    setSaveError("");
    setSaved(false);
    setModalOpen(true);

    await loadProjectMeta(submission.projectId ?? parsedProjectId ?? null);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setActiveSubmission(null);
    setSaved(false);
    setSaveError("");
    setSaving(false);
    setProjectMetaLoading(false);
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

    if (pointsValue < 0) {
      setSaveError("Points cannot be negative.");
      return;
    }

    if (pointsValue > activeMaxPoints) {
      setSaveError(
        `${getGoldProblemTypeLabel(activeGoldProblemType)} problems can have at most ${activeMaxPoints} points.`
      );
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

  const getHistoryItemTitle = (item: SubmissionHistoryItem) => {
    if (item.eventType === "regrade_request") {
      return `Regrade Request${item.submissionNumber ? ` • Submission #${item.submissionNumber}` : ""
        }`;
    }

    return `Submission #${item.submissionNumber ?? item.id}`;
  };

  const reviewedProblemLabel = projectName
    ? `: ${projectName}`
    : parsedProjectId
      ? `: Problem ${parsedProjectId}`
      : "";

  const pageTitle = isTeamSpecificView
    ? `Team Submissions${teamContext.teamName ? `: ${teamContext.teamName}` : ""}`
    : isTeacherView
      ? `Gold Division Projects${reviewedProblemLabel}`
      : `Gold Submissions${reviewedProblemLabel}`;

  const tableTitle = "Gold Division Team Submissions";

  const breadcrumbs = isTeamSpecificView
    ? isTeacherView
      ? [
        { label: "Team Manage", to: "/teacher/team-manage" },
        { label: "Team Submissions" },
      ]
      : [
        { label: "Admin Menu", to: "/admin" },
        { label: "School List", to: "/admin/schools" },
        ...(fromTeamManage && parsedSchoolId
          ? [
            {
              label: "Team Manage",
              to: `/admin/${parsedSchoolId}/team-manage`,
            },
          ]
          : []),
        { label: "Team Submissions" },
      ]
    : isTeacherView
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
                <strong>Total rows:</strong> {summary.total}
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
            <table className="gold-submissions-table">
              <thead className="table-head">
                <tr className="head-row">
                  <th>Team</th>
                  <th>School</th>
                  <th>Submitted By</th>
                  <th>Project</th>
                  <th>Submission</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  {canGrade && <th>Points</th>}
                  {!isTeacherView && <th>Actions</th>}
                </tr>
              </thead>

              <tbody className="table-body">
                {submissions.length === 0 ? (
                  <tr className="data-row">
                    <td
                      colSpan={canGrade && !isTeacherView ? 9 : canGrade ? 8 : 7}
                      className="muted-text"
                    >
                      No gold submissions found.
                    </td>
                  </tr>
                ) : (
                  submissions.map((s, index) => (
                    <tr
                      key={`${s.teamId ?? "team"}-${s.projectId ?? "project"}-${s.id ?? "none"}-${index}`}
                      className={`data-row status-${s.status} ${s.status === "regrade_requested" ? "status-needs_grading" : ""
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

                      <td>{s.projectName || projectName || "—"}</td>

                      <td>
                        {s.hasSubmission ? (
                          <div className="submission-links">
                            {s.link ? (
                              <a
                                className="button button-view-code"
                                href={s.link}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <FaExternalLinkAlt />
                                View Scratch
                              </a>
                            ) : null}

                            {s.docLink ? (
                              <a
                                className="button button-view-code"
                                href={s.docLink}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <FaExternalLinkAlt />
                                View Doc
                              </a>
                            ) : null}

                            {!s.link && !s.docLink ? (
                              <span className="muted-text">No submission link</span>
                            ) : null}
                          </div>
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
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {canGrade && modalOpen && activeSubmission && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">
                    Grade Submission
                    {activeSubmission.teamName ? ` — ${activeSubmission.teamName}` : ""}
                  </h2>

                  <div className="modal-subtitle">
                    {activeSubmission.projectName || projectName || "Gold Division Project"}
                    {activeSubmission.schoolName ? ` • ${activeSubmission.schoolName}` : ""}
                    {activeSubmission.regradeRequested ? " • Regrade requested" : ""}
                  </div>

                  {(activeSubmission.link || activeSubmission.docLink) && (
                    <div className="modal-link-row">
                      {activeSubmission.link ? (
                        <a
                          className="button button-view-code"
                          href={activeSubmission.link}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FaExternalLinkAlt />
                          Open Scratch
                        </a>
                      ) : null}

                      {activeSubmission.docLink ? (
                        <a
                          className="button button-view-code"
                          href={activeSubmission.docLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FaExternalLinkAlt />
                          Open Doc
                        </a>
                      ) : null}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="modal-close-button"
                  onClick={closeModal}
                  disabled={saving}
                  aria-label="Close grade modal"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="form-group">
                <label>Points</label>
                <input
                  type="number"
                  min={0}
                  max={activeMaxPoints}
                  value={pointsInput}
                  onChange={(e) => setPointsInput(e.target.value)}
                  placeholder={`Enter score (0-${activeMaxPoints})`}
                  disabled={saving || projectMetaLoading}
                />
                <div className="muted-text points-cap-text">
                  {getGoldProblemTypeLabel(activeGoldProblemType)} problems are capped at{" "}
                  {activeMaxPoints} points.
                </div>
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
                  disabled={saving || projectMetaLoading}
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
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">
                    Submission History
                    {historyContext?.teamName ? ` — ${historyContext.teamName}` : ""}
                  </h2>

                  <div className="modal-subtitle">
                    {historyContext?.projectName || projectName || "Gold Division Project"}
                    {historyContext?.schoolName ? ` • ${historyContext.schoolName}` : ""}
                  </div>
                </div>

                <button
                  type="button"
                  className="modal-close-button"
                  onClick={closeHistoryModal}
                  disabled={historyLoading}
                  aria-label="Close history modal"
                >
                  <FaTimes />
                </button>
              </div>

              {historyLoading ? (
                <div className="gold-loading history-loading">Loading history...</div>
              ) : historyError ? (
                <div className="form-error">{historyError}</div>
              ) : historyContext?.history?.length ? (
                <div className="history-list">
                  {historyContext.history.map((item) => (
                    <div key={item.eventId} className="history-card">
                      <div className="history-card__header">
                        <div className="history-card__title">
                          {getHistoryItemTitle(item)}
                        </div>
                        <span
                          className={`status-badge ${getStatusClassName(item.status)}`}
                        >
                          {getStatusLabel(item.status)}
                        </span>
                      </div>

                      <div className="history-grid">
                        <div>
                          <span className="history-label">Project</span>
                          <div>{item.projectName || historyContext.projectName || "—"}</div>
                        </div>

                        <div>
                          <span className="history-label">
                            {item.eventType === "regrade_request"
                              ? "Requested"
                              : "Submitted"}
                          </span>
                          <div>{formatDateTime(item.eventTimestamp)}</div>
                        </div>

                        <div>
                          <span className="history-label">
                            {item.eventType === "regrade_request"
                              ? "Requested By"
                              : "Submitted By"}
                          </span>
                          <div>
                            {item.eventType === "regrade_request"
                              ? item.regradeRequestedByStudentId ?? "—"
                              : item.studentId ?? "—"}
                          </div>
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
                                Open Scratch Submission
                              </a>
                            ) : (
                              "—"
                            )}
                          </div>
                        </div>

                        <div className="history-grid__full">
                          <span className="history-label">Description Doc</span>
                          <div>
                            {item.docLink ? (
                              <a
                                className="button button-view-code history-link-button"
                                href={item.docLink}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <FaExternalLinkAlt />
                                Open Description Doc
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

                        {item.eventType === "regrade_request" && (
                          <div className="history-grid__full">
                            <span className="history-label">Regrade Request</span>
                            <div>
                              Requested by student {item.regradeRequestedByStudentId ?? "—"} on{" "}
                              {formatDateTime(item.regradeRequestedAt)}
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