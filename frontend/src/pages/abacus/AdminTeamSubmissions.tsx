import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { FaDownload, FaFileAlt } from "react-icons/fa";

import ProblemSubmissionsDashboard, {
    buildSummaryMap,
    buildTeamSubmissionViewModels,
    Division,
    normalizeSummaryRows,
    ProjectObject,
    sortProjectsByOrderIndex,
    TeamDashboardTeam,
    TeamProblemSummary,
} from "../components/ProblemSubmissionsDashboard";
import {
    CompetitionSchedule,
    fetchCompetitionSchedule,
    filterProjectsForCurrentStage,
} from "../components/CompetitionStageStatus";

type ApiTeam = {
    id: number;
    teamNumber: number;
    name: string;
    division: Division;
    isOnline: boolean;
};

export default function AdminTeamSubmissions() {
    const API = (import.meta.env.VITE_API_URL as string) || "";
    const navigate = useNavigate();
    const { teamId, school_id } = useParams();

    const teamIdNum = Number(teamId);
    const schoolIdNum = Number(school_id);
    const isAdminMode = Number.isFinite(schoolIdNum) && schoolIdNum > 0;
    const managedSchoolId = isAdminMode ? schoolIdNum : null;

    const [team, setTeam] = useState<TeamDashboardTeam | null>(null);
    const [projects, setProjects] = useState<ProjectObject[]>([]);
    const [competitionSchedule, setCompetitionSchedule] =
        useState<CompetitionSchedule | null>(null);
    const [now, setNow] = useState<Date>(() => new Date());
    const [summaryByProject, setSummaryByProject] = useState<Record<number, TeamProblemSummary>>(
        {}
    );
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [pageError, setPageError] = useState<string>("");
    const [pageNotice, setPageNotice] = useState<string>("");
    const [schoolName, setSchoolName] = useState<string>("");

    function authConfig() {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }

    function downloadAssignment(projectId: number) {
        if (!projectId || projectId <= 0) return;

        axios
            .get(`${API}/projects/getAssignmentDescription?project_id=${projectId}`, {
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
        const intervalId = window.setInterval(() => {
            setNow(new Date());
        }, 10000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, []);

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

        const [teamResult, projectsResult, summaryResult, scheduleResult] =
            await Promise.allSettled([
                axios.get<ApiTeam[]>(
                    `${API}/teams/byschool/details`,
                    {
                        ...authConfig(),
                        params: managedSchoolId ? { school_id: managedSchoolId } : undefined,
                    }
                ),
                axios.get<ProjectObject[]>(`${API}/projects/all_projects`, authConfig()),
                axios.get(`${API}/teams/submissions/summary`, {
                    ...authConfig(),
                    params: {
                        team_id: teamIdNum,
                        ...(managedSchoolId ? { school_id: managedSchoolId } : {}),
                    },
                }),
                fetchCompetitionSchedule(API),
            ]);

        if (teamResult.status === "fulfilled") {
            const allTeams = Array.isArray(teamResult.value.data) ? teamResult.value.data : [];
            const selectedTeam = allTeams.find((t) => t.id === teamIdNum) || null;

            if (!selectedTeam) {
                setTeam(null);
                setPageError("Team not found.");
            } else {
                setTeam({
                    id: selectedTeam.id,
                    name: selectedTeam.name,
                    division: selectedTeam.division,
                    teamNumber: selectedTeam.teamNumber,
                    isOnline: selectedTeam.isOnline,
                });
            }
        } else {
            const msg =
                (teamResult.reason as any)?.response?.data?.message ||
                (teamResult.reason as any)?.message ||
                "Failed to load team information.";
            setTeam(null);
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
            setProjects([]);
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

        if (scheduleResult.status === "fulfilled") {
            setCompetitionSchedule(scheduleResult.value);
        } else {
            setCompetitionSchedule(null);
            setPageError((prev) => prev || "Failed to load competition schedule.");
        }

        setIsLoading(false);
    }

    const submissions = useMemo(() => {
        const visibleProjects = filterProjectsForCurrentStage(
            projects,
            competitionSchedule,
            now
        );
        return buildTeamSubmissionViewModels(visibleProjects, summaryByProject);
    }, [projects, summaryByProject, competitionSchedule, now]);

    const teamManagePath = isAdminMode
        ? `/admin/${managedSchoolId}/team-manage`
        : `/teacher/team-manage`;

    const teamSubmissionsPath = isAdminMode
        ? `/admin/${managedSchoolId}/team-manage/${teamIdNum}/submissions`
        : `/teacher/team-manage/${teamIdNum}/submissions`;

    const breadcrumbs = isAdminMode
        ? [
            { label: "Admin Menu", to: "/admin" },
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
            { label: "Admin Menu", to: "/admin" },
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
        <ProblemSubmissionsDashboard
            helmetTitle={isAdminMode ? "[Admin] Abacus" : "Abacus"}
            menuProps={{}}
            breadcrumbs={breadcrumbs}
            breadcrumbTrailingSeparator={!managedSchoolId}
            dashboardTitle={dashboardTitle}
            team={team}
            fallbackTeamName={`Team ${teamIdNum}`}
            fallbackTeamNumber={teamIdNum}
            pageError={pageError}
            pageNotice={pageNotice}
            isLoading={isLoading}
            submissions={submissions}
            getTopActions={(vm) => [
                {
                    key: "instructions",
                    label: "Download Instructions",
                    icon: <FaDownload aria-hidden="true" />,
                    variant: "highlight",
                    title: "Download assignment instructions",
                    onClick: () => {
                        downloadAssignment(vm.project.Id);
                    },
                },
            ]}
            getActions={(vm) => {
                const canViewOutput = vm.summary.latestSubmissionId !== null;

                return [
                    {
                        key: "output",
                        label: "See output",
                        icon: <FaFileAlt aria-hidden="true" />,
                        disabled: !canViewOutput,
                        title: canViewOutput
                            ? "View the latest submission output"
                            : "A submission is required to view output.",
                        onClick: () => {
                            if (!canViewOutput || vm.summary.latestSubmissionId === null) return;

                            navigate(`${teamSubmissionsPath}/${vm.summary.latestSubmissionId}`, {
                                state: {
                                    breadcrumbItems: submissionViewBreadcrumbs,
                                },
                            });
                        },
                    },
                ];
            }}
            emptyStateMessage="No problems are available yet. Check back soon!"
        />
    );
}