import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import {
    FaDownload,
    FaFolderOpen,
    FaLayerGroup,
    FaUpload,
} from "react-icons/fa";

import MenuComponent from "../components/MenuComponent";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";
import {
    CompetitionSchedule,
    fetchCompetitionSchedule,
    filterProjectsForCurrentStage,
    getCompetitionStage,
    CompetitionStage,
} from "../components/CompetitionStageStatus";
import {
    Division,
    ProjectObject,
    sortProjectsByOrderIndex,
    TeamDashboardTeam,
} from "../components/ProblemSubmissionsDashboard";

import "../../styling/StudentGoldProjectSelection.scss";

type TeamMeResponse = {
    id: number;
    name: string;
    division?: Division;
    teamNumber?: number;
    team_number?: number;
    number?: number;
    isOnline?: boolean;
    is_online?: boolean;
};

export default function StudentGoldProjectSelection() {
    const apiBase = (import.meta.env.VITE_API_URL as string) || "";
    const navigate = useNavigate();

    const [team, setTeam] = useState<TeamDashboardTeam | null>(null);
    const [projects, setProjects] = useState<ProjectObject[]>([]);
    const [competitionSchedule, setCompetitionSchedule] =
        useState<CompetitionSchedule | null>(null);
    const [stageCheckTime] = useState<Date>(() => new Date());
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [pageError, setPageError] = useState<string>("");
    const [pageNotice, setPageNotice] = useState<string>("");

    function authConfig() {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }

    function downloadAssignment(projectId: number) {
        if (!projectId || projectId <= 0) return;

        axios
            .get(`${apiBase}/projects/getAssignmentDescription?project_id=${projectId}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("AUTOTA_AUTH_TOKEN")}`,
                },
                responseType: "blob",
            })
            .then((res) => {
                const type =
                    (res.headers as any)["content-type"] || "application/octet-stream";
                const blob = new Blob([res.data], { type });
                const name =
                    (res.headers as any)["x-filename"] || "assignment_description";
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
                setPageNotice("Failed to download assignment instructions.");
            });
    }

    useEffect(() => {
        fetchPage();
    }, [apiBase]);

    async function fetchPage() {
        setIsLoading(true);
        setPageError("");
        setPageNotice("");

        try {
            const teamRes = await axios.get<TeamMeResponse>(`${apiBase}/teams/me`, authConfig());
            const teamData = teamRes.data;

            const resolvedTeam: TeamDashboardTeam = {
                id: Number(teamData?.id ?? 0),
                name: String(teamData?.name || "My Team"),
                division: teamData?.division ?? null,
                teamNumber:
                    teamData?.teamNumber ??
                    teamData?.team_number ??
                    teamData?.number ??
                    teamData?.id ??
                    null,
                isOnline:
                    typeof teamData?.isOnline === "boolean"
                        ? teamData.isOnline
                        : typeof teamData?.is_online === "boolean"
                            ? teamData.is_online
                            : null,
            };

            if (!Number.isFinite(resolvedTeam.id) || resolvedTeam.id <= 0) {
                setTeam(null);
                setProjects([]);
                setPageError("Unable to determine the current team.");
                setIsLoading(false);
                return;
            }

            setTeam(resolvedTeam);

            const [projectsResult, scheduleResult] = await Promise.allSettled([
                axios.get<ProjectObject[]>(`${apiBase}/projects/all_projects`, {
                    ...authConfig(),
                    params: { division: "gold" },
                }),
                fetchCompetitionSchedule(apiBase),
            ]);

            if (projectsResult.status === "fulfilled") {
                const data = Array.isArray(projectsResult.value.data)
                    ? projectsResult.value.data
                    : [];
                setProjects(sortProjectsByOrderIndex(data.slice()));
            } else {
                const msg =
                    (projectsResult.reason as any)?.response?.data?.message ||
                    (projectsResult.reason as any)?.message ||
                    "Failed to load problems.";
                setProjects([]);
                setPageError(msg);
            }

            if (scheduleResult.status === "fulfilled") {
                setCompetitionSchedule(scheduleResult.value);
            } else {
                setCompetitionSchedule(null);
                setPageError((prev) => prev || "Failed to load competition schedule.");
            }
        } catch (err: any) {
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                "Failed to load your team information.";
            setTeam(null);
            setProjects([]);
            setPageError(msg);
        } finally {
            setIsLoading(false);
        }
    }

    const viewerStage = useMemo<CompetitionStage | null>(() => {
        if (!competitionSchedule) return null;
        return getCompetitionStage(competitionSchedule, stageCheckTime, "student");
    }, [competitionSchedule, stageCheckTime]);

    const visibleProjects = useMemo(() => {
        return filterProjectsForCurrentStage(
            projects,
            competitionSchedule,
            stageCheckTime,
            "student"
        );
    }, [projects, competitionSchedule, stageCheckTime]);

    const stageNotice =
        viewerStage === "over"
            ? "Submissions and assignment descriptions will unlock 24 hours after the competition ends."
            : "";

    const resolvedPageNotice = pageNotice || stageNotice;

    const emptyStateMessage =
        viewerStage === "over"
            ? "Submissions will unlock 24 hours after the competition ends."
            : "Problems will appear here once they are available.";

    const visibleProblemCount = visibleProjects.length;
    const totalProblemCount = projects.length;

    return (
        <>
            <Helmet>
                <title>Abacus</title>
            </Helmet>

            <MenuComponent />

            <div className="student-gold-root">
                <DirectoryBreadcrumbs
                    items={[{ label: "Student Gold Problem Select" }]}
                    trailingSeparator={true}
                />

                <div className="pageTitle">
                    {team?.name
                        ? `Gold Division Problem Select: ${team.name}`
                        : "Gold Division Problem Select"}
                </div>

                <div className="student-gold-content">
                    <section className="gold-hero">
                        <div className="gold-hero__header">
                            <div className="gold-hero__title-row">
                                <h1 className="gold-page-title">
                                    {team?.name || "Gold Division"}
                                </h1>

                                {team?.division ? (
                                    <span
                                        className={`gold-hero-pill gold-hero-pill--${team.division.toLowerCase()}`}
                                    >
                                        {team.division} Division
                                    </span>
                                ) : null}

                                {typeof team?.isOnline === "boolean" ? (
                                    <span className="gold-hero-pill">
                                        {team.isOnline ? "Virtual" : "In-person"}
                                    </span>
                                ) : null}
                            </div>

                            {team?.teamNumber !== null &&
                                team?.teamNumber !== undefined &&
                                String(team.teamNumber).length > 0 ? (
                                <div className="gold-hero__meta">Team #{team.teamNumber}</div>
                            ) : null}
                        </div>

                        <div className="gold-overview-grid">
                            <div className="gold-overview-card">
                                <div className="gold-overview-card__top">
                                    <div className="gold-overview-card__label">
                                        Available problems
                                    </div>
                                    <div className="gold-overview-card__icon">
                                        <FaFolderOpen aria-hidden="true" />
                                    </div>
                                </div>
                                <div className="gold-overview-card__value">
                                    {visibleProblemCount}
                                </div>
                                <div className="gold-overview-card__meta">
                                    Problems currently visible to your team
                                </div>
                            </div>

                            <div className="gold-overview-card">
                                <div className="gold-overview-card__top">
                                    <div className="gold-overview-card__label">Total gold problems</div>
                                    <div className="gold-overview-card__icon">
                                        <FaLayerGroup aria-hidden="true" />
                                    </div>
                                </div>
                                <div className="gold-overview-card__value">
                                    {totalProblemCount}
                                </div>
                                <div className="gold-overview-card__meta">
                                    Total problems configured for Gold Division
                                </div>
                            </div>
                        </div>
                    </section>

                    {pageError && (
                        <div className="callout callout--error">{pageError}</div>
                    )}

                    {!pageError && resolvedPageNotice && (
                        <div className="callout callout--info">{resolvedPageNotice}</div>
                    )}

                    {isLoading ? (
                        <div className="callout callout--info">Loading problems...</div>
                    ) : visibleProjects.length === 0 ? (
                        <div className="callout callout--info">{emptyStateMessage}</div>
                    ) : (
                        <div className="gold-problem-grid">
                            {visibleProjects.map((project) => (
                                <div className="gold-problem-card" key={project.Id}>
                                    <div className="gold-problem-card__topbar" />

                                    <div className="gold-problem-card__header">
                                        <div className="gold-problem-card__title-block">
                                            <div className="gold-problem-card__kicker">
                                                {project.OrderIndex ?? "-"}
                                            </div>

                                            <div className="gold-problem-card__title-area">
                                                <div className="gold-problem-card__title">
                                                    {project.Name}
                                                </div>

                                                <div className="gold-problem-card__badges">
                                                    <span className="gold-problem-badge gold-problem-badge--gold">
                                                        Gold Problem
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="gold-problem-card__body">
                                        <div className="gold-problem-detail-row">
                                            <div className="gold-problem-detail-row__icon">
                                                <FaFolderOpen aria-hidden="true" />
                                            </div>
                                            <div className="gold-problem-detail-row__content">
                                                <div className="gold-problem-detail-row__label">
                                                    Assignment
                                                </div>
                                                <div className="gold-problem-detail-row__value">
                                                    Download the instructions, complete your program,
                                                    then upload your solution for this specific problem.
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="gold-problem-card__footer">
                                        <div className="gold-problem-card__actions">
                                            <button
                                                type="button"
                                                className="gold-action-button gold-action-button--secondary"
                                                onClick={() => downloadAssignment(project.Id)}
                                            >
                                                <FaDownload
                                                    aria-hidden="true"
                                                    className="gold-action-button__icon"
                                                />
                                                <span>Download Instructions</span>
                                            </button>

                                            <button
                                                type="button"
                                                className="gold-action-button"
                                                onClick={() =>
                                                    navigate(`/student/gold-submissions/${project.Id}`)
                                                }
                                            >
                                                <FaUpload
                                                    aria-hidden="true"
                                                    className="gold-action-button__icon"
                                                />
                                                <span>Upload Program</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}