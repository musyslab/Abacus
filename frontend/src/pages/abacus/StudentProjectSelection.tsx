import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import HelpModal from "../components/HelpModal";
import { useNavigate } from "react-router-dom";
import { FaDownload, FaFileAlt, FaUpload } from "react-icons/fa";

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

interface CreateHelpRequestData {
    problemId?: number | null;
    problemName: string;
    description: string;
}

export default function StudentProjectSelection() {
    const apiBase = (import.meta.env.VITE_API_URL as string) || "";
    const navigate = useNavigate();

    const [team, setTeam] = useState<TeamDashboardTeam | null>(null);
    const [projects, setProjects] = useState<ProjectObject[]>([]);
    const [summaryByProject, setSummaryByProject] = useState<Record<number, TeamProblemSummary>>(
        {}
    );
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [pageError, setPageError] = useState<string>("");
    const [pageNotice, setPageNotice] = useState<string>("");
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

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
                setSummaryByProject({});
                setPageError("Unable to determine the current team.");
                setIsLoading(false);
                return;
            }

            setTeam(resolvedTeam);

            const [projectsResult, summaryResult] = await Promise.allSettled([
                axios.get<ProjectObject[]>(`${apiBase}/projects/all_projects`, authConfig()),
                axios.get(`${apiBase}/teams/submissions/summary`, {
                    ...authConfig(),
                    params: {
                        team_id: resolvedTeam.id,
                    },
                }),
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

            if (summaryResult.status === "fulfilled") {
                const rows = normalizeSummaryRows(summaryResult.value.data);
                setSummaryByProject(buildSummaryMap(rows));
            } else {
                setSummaryByProject({});
                setPageNotice(
                    "Problem list loaded, but the team submission summary endpoint is not returning data yet. Add GET /teams/submissions/summary to populate testcase totals and latest submission details."
                );
            }
        } catch (err: any) {
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                "Failed to load your team information.";
            setTeam(null);
            setProjects([]);
            setSummaryByProject({});
            setPageError(msg);
        } finally {
            setIsLoading(false);
        }
    }
    
    const createHelpRequest = async (data: CreateHelpRequestData) => {
        // Note: Adjust the '/submission' prefix if your blueprint is mounted differently!
        const response = await axios.post(
            `${apiBase}/submissions/help-request`, data, authConfig()
        );
        return response.data;
    };
    const handleSubmitHelpRequest = async (data: { problemName: string; description: string; problemId?: number }) => {
        try {
            await createHelpRequest({
                problemName: data.problemName,
                description: data.description,
                problemId: data.problemId // pass this if you have it!
            });
            console.log("Request sent successfully!");
        } catch (error) {
            console.error("Failed to submit request", error);
            throw error; // Let the modal catch this and show the red error box
        }
    };
    const submissions = useMemo(() => {
        return buildTeamSubmissionViewModels(projects, summaryByProject);
    }, [projects, summaryByProject]);

    const breadcrumbs = [{ label: "Student Problem Select" }];

    const submissionViewBreadcrumbs = [
        { label: "Student Problem Select", to: "/student/problems" },
    ];
    

    return (
        <>
            <HelpModal 
                isOpen={isHelpModalOpen}
                onClose={() => setIsHelpModalOpen(false)}
                onSubmitRequest={handleSubmitHelpRequest}
                availableProblems={projects.map(project => ({id: project.Id.toString(), name: project.Name}))}
            />

            <ProblemSubmissionsDashboard
                helmetTitle="Abacus"
                menuProps={{ 
                    variant: "app", 
                    onRequestHelp: () => setIsHelpModalOpen(true) 
                }}
                breadcrumbs={breadcrumbs}
                breadcrumbTrailingSeparator={true}
                dashboardTitle={
                    team?.name
                        ? `Student Problem Select: ${team.name}`
                        : "Student Problem Select"
                }
                team={team}
                fallbackTeamName="Problem Select"
                fallbackTeamNumber={team?.teamNumber ?? null}
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
                            key: "upload",
                            label: "Upload program",
                            icon: <FaUpload aria-hidden="true" />,
                            variant: "primary",
                            title: "Upload a submission for this problem",
                            onClick: () => {
                                navigate(`/student/${vm.project.Id}/submit`);
                            },
                        },
                        {
                            key: "output",
                            label: "See output",
                            icon: <FaFileAlt aria-hidden="true" />,
                            variant: "secondary",
                            disabled: !canViewOutput,
                            title: canViewOutput
                                ? "View your latest submission output"
                                : "A submission is required to view output.",
                            onClick: () => {
                                if (!canViewOutput || vm.summary.latestSubmissionId === null) return;

                                navigate(`/submission/${vm.summary.latestSubmissionId}`, {
                                    state: {
                                        breadcrumbItems: submissionViewBreadcrumbs,
                                    },
                                });
                            },
                        },
                    ];
                }}
                emptyStateMessage="Problems will appear here once they are available."
            />
        </>
    );
}