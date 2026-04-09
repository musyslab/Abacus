import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { useNavigate, useParams } from "react-router-dom";

import MenuComponent from "../components/MenuComponent";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";
import "../../styling/StudentGoldSubmissions.scss";

type GoldProblemType = "normal" | "creative";

type GoldProjectSummary = {
  Id: number;
  Name: string;
  Division?: string;
  GoldProblemType?: GoldProblemType;
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
  docLink?: string | null;
  points: number | null;
  feedback: string | null;
  submittedAt: string | null;
  hasSubmission: boolean;
  status: SubmissionStatus;
  regradeRequested: boolean;
  regradeRequestedAt: string | null;
  regradeRequestedByStudentId: number | null;
  cooldownSecondsRemaining?: number;
  nextAllowedSubmissionAt?: string | null;
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
  const [goldProblemType, setGoldProblemType] =
    useState<GoldProblemType>("normal");
  const [link, setLink] = useState("");
  const [docLink, setDocLink] = useState("");
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
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState(0);
  const [nextAllowedSubmissionAt, setNextAllowedSubmissionAt] = useState<
    string | null
  >(null);

  function authConfig() {
    const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  const isValidScratchLink = (url: string) => {
    return url.includes("scratch.mit.edu/projects/");
  };

  const isValidOnlineDocLink = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return false;

    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const extractScratchProjectId = (url: string) => {
    const match = url.match(/projects\/(\d+)/);
    return match ? match[1] : null;
  };

  const scratchProjectId = extractScratchProjectId(link);
  const isCreativeProblem = goldProblemType === "creative";
  const isError = message.includes("❌");

  const applyCooldownState = (
    secondsRemaining?: number,
    nextAllowedAt?: string | null
  ) => {
    const normalizedSeconds =
      typeof secondsRemaining === "number" && Number.isFinite(secondsRemaining)
        ? Math.max(0, Math.ceil(secondsRemaining))
        : 0;

    setCooldownRemainingSeconds(normalizedSeconds);
    setNextAllowedSubmissionAt(nextAllowedAt ?? null);
  };

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
      setGoldProblemType(
        match?.GoldProblemType === "creative" ? "creative" : "normal"
      );
    } catch {
      setProjectName("");
      setGoldProblemType("normal");
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
        setDocLink(res.data.docLink || "");
        setRegradeRequested(Boolean(res.data.regradeRequested));
        setRegradeRequestedAt(res.data.regradeRequestedAt ?? null);
        applyCooldownState(
          res.data.cooldownSecondsRemaining,
          res.data.nextAllowedSubmissionAt ?? null
        );
      } else {
        setSubmissionId(null);
        setHasSubmission(false);
        setStatus("not_submitted");
        setSubmittedAt(null);
        setPoints(null);
        setFeedback(null);
        setLink("");
        setDocLink("");
        setRegradeRequested(false);
        setRegradeRequestedAt(null);
        applyCooldownState(0, null);
      }
    } catch {
      setSubmissionId(null);
      setHasSubmission(false);
      setStatus("not_submitted");
      setSubmittedAt(null);
      setPoints(null);
      setFeedback(null);
      setLink("");
      setDocLink("");
      setRegradeRequested(false);
      setRegradeRequestedAt(null);
      applyCooldownState(0, null);
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

  useEffect(() => {
    if (cooldownRemainingSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCooldownRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [cooldownRemainingSeconds]);

  const handleSubmit = async () => {
    if (!projectId) {
      setMessage("❌ Missing or invalid Gold Division project ID.");
      return;
    }

    if (!link.trim()) {
      setMessage("❌ Please enter a Scratch link.");
      return;
    }

    if (!isValidScratchLink(link)) {
      setMessage("❌ Please enter a valid Scratch project link.");
      return;
    }

    if (isCreativeProblem && !docLink.trim()) {
      setMessage(
        "❌ Creative problems require both a Scratch project link and a document link."
      );
      return;
    }

    if (isCreativeProblem && !isValidOnlineDocLink(docLink)) {
      setMessage("❌ Please enter a valid online document link.");
      return;
    }

    if (cooldownRemainingSeconds > 0) {
      setMessage(
        `❌ Please wait ${formatCooldown(
          cooldownRemainingSeconds
        )} before submitting again.`
      );
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      await axios.post(
        `${API}/gold-division/create`,
        {
          project_id: projectId,
          scratch_link: link.trim(),
          description_link: isCreativeProblem ? docLink.trim() : "",
        },
        authConfig()
      );

      setMessage("✅ Team submission saved successfully!");
      await fetchMySubmission(projectId);
    } catch (err: any) {
      const responseData = err?.response?.data;

      if (err?.response?.status === 429) {
        applyCooldownState(
          responseData?.cooldownSecondsRemaining,
          responseData?.nextAllowedSubmissionAt ?? null
        );
      }

      const msg = responseData?.message || "Submission failed. Try again.";
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
        return "sgs-status-banner--success";
      case "needs_grading":
        return "sgs-status-banner--info";
      case "regrade_requested":
        return "sgs-status-banner--warning";
      case "not_submitted":
      default:
        return "sgs-status-banner--neutral";
    }
  }, [status]);

  const formatDateTime = (timestampStr: string | null) => {
    if (!timestampStr) return "—";
    const date = new Date(timestampStr);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  };

  const formatCooldown = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;

    if (minutes > 0) {
      return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
    }

    return `${remainingSeconds}s`;
  };

  const canRequestRegrade =
    hasSubmission &&
    !regradeRequested &&
    status === "graded" &&
    (points !== null || Boolean(feedback));

  const submitButtonDisabled =
    loading ||
    pageLoading ||
    regradeLoading ||
    !link.trim() ||
    (isCreativeProblem && !docLink.trim()) ||
    cooldownRemainingSeconds > 0;

  return (
    <>
      <Helmet>
        <title>Abacus</title>
      </Helmet>

      <MenuComponent />

      <div className="student-gold-root">
        <DirectoryBreadcrumbs
          items={[
            { label: "Student Gold Problem Select", to: "/student/gold/problems" },
            { label: "Gold Division Problems" },
          ]}
          trailingSeparator={false}
        />

        <div className="pageTitle">{headerTitle}</div>

        <div className="student-gold-content">
          {!projectId ? (
            <div className="sgs-callout sgs-callout--error">
              Missing or invalid Gold Division project ID.
            </div>
          ) : (
            <>
              {!pageLoading && (
                <div className={`sgs-status-banner ${statusToneClass}`}>
                  <div className="sgs-status-banner__main">
                    <div className="sgs-status-banner__header">
                      <div className="sgs-status-banner__title-wrap">
                        <div className="sgs-status-banner__eyebrow">
                          Team overview
                        </div>
                        <div className="sgs-status-banner__title">
                          Team Submission Status
                        </div>
                      </div>

                      <span
                        className={`sgs-status-pill sgs-status-pill--${status}`}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    <div className="sgs-status-banner__meta">
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
                          <strong>Points:</strong> {points}
                        </div>
                      ) : null}
                      {regradeRequested && regradeRequestedAt ? (
                        <div>
                          <strong>Regrade requested:</strong>{" "}
                          {formatDateTime(regradeRequestedAt)}
                        </div>
                      ) : null}
                      {cooldownRemainingSeconds > 0 ? (
                        <div>
                          <strong>Your submit cooldown:</strong>{" "}
                          {formatCooldown(cooldownRemainingSeconds)}
                        </div>
                      ) : null}
                      {cooldownRemainingSeconds > 0 && nextAllowedSubmissionAt ? (
                        <div>
                          <strong>You can submit again at:</strong>{" "}
                          {formatDateTime(nextAllowedSubmissionAt)}
                        </div>
                      ) : null}
                      {link ? (
                        <div>
                          <strong>Scratch Link:</strong>{" "}
                          <a
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="sgs-status-link"
                          >
                            <span>Open project</span>
                          </a>
                        </div>
                      ) : null}
                      {isCreativeProblem && docLink ? (
                        <div>
                          <strong>Description Doc:</strong>{" "}
                          <a
                            href={docLink}
                            target="_blank"
                            rel="noreferrer"
                            className="sgs-status-link"
                          >
                            <span>Open document</span>
                          </a>
                        </div>
                      ) : null}
                    </div>

                    {feedback ? (
                      <div className="sgs-status-banner__feedback">
                        <div className="sgs-status-banner__feedback-label">
                          Feedback
                        </div>
                        <div className="sgs-status-banner__feedback-body">
                          {feedback}
                        </div>
                      </div>
                    ) : status === "needs_grading" ? (
                      <div className="sgs-status-banner__feedback sgs-status-banner__feedback--muted">
                        Your team has submitted a project. It is waiting for an
                        admin to grade it.
                      </div>
                    ) : status === "regrade_requested" ? (
                      <div className="sgs-status-banner__feedback sgs-status-banner__feedback--muted">
                        Your regrade request has been sent. An admin will review
                        the submission again.
                      </div>
                    ) : status === "not_submitted" ? (
                      <div className="sgs-status-banner__feedback sgs-status-banner__feedback--muted">
                        Your team has not submitted a Scratch project for this
                        problem yet.
                      </div>
                    ) : null}
                  </div>

                  <div className="sgs-status-banner__actions">
                    <button
                      type="button"
                      className="sgs-button sgs-button--secondary sgs-status-banner__button"
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

              <div className="sgs-callout sgs-callout--info">
                Submit your Scratch project link for this Gold Division problem.
                Gold Division submissions are shared across your whole team, so
                all teammates will see the same submission, score, feedback,
                status, and regrade request state. A live preview will appear
                automatically when a valid Scratch project link is entered.
                {isCreativeProblem
                  ? " For Creative problems, you must also include a link to an online document that explains the project for admins."
                  : ""}
              </div>

              {cooldownRemainingSeconds > 0 && (
                <div className="sgs-callout sgs-callout--warning">
                  You recently submitted a project. Please wait{" "}
                  <strong>{formatCooldown(cooldownRemainingSeconds)}</strong>{" "}
                  before submitting again.
                </div>
              )}

              <div className="sgs-panel">
                <div className="sgs-panel__header">
                  <div>
                    <div className="sgs-panel__title">
                      Scratch Project Submission
                    </div>
                    <div className="sgs-panel__subtitle">
                      Save your team’s latest Scratch project link below.
                    </div>
                  </div>
                </div>

                <div className="sgs-form">
                  <div className="sgs-field">
                    <label
                      className="sgs-field__label"
                      htmlFor="gold-scratch-link"
                    >
                      Scratch Project Link
                    </label>
                    <input
                      id="gold-scratch-link"
                      type="text"
                      placeholder="https://scratch.mit.edu/projects/..."
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      className="sgs-field__input sgs-input"
                      disabled={pageLoading}
                    />
                    <div className="sgs-field__help">
                      Use a Scratch project URL in the format shown above. Saving
                      this link updates the shared team submission for this
                      problem. If your submission had already been graded,
                      submitting a new link will reset the status back to
                      awaiting grading. Each student account must wait one
                      minute between submissions for the same Gold problem.
                    </div>
                  </div>

                  {isCreativeProblem && (
                    <div className="sgs-field">
                      <label
                        className="sgs-field__label"
                        htmlFor="gold-description-doc-link"
                      >
                        Description Document Link
                      </label>
                      <input
                        id="gold-description-doc-link"
                        type="text"
                        placeholder="https://docs.google.com/..."
                        value={docLink}
                        onChange={(e) => setDocLink(e.target.value)}
                        className="sgs-field__input sgs-input"
                        disabled={pageLoading}
                      />
                      <div className="sgs-field__help">
                        Add a required online document that helps admins
                        understand the creative project and its design choices.
                      </div>
                    </div>
                  )}

                  {scratchProjectId && (
                    <div className="sgs-preview-container">
                      <div className="sgs-preview-label">Live Preview</div>
                      <iframe
                        src={`https://scratch.mit.edu/projects/${scratchProjectId}/embed`}
                        allowTransparency={true}
                        frameBorder="0"
                        scrolling="no"
                        allowFullScreen
                        title="Scratch Preview"
                        className="sgs-preview-frame"
                      />
                    </div>
                  )}

                  <div className="sgs-actions">
                    <button
                      onClick={() => navigate("/student/gold/problems")}
                      className="sgs-button sgs-button--secondary"
                      type="button"
                      disabled={loading || pageLoading || regradeLoading}
                    >
                      Back to Problems
                    </button>

                    <button
                      onClick={handleSubmit}
                      className="sgs-button sgs-button--primary"
                      disabled={submitButtonDisabled}
                      type="button"
                    >
                      {loading
                        ? "Submitting..."
                        : cooldownRemainingSeconds > 0
                          ? `Submit Again In ${formatCooldown(
                              cooldownRemainingSeconds
                            )}`
                          : "Submit Project"}
                    </button>
                  </div>

                  {message && (
                    <div
                      className={`sgs-message ${
                        isError
                          ? "sgs-message--error"
                          : "sgs-message--success"
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