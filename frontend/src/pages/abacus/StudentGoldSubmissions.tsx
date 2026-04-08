import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { useNavigate, useParams } from "react-router-dom";

import MenuComponent from "../components/MenuComponent";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";
import "../../styling/StudentGoldSubmissions.scss";

type GoldProjectSummary = {
  Id: number;
  Name: string;
  Division?: string;
};

type SubmissionStatus =
  | "graded"
  | "needs_grading"
  | "not_submitted"
  | "regrade_requested";

type MyGoldSubmissionResponse = {
  id: number;
  projectId: number | null;
  link: string;
  points: number | null;
  feedback: string | null;
  submittedAt: string | null;
  hasSubmission: boolean;
  status: SubmissionStatus;
  regradeRequested: boolean;
  regradeRequestedAt: string | null;
  regradeRequestedByStudentId: number | null;
};

const StudentGoldSubmissions = () => {
  const API = (import.meta.env.VITE_API_URL as string) || "";
  const navigate = useNavigate();
  const { projectId: projectIdParam } = useParams();

  const parsedProjectId = Number(projectIdParam);
  const projectId =
    Number.isFinite(parsedProjectId) && parsedProjectId > 0
      ? parsedProjectId
      : null;

  const [projectName, setProjectName] = useState<string>("");
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [regradeLoading, setRegradeLoading] = useState(false);

  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [hasSubmission, setHasSubmission] = useState(false);
  const [status, setStatus] = useState<SubmissionStatus>("not_submitted");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [regradeRequested, setRegradeRequested] = useState(false);
  const [regradeRequestedAt, setRegradeRequestedAt] = useState<string | null>(
    null
  );

  function authConfig() {
    const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  const isValidScratchLink = (url: string) => {
    return url.includes("scratch.mit.edu/projects/");
  };

  const extractScratchProjectId = (url: string) => {
    const match = url.match(/projects\/(\d+)/);
    return match ? match[1] : null;
  };

  const scratchProjectId = extractScratchProjectId(link);
  const isError = message.includes("❌");

  const fetchProjectMetadata = async (targetProjectId: number) => {
    try {
      const res = await axios.get<GoldProjectSummary[]>(
        `${API}/projects/all_projects`,
        {
          ...authConfig(),
          params: { division: "gold" },
        }
      );

      const projects = Array.isArray(res.data) ? res.data : [];
      const match = projects.find(
        (project) => Number(project.Id) === targetProjectId
      );
      setProjectName(match?.Name || "");
    } catch {
      setProjectName("");
    }
  };

  const fetchMySubmission = async (targetProjectId: number) => {
    try {
      const res = await axios.get<MyGoldSubmissionResponse | null>(
        `${API}/gold-division/my`,
        {
          ...authConfig(),
          params: { project_id: targetProjectId },
        }
      );

      if (res.data) {
        setSubmissionId(typeof res.data.id === "number" ? res.data.id : null);
        setHasSubmission(Boolean(res.data.hasSubmission));
        setStatus(res.data.status ?? "not_submitted");
        setSubmittedAt(res.data.submittedAt ?? null);
        setPoints(typeof res.data.points === "number" ? res.data.points : null);
        setFeedback(res.data.feedback ?? null);
        setLink(res.data.link || "");
        setRegradeRequested(Boolean(res.data.regradeRequested));
        setRegradeRequestedAt(res.data.regradeRequestedAt ?? null);
      } else {
        setSubmissionId(null);
        setHasSubmission(false);
        setStatus("not_submitted");
        setSubmittedAt(null);
        setPoints(null);
        setFeedback(null);
        setLink("");
        setRegradeRequested(false);
        setRegradeRequestedAt(null);
      }
    } catch {
      setSubmissionId(null);
      setHasSubmission(false);
      setStatus("not_submitted");
      setSubmittedAt(null);
      setPoints(null);
      setFeedback(null);
      setLink("");
      setRegradeRequested(false);
      setRegradeRequestedAt(null);
    }
  };

  useEffect(() => {
    if (!projectId) {
      setMessage("❌ Missing or invalid Gold Division project ID.");
      return;
    }

    let isMounted = true;

    const loadPage = async () => {
      try {
        setPageLoading(true);
        setMessage("");

        await Promise.all([
          fetchProjectMetadata(projectId),
          fetchMySubmission(projectId),
        ]);
      } finally {
        if (isMounted) {
          setPageLoading(false);
        }
      }
    };

    loadPage();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const handleSubmit = async () => {
    if (!projectId) {
      setMessage("❌ Missing or invalid Gold Division project ID.");
      return;
    }

    if (!link) {
      setMessage("❌ Please enter a Scratch link.");
      return;
    }

    if (!isValidScratchLink(link)) {
      setMessage("❌ Please enter a valid Scratch project link.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      await axios.post(
        `${API}/gold-division/create`,
        {
          project_id: projectId,
          scratch_link: link,
        },
        authConfig()
      );

      setMessage("✅ Team submission saved successfully!");
      await fetchMySubmission(projectId);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || "Submission failed. Try again.";
      setMessage(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRegrade = async () => {
    if (!projectId || !hasSubmission) {
      setMessage("❌ Your team needs a submission before requesting a regrade.");
      return;
    }

    try {
      setRegradeLoading(true);
      setMessage("");

      await axios.post(
        `${API}/gold-division/request-regrade`,
        { project_id: projectId },
        authConfig()
      );

      setMessage("✅ Regrade request sent to the admins.");
      await fetchMySubmission(projectId);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        "Unable to send the regrade request right now.";
      setMessage(`❌ ${msg}`);
    } finally {
      setRegradeLoading(false);
    }
  };

  const headerTitle = useMemo(() => {
    if (projectName) return `Gold Division Submission: ${projectName}`;
    if (projectId) return `Gold Division Submission: Problem ${projectId}`;
    return "Gold Division Submission";
  }, [projectName, projectId]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case "graded":
        return "Graded";
      case "needs_grading":
        return "Awaiting grading";
      case "regrade_requested":
        return "Regrade requested";
      case "not_submitted":
      default:
        return "Not submitted";
    }
  }, [status]);

  const statusToneClass = useMemo(() => {
    switch (status) {
      case "graded":
        return "status-banner--success";
      case "needs_grading":
        return "status-banner--info";
      case "regrade_requested":
        return "status-banner--warning";
      case "not_submitted":
      default:
        return "status-banner--neutral";
    }
  }, [status]);

  const formatDateTime = (timestampStr: string | null) => {
    if (!timestampStr) return "—";
    const date = new Date(timestampStr);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  };

  const canRequestRegrade =
    hasSubmission &&
    !regradeRequested &&
    status === "graded" &&
    (points !== null || Boolean(feedback));

  return (
    <>
      <Helmet>
        <title>Abacus</title>
      </Helmet>

      <MenuComponent />

      <div className="student-gold-root">
        <DirectoryBreadcrumbs
          items={[
            { label: "Gold Problems", to: "/student/gold/problems" },
            { label: "Gold Division Submission" },
          ]}
          trailingSeparator={false}
        />

        <div className="pageTitle">{headerTitle}</div>

        <div className="student-gold-content">
          {!projectId ? (
            <div className="callout callout--error">
              Missing or invalid Gold Division project ID.
            </div>
          ) : (
            <>
              {!pageLoading && (
                <div className={`status-banner ${statusToneClass}`}>
                  <div className="status-banner__main">
                    <div className="status-banner__header">
                      <div className="status-banner__title">
                        Team submission status
                      </div>
                      <span className={`status-pill status-pill--${status}`}>
                        {statusLabel}
                      </span>
                    </div>

                    <div className="status-banner__meta">
                      <div>
                        <strong>Submitted:</strong> {formatDateTime(submittedAt)}
                      </div>
                      {submissionId ? (
                        <div>
                          <strong>Submission ID:</strong> {submissionId}
                        </div>
                      ) : null}
                      {points !== null ? (
                        <div>
                          <strong>Grade:</strong> {points}
                        </div>
                      ) : null}
                      {regradeRequested && regradeRequestedAt ? (
                        <div>
                          <strong>Regrade requested:</strong>{" "}
                          {formatDateTime(regradeRequestedAt)}
                        </div>
                      ) : null}
                    </div>

                    {feedback ? (
                      <div className="status-banner__feedback">
                        <div className="status-banner__feedback-label">
                          Feedback
                        </div>
                        <div className="status-banner__feedback-body">
                          {feedback}
                        </div>
                      </div>
                    ) : status === "needs_grading" ? (
                      <div className="status-banner__feedback muted">
                        Your team has submitted a project. It is waiting for an
                        admin to grade it.
                      </div>
                    ) : status === "regrade_requested" ? (
                      <div className="status-banner__feedback muted">
                        Your regrade request has been sent. An admin will review
                        the submission again.
                      </div>
                    ) : status === "not_submitted" ? (
                      <div className="status-banner__feedback muted">
                        Your team has not submitted a Scratch project for this
                        problem yet.
                      </div>
                    ) : null}
                  </div>

                  <div className="status-banner__actions">
                    <button
                      type="button"
                      className="gold-button gold-button--secondary status-banner__button"
                      onClick={handleRequestRegrade}
                      disabled={!canRequestRegrade || regradeLoading}
                    >
                      {regradeRequested
                        ? "Regrade Requested"
                        : regradeLoading
                          ? "Requesting..."
                          : "Request Regrade"}
                    </button>
                  </div>
                </div>
              )}

              <div className="callout callout--info">
                Submit your Scratch project link for this Gold Division problem.
                Gold Division submissions are shared across your whole team, so
                all teammates will see the same submission, score, feedback,
                status, and regrade request state. A live preview will appear
                automatically when a valid Scratch project link is entered.
              </div>

              <div className="gold-panel">
                <div className="gold-panel__header">
                  <div>
                    <div className="gold-panel__title">
                      Scratch Project Submission
                    </div>
                    <div className="gold-panel__subtitle">
                      {projectName
                        ? `Submitting for: ${projectName}`
                        : `Submitting for Gold problem #${projectId}`}
                    </div>
                  </div>
                </div>

                <div className="gold-form">
                  <div className="field">
                    <label className="field__label" htmlFor="gold-scratch-link">
                      Scratch project link
                    </label>
                    <input
                      id="gold-scratch-link"
                      type="text"
                      placeholder="https://scratch.mit.edu/projects/..."
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      className="field__input gold-input"
                      disabled={pageLoading}
                    />
                    <div className="field__help">
                      Use a Scratch project URL in the format shown above. Saving
                      this link updates the shared team submission for this
                      problem. If your team had already been graded, submitting a
                      new link will reset the status back to awaiting grading.
                    </div>
                  </div>

                  {scratchProjectId && (
                    <div className="preview-container">
                      <div className="preview-label">Live Preview</div>
                      <iframe
                        src={`https://scratch.mit.edu/projects/${scratchProjectId}/embed`}
                        allowTransparency={true}
                        frameBorder="0"
                        scrolling="no"
                        allowFullScreen
                        title="Scratch Preview"
                        className="preview-frame"
                      />
                    </div>
                  )}

                  <div className="gold-actions">
                    <button
                      onClick={() => navigate("/student/gold/problems")}
                      className="gold-button gold-button--secondary"
                      type="button"
                      disabled={loading || pageLoading || regradeLoading}
                    >
                      Back to Problems
                    </button>

                    <button
                      onClick={handleSubmit}
                      className="btn btn--primary gold-button"
                      disabled={loading || pageLoading || regradeLoading || !link}
                      type="button"
                    >
                      {loading ? "Submitting..." : "Submit Project"}
                    </button>
                  </div>

                  {message && (
                    <div
                      className={`gold-message ${
                        isError
                          ? "gold-message--error"
                          : "gold-message--success"
                      }`}
                    >
                      {message}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default StudentGoldSubmissions;