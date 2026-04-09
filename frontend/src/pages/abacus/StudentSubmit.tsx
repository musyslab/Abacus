import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import MenuComponent from "../components/MenuComponent";
import ErrorMessage from "../components/ErrorMessage";
import LoadingAnimation from "../components/LoadingAnimation";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useParams } from "react-router-dom";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";
import {
  buildSummaryMap,
  EMPTY_SUMMARY,
  formatDateTime,
  normalizeSummaryRows,
  ProjectObject,
  TeamProblemSummary,
} from "../components/ProblemSubmissionsDashboard";

import "../../styling/StudentSubmit.scss";
import "../../styling/FileUploadCommon.scss";

import {
  FaAlignJustify,
  FaCheckCircle,
  FaClipboardList,
  FaClock,
  FaCloudUploadAlt,
  FaCode,
  FaDownload,
  FaExchangeAlt,
  FaExternalLinkAlt,
  FaFileAlt,
  FaLayerGroup,
  FaRegFile,
  FaTimesCircle,
} from "react-icons/fa";

type TeamMeResponse = {
  id: number;
  name: string;
  division?: string;
};

type SubmitStatusResponse = {
  canSubmit?: boolean;
  cooldownRemainingSeconds?: number;
};

const StudentSubmit = () => {
  const apiBase = (import.meta.env.VITE_API_URL as string) || "";
  const navigate = useNavigate();
  const { projectId: projectIdParam } = useParams<{ projectId: string }>();

  const projectId =
    projectIdParam !== undefined && /^\d+$/.test(projectIdParam)
      ? parseInt(projectIdParam, 10)
      : -1;

  const [files, setFiles] = useState<File[]>([]);
  const [mainJavaFileName, setMainJavaFileName] = useState<string>("");

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPageLoading, setIsPageLoading] = useState<boolean>(false);

  const [project, setProject] = useState<ProjectObject | null>(null);
  const [summary, setSummary] = useState<TeamProblemSummary>({
    ...EMPTY_SUMMARY,
    projectId,
  });

  const [cooldownRemainingMs, setCooldownRemainingMs] = useState<number>(0);

  const [pageError, setPageError] = useState<string>("");
  const [pageNotice, setPageNotice] = useState<string>("");
  const [teamDivision, setTeamDivision] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isErrorMessageHidden, setIsErrorMessageHidden] = useState<boolean>(true);

  function authConfig() {
    const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  const ALLOWED_EXTS = [".py", ".java"];
  const isJavaFile = (f: File) => f.name.toLowerCase().endsWith(".java");
  const isJavaFileName = (n: string) => /\.java$/i.test(n);

  const isAllowedFileName = (name: string) => {
    const ext = "." + (name.split(".").pop() || "").toLowerCase();
    return ALLOWED_EXTS.includes(ext);
  };

  const JAVA_MAIN_RE = /\bpublic\s+static\s+void\s+main\s*\(/;

  function pickMainJavaFile(allJavaNames: string[], namesWithMain: string[]): string {
    if (namesWithMain.length === 1) return namesWithMain[0];
    const mainDotJava = allJavaNames.find((n) => n.toLowerCase() === "main.java");
    if (mainDotJava) return mainDotJava;
    return namesWithMain[0] || "";
  }

  async function computeMainJavaFromLocal(localFiles: File[]) {
    const javaFiles = localFiles.filter((f) => isJavaFileName(f.name));
    if (javaFiles.length <= 1) {
      setMainJavaFileName("");
      return;
    }

    const withMain: string[] = [];
    for (const f of javaFiles) {
      try {
        const txt = await f.text();
        if (JAVA_MAIN_RE.test(txt)) withMain.push(f.name);
      } catch {
        // ignore read failures
      }
    }

    setMainJavaFileName(pickMainJavaFile(javaFiles.map((f) => f.name), withMain));
  }

  function clearLocalError() {
    setErrorMessage("");
    setIsErrorMessageHidden(true);
  }

  function showLocalError(message: string) {
    setErrorMessage(message);
    setIsErrorMessageHidden(false);
  }

  function capitalize(value: string) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  const totalTestcases = Math.max(0, Number(summary.totalTestcases || 0));
  const passedTestcases = Math.max(
    0,
    Math.min(
      Number(summary.passedTestcases || 0),
      totalTestcases || Number(summary.passedTestcases || 0)
    )
  );
  const submissionCount = Math.max(0, Number(summary.submissionCount || 0));
  const passPct =
    totalTestcases > 0 ? Math.round((passedTestcases / totalTestcases) * 100) : 0;
  const passedAllTests = totalTestcases > 0 && passedTestcases === totalTestcases;

  const formattedCooldown = useMemo(() => {
    const totalSeconds = Math.max(0, Math.ceil(cooldownRemainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [cooldownRemainingMs]);

  useEffect(() => {
    fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, projectId]);

  useEffect(() => {
    if (cooldownRemainingMs <= 0) return;

    const timer = window.setInterval(() => {
      setCooldownRemainingMs((prev) => Math.max(0, prev - 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownRemainingMs]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!(files.length > 1 && files.every(isJavaFile))) {
        if (!cancelled) setMainJavaFileName("");
        return;
      }
      await computeMainJavaFromLocal(files);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  useEffect(() => {
    if (passedAllTests) {
      setFiles([]);
      setMainJavaFileName("");
      clearLocalError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passedAllTests]);

  async function fetchPage() {
    if (projectId <= 0) {
      setProject(null);
      setSummary({ ...EMPTY_SUMMARY, projectId: 0 });
      setPageError("Invalid problem id.");
      setPageNotice("");
      setCooldownRemainingMs(0);
      return;
    }

    setIsPageLoading(true);
    setPageError("");
    setPageNotice("");
    setTeamDivision(null);

    try {
      const [projectsRes, teamRes, statusRes] = await Promise.all([
        axios.get<ProjectObject[]>(`${apiBase}/projects/all_projects`, authConfig()),
        axios.get<TeamMeResponse>(`${apiBase}/teams/me`, authConfig()),
        axios.get<SubmitStatusResponse>(`${apiBase}/submissions/student_submit_status`, {
          ...authConfig(),
          params: { project_id: projectId },
        }),
      ]);

      const allProjects = Array.isArray(projectsRes.data) ? projectsRes.data : [];
      const selectedProject =
        allProjects.find((p) => Number(p.Id) === Number(projectId)) || null;

      if (!selectedProject) {
        setProject(null);
        setSummary({ ...EMPTY_SUMMARY, projectId });
        setPageError("Problem not found.");
        setCooldownRemainingMs(0);
        return;
      }

      setProject(selectedProject);

      const remainingSeconds = Math.max(
        0,
        Number(statusRes.data?.cooldownRemainingSeconds ?? 0)
      );
      setCooldownRemainingMs(remainingSeconds * 1000);

      setTeamDivision(String(teamRes.data?.division ?? "").trim() || null);

      const teamId = Number(teamRes.data?.id ?? 0);
      if (!Number.isFinite(teamId) || teamId <= 0) {
        setSummary({ ...EMPTY_SUMMARY, projectId });
        setPageNotice("Unable to determine the current team.");
        return;
      }

      try {
        const summaryRes = await axios.get(`${apiBase}/teams/submissions/summary`, {
          ...authConfig(),
          params: { team_id: teamId },
        });

        const summaryMap = buildSummaryMap(normalizeSummaryRows(summaryRes.data));
        setSummary(summaryMap[projectId] || { ...EMPTY_SUMMARY, projectId });
      } catch {
        setSummary({ ...EMPTY_SUMMARY, projectId });
        setPageNotice(
          "Problem loaded, but previous submission data is not available yet."
        );
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load the submit page.";
      setProject(null);
      setSummary({ ...EMPTY_SUMMARY, projectId });
      setCooldownRemainingMs(0);
      setPageError(msg);
    } finally {
      setIsPageLoading(false);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (passedAllTests) {
      setFiles([]);
      clearLocalError();
      return;
    }

    const selected = event.target.files ? Array.from(event.target.files) : [];
    const valid = selected.filter((f) => isAllowedFileName(f.name));

    if (selected.length && valid.length === 0) {
      setFiles([]);
      showLocalError("Only .py and .java files are allowed.");
      return;
    }

    if (valid.length > 1 && !valid.every(isJavaFile)) {
      setFiles([]);
      showLocalError("Multi-file upload is only available for Java (.java) files.");
      return;
    }

    clearLocalError();
    setFiles(valid);
  }

  const downloadAssignment = (pid: number) => {
    if (!pid || pid <= 0) return;

    axios
      .get(`${apiBase}/projects/getAssignmentDescription?project_id=${pid}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("AUTOTA_AUTH_TOKEN")}`,
        },
        responseType: "blob",
      })
      .then((res) => {
        const type = (res.headers as any)["content-type"] || "application/octet-stream";
        const blob = new Blob([res.data], { type });
        const name = (res.headers as any)["x-filename"] || "assignment_description";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        showLocalError("Download failed.");
      });
  };

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();

    if (passedAllTests) return;

    if (cooldownRemainingMs > 0) {
      showLocalError(`Please wait ${formattedCooldown} before submitting again.`);
      return;
    }

    if (files.length === 0) {
      showLocalError("Please select a file to upload.");
      return;
    }

    if (files.length > 1 && !files.every(isJavaFile)) {
      showLocalError("Multi-file upload is only available for Java (.java) files.");
      return;
    }

    if (files.some((f) => !isAllowedFileName(f.name))) {
      showLocalError("Only .py and .java files are allowed.");
      return;
    }

    if (!project || project.Id <= 0) {
      showLocalError("No valid problem is selected.");
      return;
    }

    clearLocalError();
    setIsLoading(true);

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f, f.name));
    formData.append("project_id", String(project.Id));

    try {
      const res = await axios.post(`${apiBase}/upload/`, formData, authConfig());
      const sid = res?.data?.sid ?? res?.data?.Sid ?? res?.data?.id;

      if (sid === undefined || sid === null) {
        showLocalError("Upload succeeded, but the submission id was missing.");
        return;
      }

      navigate(`/submission/${sid}`, {
        state: {
          breadcrumbItems: submissionViewBreadcrumbs,
        },
      });
    } catch (err: any) {
      const remainingSeconds = Math.max(
        0,
        Number(err?.response?.data?.remainingSeconds ?? 0)
      );

      if (remainingSeconds > 0) {
        setCooldownRemainingMs(remainingSeconds * 1000);
      }

      showLocalError(err?.response?.data?.message || "Upload failed.");
    } finally {
      setIsLoading(false);
    }
  }

  const CODE_ICON_RE = /\.(py|java)$/i;
  const TEXT_ICON_RE = /\.(txt|md|pdf|doc|docx)$/i;

  const getFileIcon = (filename: string) => {
    if (CODE_ICON_RE.test(filename)) {
      return <FaCode className="file-language-icon" aria-hidden="true" />;
    }
    if (TEXT_ICON_RE.test(filename)) {
      return <FaAlignJustify className="file-language-icon" aria-hidden="true" />;
    }
    return <FaTimesCircle className="file-language-icon" aria-hidden="true" />;
  };

  const canUpload =
    !!project &&
    project.Id > 0 &&
    !pageError &&
    !isPageLoading &&
    !isLoading &&
    !passedAllTests &&
    cooldownRemainingMs <= 0 &&
    files.length > 0;

  const projectSubtitle = useMemo(() => {
    if (!project) return "";
    return `${capitalize(project.Type)} problem`;
  }, [project]);

  const breadcrumbsItems = useMemo(() => {
    const homeCrumb =
      teamDivision === "Eagle"
        ? { label: "Eagle Division home", to: "/student/eagle-home" }
        : { label: "Student Problem Select", to: "/student/problems" };
    return [homeCrumb, { label: project?.Name || "Student Submit" }];
  }, [project, teamDivision]);

  const submissionViewBreadcrumbs = useMemo(() => {
    const homeCrumb =
      teamDivision === "Eagle"
        ? { label: "Eagle Division home", to: "/student/eagle-home" }
        : { label: "Student Problem Select", to: "/student/problems" };
    return [
      homeCrumb,
      {
        label: project?.Name || "Student Submit",
        to: projectId > 0 ? `/student/${projectId}/submit` : undefined,
      },
    ];
  }, [project, projectId, teamDivision]);

  const latestResultsHref =
    summary.latestSubmissionId !== null ? `/submission/${summary.latestSubmissionId}` : "";

  return (
    <div className="student-submit-page">
      <LoadingAnimation show={isLoading} message="Uploading..." />

      <Helmet>
        <title>Abacus</title>
      </Helmet>

      <MenuComponent />

      <DirectoryBreadcrumbs items={breadcrumbsItems} />

      <div className="student-submit-shell">
        <section className="panel panel-upload" aria-label="Upload Assignment">
          <header className="panel-header">
            {project ? (
              <div className="panel-header__titleCol">
                <h1 className="panel-title panel-title--project">{project.Name}</h1>

                {projectSubtitle ? (
                  <div className="panel-subtitle subtle">{projectSubtitle}</div>
                ) : null}

                <button
                  type="button"
                  className="assignment-download"
                  onClick={() => downloadAssignment(project.Id)}
                  disabled={project.Id <= 0}
                  aria-label="Download assignment description"
                  title="Download assignment instructions"
                >
                  <FaDownload aria-hidden="true" />
                  <span>Download Instructions</span>
                </button>
              </div>
            ) : (
              <div className="panel-header__titleCol">
                <h1 className="panel-title panel-title--project">
                  Student Submit
                </h1>
              </div>
            )}
          </header>

          {pageError ? <div className="callout callout--error">{pageError}</div> : null}
          {pageNotice ? <div className="callout callout--info">{pageNotice}</div> : null}
          {isPageLoading ? (
            <div className="callout callout--info">Loading problem details...</div>
          ) : null}

          <form
            className={`upload-form ${isLoading ? "is-loading" : ""}`}
            onSubmit={handleSubmit}
          >
            <div
              className={`cooldown-banner ${cooldownRemainingMs > 0 ? "cooldown-banner--active" : ""
                }`}
            >
              <FaClock className="cooldown-banner__icon" aria-hidden="true" />
              <div className="cooldown-banner__content">
                <div className="cooldown-banner__title">
                  2 minute submit cooldown
                </div>
                <div className="cooldown-banner__text">
                  {cooldownRemainingMs > 0
                    ? `You can submit again in ${formattedCooldown}.`
                    : "After every submission, you must wait 2 minutes before submitting again."}
                </div>
              </div>
            </div>

            <div className="dropzone">
              <div
                className="file-drop-area"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();

                  if (passedAllTests) return;

                  const dropped = Array.from(e.dataTransfer.files || []);
                  const valid = dropped.filter((f) => isAllowedFileName(f.name));

                  if (dropped.length && valid.length === 0) {
                    setFiles([]);
                    showLocalError("Only .py and .java files are allowed.");
                    return;
                  }

                  if (valid.length > 1 && !valid.every(isJavaFile)) {
                    setFiles([]);
                    showLocalError(
                      "Multi-file upload is only available for Java (.java) files."
                    );
                    return;
                  }

                  clearLocalError();
                  setFiles(valid);
                }}
              >
                {passedAllTests ? (
                  <div className="complete-message" role="status" aria-live="polite">
                    <FaCheckCircle className="complete-icon" aria-hidden="true" />
                    <h2 className="complete-title">All tests passed!</h2>
                    <p className="complete-text">
                      You are finished with this problem. Further submissions are
                      disabled.
                    </p>

                    {summary.latestSubmissionId !== null ? (
                      <Link
                        to={latestResultsHref}
                        state={{ breadcrumbItems: submissionViewBreadcrumbs }}
                        className="complete-link"
                      >
                        View your latest results{" "}
                        <FaExternalLinkAlt aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                ) : !files.length ? (
                  <>
                    <input
                      type="file"
                      className="file-input"
                      accept=".py,.java"
                      multiple
                      disabled={passedAllTests}
                      onChange={handleFileChange}
                    />

                    <div className="file-drop-message">
                      <FaCloudUploadAlt
                        className="file-drop-icon"
                        aria-hidden="true"
                      />
                      <p>
                        Drag &amp; drop your file(s) here or{" "}
                        <span className="browse-text">browse</span>
                      </p>
                      <p className="file-drop-hint">
                        Multi-file upload is supported for Java only.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="file-preview">
                    <button
                      type="button"
                      className="exchange-icon"
                      aria-label="Clear selected files"
                      title="Clear selected files"
                      onClick={() => setFiles([])}
                    >
                      <FaExchangeAlt aria-hidden="true" />
                    </button>

                    <div className="file-preview-list" title="Selected files">
                      {files.map((f) => (
                        <div
                          key={f.name}
                          className="file-preview-row solution-file-card"
                        >
                          <div
                            className="file-icon-wrapper"
                            aria-hidden="true"
                          >
                            <FaRegFile
                              className="file-outline-icon"
                              aria-hidden="true"
                            />
                            {getFileIcon(f.name)}
                          </div>

                          <span className="file-name">
                            {f.name}
                            {files.length > 1 &&
                              files.every(isJavaFile) &&
                              mainJavaFileName &&
                              f.name === mainJavaFileName && (
                                <span className="main-indicator">
                                  Main
                                </span>
                              )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="actions">
              <button
                type="submit"
                disabled={!canUpload}
                className={`primary ${!canUpload ? "disabled" : ""}`}
              >
                Upload
              </button>
            </div>

            <div className="below-upload">
              <ErrorMessage
                message={errorMessage}
                isHidden={isErrorMessageHidden}
              />
            </div>
          </form>
        </section>

        <aside className="panel panel-status" aria-label="Submission status">
          <div className="status-cards">
            <div className="status-card status-card--dashboard">
              <div className="status-card__top">
                <div className="status-card__label">
                  <FaCheckCircle aria-hidden="true" /> Testcases passed
                </div>

                <div className="status-card__value">
                  <span className="big">{passedTestcases}</span>
                  <span className="muted"> / {totalTestcases}</span>
                </div>
              </div>

              <div className="progress">
                <div
                  className="progress-bar"
                  role="progressbar"
                  aria-valuenow={passPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="progress-bar__fill"
                    style={{ width: `${passPct}%` }}
                  />
                </div>
              </div>

              <div className="status-detail-list">
                <div className="status-detail-row">
                  <div className="status-detail-row__icon">
                    <FaCheckCircle aria-hidden="true" />
                  </div>
                  <div className="status-detail-row__content">
                    <div className="status-detail-row__label">Testcase pass rate</div>
                    <div className="status-detail-row__value">{passPct}%</div>
                  </div>
                </div>

                <div className="status-detail-row">
                  <div className="status-detail-row__icon">
                    <FaClipboardList aria-hidden="true" />
                  </div>
                  <div className="status-detail-row__content">
                    <div className="status-detail-row__label">Submissions</div>
                    <div className="status-detail-row__value">{submissionCount}</div>
                  </div>
                </div>

                <div className="status-detail-row">
                  <div className="status-detail-row__icon">
                    <FaClock aria-hidden="true" />
                  </div>
                  <div className="status-detail-row__content">
                    <div className="status-detail-row__label">Latest submission</div>
                    <div className="status-detail-row__value">
                      {formatDateTime(summary.latestSubmittedAt)}
                    </div>
                  </div>
                </div>

                <div className="status-detail-row">
                  <div className="status-detail-row__icon">
                    <FaLayerGroup aria-hidden="true" />
                  </div>
                  <div className="status-detail-row__content">
                    <div className="status-detail-row__label">Problem type</div>
                    <div className="status-detail-row__value text-capitalize">
                      {project?.Type || "none"}
                    </div>
                  </div>
                </div>
              </div>

              {summary.latestSubmissionId !== null ? (
                <div className="link-stack">
                  <Link
                    to={latestResultsHref}
                    state={{ breadcrumbItems: submissionViewBreadcrumbs }}
                    className="linklike"
                  >
                    View latest results <FaExternalLinkAlt aria-hidden="true" />
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default StudentSubmit;