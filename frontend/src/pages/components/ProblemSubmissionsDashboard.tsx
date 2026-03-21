import React, { CSSProperties, ReactNode, useMemo } from "react";
import { Helmet } from "react-helmet";
import {
    FaCheckCircle,
    FaClipboardList,
    FaClock,
    FaLayerGroup,
} from "react-icons/fa";

import MenuComponent from "./MenuComponent";
import DirectoryBreadcrumbs, { DirectoryCrumb } from "./DirectoryBreadcrumbs";
import "../../styling/ProblemSubmissionsDashboard.scss";

export type ProjectType = "competition" | "practice" | "none";
export type Division = "Blue" | "Gold" | "Eagle";

export type ProjectObject = {
    Id: number;
    Name: string;
    TotalSubmissions: number;
    Type: ProjectType;
    Difficulty: string;
    OrderIndex: number | null;
};

export type TeamProblemSummary = {
    projectId: number;
    totalTestcases: number;
    passedTestcases: number;
    submissionCount: number;
    latestSubmissionId: number | null;
    latestSubmittedAt: string | null;
};

export type TeamSubmissionVm = {
    project: ProjectObject;
    summary: TeamProblemSummary;
    hasSubmission: boolean;
    percentPassed: number;
};

export type TeamDashboardTeam = {
    id: number;
    name: string;
    division?: Division | null;
    teamNumber?: number | null;
    isOnline?: boolean | null;
};

export type SubmissionCardAction = {
    key: string;
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    disabled?: boolean;
    title?: string;
    variant?: "primary" | "secondary" | "highlight";
};

export const EMPTY_SUMMARY: TeamProblemSummary = {
    projectId: 0,
    totalTestcases: 0,
    passedTestcases: 0,
    submissionCount: 0,
    latestSubmissionId: null,
    latestSubmittedAt: null,
};

export function sortProjectsByOrderIndex(projects: ProjectObject[]) {
    return projects.sort((a, b) => {
        if (a.OrderIndex === null && b.OrderIndex === null) return 0;
        if (a.OrderIndex === null) return 1;
        if (b.OrderIndex === null) return -1;
        return a.OrderIndex - b.OrderIndex;
    });
}

export function normalizeSummaryRows(data: any): TeamProblemSummary[] {
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

export function formatDateTime(value?: string | null) {
    if (!value) return "Not submitted yet";

    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "Unknown";

    return dt.toLocaleString();
}

export function buildSummaryMap(rows: TeamProblemSummary[]) {
    const map: Record<number, TeamProblemSummary> = {};
    for (const row of rows) {
        map[row.projectId] = row;
    }
    return map;
}

export function buildTeamSubmissionViewModels(
    projects: ProjectObject[],
    summaryByProject: Record<number, TeamProblemSummary>
): TeamSubmissionVm[] {
    return projects.map((project) => {
        const summary = summaryByProject[project.Id] || {
            ...EMPTY_SUMMARY,
            projectId: project.Id,
        };

        const totalTestcases = Math.max(0, summary.totalTestcases);
        const passedTestcases = Math.max(
            0,
            Math.min(summary.passedTestcases, totalTestcases || summary.passedTestcases)
        );
        const percentPassed =
            totalTestcases > 0 ? Math.round((passedTestcases / totalTestcases) * 100) : 0;
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
}

type ProblemSubmissionsDashboardProps = {
    helmetTitle: string;
    menuProps?: React.ComponentProps<typeof MenuComponent>;
    breadcrumbs: DirectoryCrumb[];
    breadcrumbTrailingSeparator?: boolean;
    dashboardTitle: string;
    team: TeamDashboardTeam | null;
    fallbackTeamName: string;
    fallbackTeamNumber?: number | string | null;
    pageError?: string;
    pageNotice?: string;
    isLoading?: boolean;
    submissions: TeamSubmissionVm[];
    getTopActions?: (vm: TeamSubmissionVm) => SubmissionCardAction[];
    getActions: (vm: TeamSubmissionVm) => SubmissionCardAction[];
    emptyStateMessage?: string;
};

export default function ProblemSubmissionsDashboard({
    helmetTitle,
    menuProps,
    breadcrumbs,
    breadcrumbTrailingSeparator = false,
    dashboardTitle,
    team,
    fallbackTeamName,
    fallbackTeamNumber = null,
    pageError = "",
    pageNotice = "",
    isLoading = false,
    submissions,
    getTopActions,
    getActions,
    emptyStateMessage = "No problems are available yet.",
}: ProblemSubmissionsDashboardProps) {
    const overview = useMemo(() => {
        const totalProblems = submissions.length;
        const submittedProblems = submissions.filter((s) => s.hasSubmission).length;
        const perfectProblems = submissions.filter(
            (s) =>
                s.summary.totalTestcases > 0 &&
                s.summary.passedTestcases === s.summary.totalTestcases
        ).length;

        return {
            totalProblems,
            submittedProblems,
            perfectProblems,
        };
    }, [submissions]);

    const resolvedTeamNumber = team?.teamNumber ?? fallbackTeamNumber;
    const resolvedTeamName = team?.name || fallbackTeamName;

    return (
        <>
            <Helmet>
                <title>{helmetTitle}</title>
            </Helmet>

            <MenuComponent {...menuProps} />

            <div className="admin-team-submissions-root">
                <DirectoryBreadcrumbs
                    items={breadcrumbs}
                    trailingSeparator={breadcrumbTrailingSeparator}
                />

                <div className="pageTitle">{dashboardTitle}</div>

                <div className="admin-team-submissions-content">
                    <section className="submissions-hero">
                        <div className="submissions-hero__header">
                            <div className="submissions-hero__title-row">
                                <h1 className="submissions-page-title">{resolvedTeamName}</h1>

                                {team?.division ? (
                                    <span
                                        className={`hero-pill hero-pill--${team.division.toLowerCase()}`}
                                    >
                                        {team.division} Division
                                    </span>
                                ) : null}

                                {typeof team?.isOnline === "boolean" ? (
                                    <span className="hero-pill">
                                        {team.isOnline ? "Virtual" : "In-person"}
                                    </span>
                                ) : null}
                            </div>

                            {resolvedTeamNumber !== null &&
                                resolvedTeamNumber !== undefined &&
                                String(resolvedTeamNumber).length > 0 ? (
                                <div className="submissions-hero__meta">
                                    Team #{resolvedTeamNumber}
                                </div>
                            ) : null}
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
                                <div className="overview-card__meta">
                                    Problems this team has submitted at least once
                                </div>
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
                                <div className="overview-card__meta">
                                    Problems where this team passed all test cases
                                </div>
                            </div>
                        </div>
                    </section>

                    {pageError ? <div className="callout callout--error">{pageError}</div> : null}
                    {pageNotice ? <div className="callout callout--info">{pageNotice}</div> : null}
                    {isLoading ? (
                        <div className="callout callout--info">Loading team submissions...</div>
                    ) : null}

                    {!isLoading && !pageError && submissions.length === 0 ? (
                        <div className="callout callout--info">{emptyStateMessage}</div>
                    ) : null}

                    <div className="submission-card-grid">
                        {submissions.map((vm) => {
                            const typeClass = `is-${vm.project.Type}`;
                            const ringStyle = {
                                ["--pct" as any]: `${vm.percentPassed}%`,
                            } as CSSProperties;

                            const isPerfect =
                                vm.summary.totalTestcases > 0 &&
                                vm.summary.passedTestcases === vm.summary.totalTestcases;

                            const topActions = getTopActions ? getTopActions(vm) : [];
                            const actions = getActions(vm);

                            return (
                                <div className={`submission-card ${typeClass}`} key={vm.project.Id}>
                                    <div className="submission-card__topbar" />

                                    <div className="submission-card__header">
                                        <div className="submission-card__title-block">
                                            <div className="submission-card__kicker">
                                                {vm.project.OrderIndex ?? "-"}
                                            </div>

                                            <div className="submission-card__title-area">
                                                <div className="submission-card__title-row">
                                                    <div className="submission-card__title">
                                                        {vm.project.Name}
                                                    </div>

                                                    {topActions.length > 0 ? (
                                                        <div className="submission-card__top-actions">
                                                            {topActions.map((action) => (
                                                                <button
                                                                    key={action.key}
                                                                    type="button"
                                                                    className={`submission-output-link ${action.variant === "secondary"
                                                                        ? "submission-output-link--secondary"
                                                                        : action.variant === "highlight"
                                                                            ? "submission-output-link--highlight"
                                                                            : ""
                                                                        }`.trim()}
                                                                    disabled={action.disabled}
                                                                    title={action.title}
                                                                    onClick={() => {
                                                                        if (action.disabled) return;
                                                                        action.onClick();
                                                                    }}
                                                                >
                                                                    {action.icon}
                                                                    <span>{action.label}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </div>

                                                <div className="submission-card__badges">
                                                    <span
                                                        className={`submission-badge submission-badge--${vm.project.Type}`}
                                                    >
                                                        {vm.project.Type}
                                                    </span>
                                                    <span
                                                        className={`submission-status ${vm.hasSubmission
                                                            ? "is-submitted"
                                                            : "is-empty"
                                                            }`}
                                                    >
                                                        {vm.hasSubmission
                                                            ? "Submitted"
                                                            : "No submission"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="submission-card__body">
                                        <div
                                            className={`submission-score-ring ${isPerfect ? "is-perfect" : ""
                                                }`}
                                            style={ringStyle}
                                        >
                                            <div className="submission-score-ring__inner">
                                                <div className="submission-score-ring__fraction">
                                                    {vm.summary.passedTestcases}/
                                                    {vm.summary.totalTestcases}
                                                </div>
                                                <div className="submission-score-ring__label">
                                                    testcases
                                                </div>
                                            </div>
                                        </div>

                                        <div className="submission-card__details">
                                            <div className="submission-detail-row">
                                                <div className="submission-detail-row__icon">
                                                    <FaCheckCircle aria-hidden="true" />
                                                </div>
                                                <div className="submission-detail-row__content">
                                                    <div className="submission-detail-row__label">
                                                        Testcase Pass rate
                                                    </div>
                                                    <div className="submission-detail-row__value">
                                                        {vm.percentPassed}%
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="submission-detail-row">
                                                <div className="submission-detail-row__icon">
                                                    <FaClipboardList aria-hidden="true" />
                                                </div>
                                                <div className="submission-detail-row__content">
                                                    <div className="submission-detail-row__label">
                                                        Submissions
                                                    </div>
                                                    <div className="submission-detail-row__value">
                                                        {vm.summary.submissionCount}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="submission-detail-row">
                                                <div className="submission-detail-row__icon">
                                                    <FaClock aria-hidden="true" />
                                                </div>
                                                <div className="submission-detail-row__content">
                                                    <div className="submission-detail-row__label">
                                                        Latest submission
                                                    </div>
                                                    <div className="submission-detail-row__value">
                                                        {formatDateTime(
                                                            vm.summary.latestSubmittedAt
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="submission-detail-row">
                                                <div className="submission-detail-row__icon">
                                                    <FaLayerGroup aria-hidden="true" />
                                                </div>
                                                <div className="submission-detail-row__content">
                                                    <div className="submission-detail-row__label">
                                                        Problem type
                                                    </div>
                                                    <div className="submission-detail-row__value text-capitalize">
                                                        {vm.project.Type}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="submission-card__footer">
                                        <div className="submission-card__actions">
                                            {actions.map((action) => (
                                                <button
                                                    key={action.key}
                                                    type="button"
                                                    className={`submission-output-link ${action.variant === "secondary"
                                                        ? "submission-output-link--secondary"
                                                        : action.variant === "highlight"
                                                            ? "submission-output-link--highlight"
                                                            : ""
                                                        }`.trim()}
                                                    disabled={action.disabled}
                                                    title={action.title}
                                                    onClick={() => {
                                                        if (action.disabled) return;
                                                        action.onClick();
                                                    }}
                                                >
                                                    {action.icon}
                                                    <span>{action.label}</span>
                                                </button>
                                            ))}
                                        </div>
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