import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

type TeamMeResponse = {
    division?: string | null;
};

export default function StudentProjectSelection() {
    const apiBase = (import.meta.env.VITE_API_URL as string) || "";
    const navigate = useNavigate();
    const [pageError, setPageError] = useState<string>("");

    function authConfig() {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }

    useEffect(() => {
        let mounted = true;

        async function resolveDestination() {
            try {
                const res = await axios.get<TeamMeResponse>(`${apiBase}/teams/me`, authConfig());
                const division = String(res.data?.division || "").trim().toLowerCase();

                if (!mounted) return;

                if (division === "gold") {
                    navigate("/student/gold/problems", { replace: true });
                    return;
                }

                if (division === "eagle") {
                    navigate("/student/eagle-submissions", { replace: true });
                    return;
                }

                navigate("/student/blue/problems", { replace: true });
            } catch (err: any) {
                if (!mounted) return;
                const msg =
                    err?.response?.data?.message ||
                    err?.message ||
                    "Failed to determine your team division.";
                setPageError(msg);
            }
        }

        resolveDestination();

        return () => {
            mounted = false;
        };
    }, [apiBase, navigate]);

    return (
        <div style={{ padding: "24px" }}>
            {pageError || "Loading your division-specific problem page..."}
        </div>
    const emptyStateMessage =
        viewerStage === "over"
            ? "Submissions will unlock 24 hours after the competition ends."
            : "Problems will appear here once they are available.";

    const breadcrumbs = [{ label: "Student Problem Select" }];

    const submissionViewBreadcrumbs = [
        { label: "Student Problem Select", to: "/student/problems" },
    ];
    

    return (
        <ProblemSubmissionsDashboard
            helmetTitle="Abacus"
            menuProps={{ 
                variant: "app", 
                onRequestHelp: () => navigate("/student/help-requests") 
            }}
            breadcrumbs={breadcrumbs}
            breadcrumbTrailingSeparator={true}
            stageStatusAudience="student"
            dashboardTitle={
                team?.name
                    ? `Student Problem Select: ${team.name}`
                    : "Student Problem Select"
            }
            team={team}
            fallbackTeamName="Problem Select"
            fallbackTeamNumber={team?.teamNumber ?? null}
            pageError={pageError}
            pageNotice={resolvedPageNotice}
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
            emptyStateMessage={emptyStateMessage}
        />
        
    );
}