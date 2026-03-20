// src/pages/abacus/AdminTeamSubmissions.tsx

import React, { CSSProperties, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { useNavigate, useParams } from "react-router-dom";
import {
    FaCheckCircle,
    FaClipboardList,
    FaClock,
    FaFileAlt,
    FaLayerGroup,
} from "react-icons/fa";

import MenuComponent from "../components/MenuComponent";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";
import "../../styling/AdminTeamSubmissions.scss";

type ProjectType = "competition" | "practice" | "none";
type Division = "Blue" | "Gold" | "Eagle";

type ProjectObject = {
    Id: number;
    Name: string;
    TotalSubmissions: number;
    Type: ProjectType;
    Difficulty: string;
    OrderIndex: number | null;
};

type ApiTeam = {
    id: number;
    teamNumber: number;
    name: string;
    division: Division;
    isOnline: boolean;
};

type TeamProblemSummary = {
    projectId: number;
    totalTestcases: number;
    passedTestcases: number;
    submissionCount: number;
    latestSubmissionId: number | null;
    latestSubmittedAt: string | null;
};

type TeamSubmissionVm = {
    project: ProjectObject;
    summary: TeamProblemSummary;
    hasSubmission: boolean;
    percentPassed: number;
};

const EMPTY_SUMMARY: TeamProblemSummary = {
    projectId: 0,
    totalTestcases: 0,
    passedTestcases: 0,
    submissionCount: 0,
    latestSubmissionId: null,
    latestSubmittedAt: null,
};

function sortProjectsByOrderIndex(projects: ProjectObject[]) {
    return projects.sort((a, b) => {
        if (a.OrderIndex === null && b.OrderIndex === null) return 0;
        if (a.OrderIndex === null) return 1;
        if (b.OrderIndex === null) return -1;
        return a.OrderIndex - b.OrderIndex;
    });
}

function normalizeSummaryRows(data: any): TeamProblemSummary[] {
    const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.submissions)
                ? data.submissions
                : [];

    return rows
        .map((row: any) => {
            const projectId = Number(row.projectId ?? row.project_id ?? row.Id ?? 0);
            const totalTestcases = Math.max(0, Number(row.totalTestcases ?? row.total_testcases ?? 0));
            const passedTestcases = Math.max(0, Number(row.passedTestcases ?? row.passed_testcases ?? 0));
            const submissionCount = Math.max(0, Number(row.submissionCount ?? row.submission_count ?? 0));
            const latestSubmissionIdRaw = row.latestSubmissionId ?? row.latest_submission_id ?? null;
            const latestSubmittedAt = row.latestSubmittedAt ?? row.latest_submitted_at ?? null;

            return {
                projectId,
                totalTestcases,
                passedTestcases: Math.min(passedTestcases, totalTestcases || passedTestcases),
                submissionCount,
                latestSubmissionId:
                    latestSubmissionIdRaw === null || latestSubmissionIdRaw === undefined
                        ? null
                        : Number(latestSubmissionIdRaw),
                latestSubmittedAt: latestSubmittedAt ? String(latestSubmittedAt) : null,
            };
        })
        .filter((row) => row.projectId > 0);
}

function formatDateTime(value?: string | null) {
    if (!value) return "Not submitted yet";

    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "Unknown";

    return dt.toLocaleString();
}

function buildSummaryMap(rows: TeamProblemSummary[]) {
    const map: Record<number, TeamProblemSummary> = {};
    for (const row of rows) {
        map[row.projectId] = row;
    }
    return map;
}

export default function AdminTeamSubmissions() {
    const API = (import.meta.env.VITE_API_URL as string) || "";
    const navigate = useNavigate();
    const { teamId, school_id } = useParams();

    const teamIdNum = Number(teamId);
    const schoolIdNum = Number(school_id);
    const isAdminMode = Number.isFinite(schoolIdNum) && schoolIdNum > 0;
    const managedSchoolId = isAdminMode ? schoolIdNum : null;

    const [team, setTeam] = useState<ApiTeam | null>(null);
    const [projects, setProjects] = useState<ProjectObject[]>([]);
    const [summaryByProject, setSummaryByProject] = useState<Record<number, TeamProblemSummary>>({});
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [pageError, setPageError] = useState<string>("");
    const [pageNotice, setPageNotice] = useState<string>("");
    const [schoolName, setSchoolName] = useState<string>("");

    function authConfig() {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }

    async function fetchSchoolName() {
        setSchoolName("");

        try {
            if (managedSchoolId) {
                const res = await axios.get(`${API}/schools/id/${managedSchoolId}`, authConfig());
                const name = Array.isArray(res.data) ? res.data?.[0]?.name : res.data?.name;
                setSchoolName(String(name || ""));
                return;
            }

            const res = await axios.get(`${API}/schools/me`, authConfig());
            setSchoolName(String(res.data?.name || ""));
        } catch {
            setSchoolName("");
        }
    }

    useEffect(() => {
        if (!Number.isFinite(teamIdNum) || teamIdNum <= 0) {
            setPageError("Invalid team id.");
            return;
        }

        fetchSchoolName();
        fetchPage();
    }, [API, teamIdNum, managedSchoolId]);

    async function fetchPage() {
        setIsLoading(true);
        setPageError("");
        setPageNotice("");

        const [teamResult, projectsResult, summaryResult] = await Promise.allSettled([
            axios.get<ApiTeam[]>(
                `${API}/teams/byschool/details`,
                {
                    ...authConfig(),
                    params: managedSchoolId ? { school_id: managedSchoolId } : undefined,
                }
            ),
            axios.get<ProjectObject[]>(`${API}/projects/all_projects`, authConfig()),
            axios.get(
                `${API}/teams/submissions/summary`,
                {
                    ...authConfig(),
                    params: {
                        team_id: teamIdNum,
                        ...(managedSchoolId ? { school_id: managedSchoolId } : {}),
                    },
                }
            ),
        ]);

        if (teamResult.status === "fulfilled") {
            const allTeams = Array.isArray(teamResult.value.data) ? teamResult.value.data : [];
            const selectedTeam = allTeams.find((t) => t.id === teamIdNum) || null;

            if (!selectedTeam) {
                setPageError("Team not found.");
            } else {
                setTeam(selectedTeam);
            }
        } else {
            const msg =
                (teamResult.reason as any)?.response?.data?.message ||
                (teamResult.reason as any)?.message ||
                "Failed to load team information.";
            setPageError(msg);
        }

        if (projectsResult.status === "fulfilled") {
            const data = Array.isArray(projectsResult.value.data) ? projectsResult.value.data : [];
            setProjects(sortProjectsByOrderIndex(data.slice()));
        } else {
            const msg =
                (projectsResult.reason as any)?.response?.data?.message ||
                (projectsResult.reason as any)?.message ||
                "Failed to load problems.";
            setPageError((prev) => prev || msg);
        }

        if (summaryResult.status === "fulfilled") {
            const rows = normalizeSummaryRows(summaryResult.value.data);
            setSummaryByProject(buildSummaryMap(rows));
        } else {
            setSummaryByProject({});
            setPageNotice(
                "Problem list loaded, but the team submission summary endpoint is not returning data yet. Add GET /teams/submissions/summary to populate testcase totals and latest submission details."
            );
        }

        setIsLoading(false);
    }

    const submissions = useMemo<TeamSubmissionVm[]>(() => {
        return projects.map((project) => {
            const summary = summaryByProject[project.Id] || {
                ...EMPTY_SUMMARY,
                projectId: project.Id,
            };

            const totalTestcases = Math.max(0, summary.totalTestcases);
            const passedTestcases = Math.max(0, Math.min(summary.passedTestcases, totalTestcases || summary.passedTestcases));
            const percentPassed = totalTestcases > 0 ? Math.round((passedTestcases / totalTestcases) * 100) : 0;
            const hasSubmission = summary.submissionCount > 0 || !!summary.latestSubmissionId;

            return {
                project,
                summary: {
                    ...summary,
                    totalTestcases,
                    passedTestcases,
                },
                hasSubmission,
                percentPassed,
            };
        });
    }, [projects, summaryByProject]);

    const overview = useMemo(() => {
        const totalProblems = submissions.length;
        const submittedProblems = submissions.filter((s) => s.hasSubmission).length;
        const perfectProblems = submissions.filter(
            (s) => s.summary.totalTestcases > 0 && s.summary.passedTestcases === s.summary.totalTestcases
        ).length;

        return {
            totalProblems,
            submittedProblems,
            perfectProblems,
        };
    }, [submissions]);

    const teamManagePath = isAdminMode
        ? `/admin/${managedSchoolId}/team-manage`
        : `/teacher/team-manage`;

    const teamSubmissionsPath = isAdminMode
        ? `/admin/${managedSchoolId}/team-manage/${teamIdNum}/submissions`
        : `/teacher/team-manage/${teamIdNum}/submissions`;

    const breadcrumbs = isAdminMode
        ? [
            { label: "School List", to: "/admin/schools" },
            { label: "Team Manage", to: teamManagePath },
            { label: "Team Submissions" },
        ]
        : [
            { label: "Team Manage", to: teamManagePath },
            { label: "Team Submissions" },
        ];

    const submissionViewBreadcrumbs = isAdminMode
        ? [
            { label: "School List", to: "/admin/schools" },
            { label: "Team Manage", to: teamManagePath },
            { label: "Team Submissions", to: teamSubmissionsPath },
        ]
        : [
            { label: "Team Manage", to: teamManagePath },
            { label: "Team Submissions", to: teamSubmissionsPath },
        ];

    const dashboardTitle = schoolName ? `${schoolName} Team Submissions` : "Team Submissions";

    return (
        <>
            <Helmet>
                <title>{isAdminMode ? "[Admin] Abacus" : "Abacus"}</title>
            </Helmet>

            <MenuComponent
                showProblemList={isAdminMode}
                showAdminUpload={isAdminMode}
            />

            <div className="admin-team-submissions-root">
                <DirectoryBreadcrumbs items={breadcrumbs} trailingSeparator={!managedSchoolId} />

                <div className="pageTitle">{dashboardTitle}</div>

                <div className="admin-team-submissions-content">
                    <section className="submissions-hero">
                        <div className="submissions-hero__header">
                            <div className="submissions-hero__title-row">
                                <h1 className="submissions-page-title">
                                    {team ? team.name : `Team ${teamIdNum}`}
                                </h1>

                                {team?.division ? (
                                    <span className={`hero-pill hero-pill--${team.division.toLowerCase()}`}>
                                        {team.division} Division
                                    </span>
                                ) : null}

                                {team ? (
                                    <span className="hero-pill">
                                        {team.isOnline ? "Virtual" : "In-person"}
                                    </span>
                                ) : null}
                            </div>

                            <div className="submissions-hero__meta">
                                Team #{team?.teamNumber ?? teamIdNum}
                            </div>
                        </div>

                        <div className="submission-overview-grid">

                            <div className="overview-card">
                                <div className="overview-card__top">
                                    <div className="overview-card__label">Submitted</div>
                                    <div className="overview-card__icon">
                                        <FaClipboardList aria-hidden="true" />
                                    </div>
                                </div>
                                <div className="overview-card__value">
                                    {overview.submittedProblems}/{overview.totalProblems}
                                </div>
                                <div className="overview-card__meta">Problems this team has submitted at least once</div>
                            </div>

                            <div className="overview-card">
                                <div className="overview-card__top">
                                    <div className="overview-card__label">Completed problems</div>
                                    <div className="overview-card__icon">
                                        <FaCheckCircle aria-hidden="true" />
                                    </div>
                                </div>
                                <div className="overview-card__value">
                                    {overview.perfectProblems}/{overview.totalProblems}
                                </div>
                                <div className="overview-card__meta">Problems where this team passed all test cases</div>
                            </div>
                        </div>
                    </section>

                    {pageError ? <div className="callout callout--error">{pageError}</div> : null}
                    {pageNotice ? <div className="callout callout--info">{pageNotice}</div> : null}
                    {isLoading ? <div className="callout callout--info">Loading team submissions...</div> : null}

                    <div className="submission-card-grid">
                        {submissions.map((vm) => {
                            const typeClass = `is-${vm.project.Type}`;
                            const difficultyClass = vm.project.Difficulty.toLowerCase();
                            const ringStyle = {
                                ["--pct" as any]: `${vm.percentPassed}%`,
                            } as CSSProperties;

                            const isPerfect =
                                vm.summary.totalTestcases > 0 &&
                                vm.summary.passedTestcases === vm.summary.totalTestcases;

                            const canViewOutput = vm.summary.latestSubmissionId !== null;

                            return (
                                <div className={`submission-card ${typeClass}`} key={vm.project.Id}>
                                    <div className="submission-card__topbar" />

                                    <div className="submission-card__header">
                                        <div className="submission-card__title-block">
                                            <div className="submission-card__kicker">
                                                {vm.project.OrderIndex ?? "-"}
                                            </div>

                                            <div className="submission-card__title-area">
                                                <div className="submission-card__title">{vm.project.Name}</div>
                                                <div className="submission-card__badges">
                                                    <span className={`submission-badge submission-badge--${vm.project.Type}`}>
                                                        {vm.project.Type}
                                                    </span>
                                                    <span className={`submission-badge submission-badge--difficulty submission-badge--${difficultyClass}`}>
                                                        {difficultyClass}
                                                    </span>
                                                    <span className={`submission-status ${vm.hasSubmission ? "is-submitted" : "is-empty"}`}>
                                                        {vm.hasSubmission ? "Submitted" : "No submission"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="submission-card__body">
                                        <div className={`submission-score-ring ${isPerfect ? "is-perfect" : ""}`} style={ringStyle}>
                                            <div className="submission-score-ring__inner">
                                                <div className="submission-score-ring__fraction">
                                                    {vm.summary.passedTestcases}/{vm.summary.totalTestcases}
                                                </div>
                                                <div className="submission-score-ring__label">testcases</div>
                                            </div>
                                        </div>

                                        <div className="submission-card__details">
                                            <div className="submission-detail-row">
                                                <div className="submission-detail-row__icon">
                                                    <FaCheckCircle aria-hidden="true" />
                                                </div>
                                                <div className="submission-detail-row__content">
                                                    <div className="submission-detail-row__label">Testcase Pass rate</div>
                                                    <div className="submission-detail-row__value">{vm.percentPassed}%</div>
                                                </div>
                                            </div>

                                            <div className="submission-detail-row">
                                                <div className="submission-detail-row__icon">
                                                    <FaClipboardList aria-hidden="true" />
                                                </div>
                                                <div className="submission-detail-row__content">
                                                    <div className="submission-detail-row__label">Submissions</div>
                                                    <div className="submission-detail-row__value">{vm.summary.submissionCount}</div>
                                                </div>
                                            </div>

                                            <div className="submission-detail-row">
                                                <div className="submission-detail-row__icon">
                                                    <FaClock aria-hidden="true" />
                                                </div>
                                                <div className="submission-detail-row__content">
                                                    <div className="submission-detail-row__label">Latest submission</div>
                                                    <div className="submission-detail-row__value">
                                                        {formatDateTime(vm.summary.latestSubmittedAt)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="submission-detail-row">
                                                <div className="submission-detail-row__icon">
                                                    <FaLayerGroup aria-hidden="true" />
                                                </div>
                                                <div className="submission-detail-row__content">
                                                    <div className="submission-detail-row__label">Problem type</div>
                                                    <div className="submission-detail-row__value text-capitalize">
                                                        {vm.project.Type}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="submission-card__footer">
                                        <button
                                            type="button"
                                            className="submission-output-link"
                                            disabled={!canViewOutput}
                                            title={
                                                canViewOutput
                                                    ? "View the latest submission output"
                                                    : "A submission is required to view output."
                                            }
                                            onClick={() => {
                                                if (!canViewOutput || vm.summary.latestSubmissionId === null) return;

                                                navigate(`${teamSubmissionsPath}/${vm.summary.latestSubmissionId}`, {
                                                    state: {
                                                        breadcrumbItems: submissionViewBreadcrumbs,
                                                    },
                                                });
                                            }}
                                        >
                                            <FaFileAlt aria-hidden="true" />
                                            <span>See output</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </>
    );
}