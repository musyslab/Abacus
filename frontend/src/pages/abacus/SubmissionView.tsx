import { useLocation, useParams } from "react-router-dom"
import CodeDiffView from "../components/CodeDiffView"
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs"
import MenuComponent from "../components/MenuComponent"
import { Helmet } from "react-helmet"
import { useEffect, useState } from "react"
import axios from "axios"
import "../../styling/SubmissionView.scss";

type Item = {
    id: number;
    name: string;
}

type BreadcrumbItem = {
    label: string;
    to?: string;
}

type Role = "student" | "teacher" | "admin"

type SubmissionMetadata = {
    id: number;
    userId: number;
    role: Role;
    project: Item;
    school: Item;
    team: Item;
    memberId: number | null;
    time: string;
}

type SubmissionViewLocationState = {
    breadcrumbItems?: BreadcrumbItem[];
}

export default function SubmissionView() {
    const API = (import.meta.env.VITE_API_URL as string) || "";

    const location = useLocation()
    const { id, school_id, teamId, problemId } = useParams<{
        id: string;
        school_id?: string;
        teamId?: string;
        problemId?: string;
    }>()

    const submissionId = id !== undefined ? parseInt(id, 10) : -1

    function authConfig() {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }

    const [metadata, setMetadata] = useState<SubmissionMetadata | null>(null)
    const locationState = (location.state as SubmissionViewLocationState | null) ?? null

    const isProblemReviewSubmissionRoute =
        !!problemId && location.pathname.startsWith(`/admin/problem/${problemId}/review/submission/`)

    const isAdminUploadSubmissionRoute =
        location.pathname.startsWith("/admin/upload/submission/")

    const fallbackBreadcrumbItems: BreadcrumbItem[] = (() => {
        if (isProblemReviewSubmissionRoute) {
            return [
                { label: "Admin Menu", to: "/admin" },
                { label: "Submissions", to: `/admin/problem/${problemId}/review` },
            ]
        }

        if (isAdminUploadSubmissionRoute) {
            return [
                { label: "Admin Menu", to: "/admin" },
                { label: "Blue Division Admin Upload", to: "/admin/upload" },
            ]
        }

        if (school_id && teamId && location.pathname.startsWith(`/admin/${school_id}/team-manage/${teamId}/submissions/`)) {
            return [
                { label: "Admin Menu", to: "/admin" },
                { label: "School List", to: "/admin/schools" },
                { label: "Team Manage", to: `/admin/${school_id}/team-manage` },
                { label: "Team Submissions", to: `/admin/${school_id}/team-manage/${teamId}/submissions` },
            ]
        }

        if (teamId && location.pathname.startsWith(`/teacher/team-manage/${teamId}/submissions/`)) {
            return [
                { label: "Team Manage", to: "/teacher/team-manage" },
                { label: "Team Submissions", to: `/teacher/team-manage/${teamId}/submissions` },
            ]
        }

        return []
    })()

    const breadcrumbItems =
        locationState?.breadcrumbItems && locationState.breadcrumbItems.length > 0
            ? [...locationState.breadcrumbItems, { label: "Submission View" }]
            : [...fallbackBreadcrumbItems, { label: "Submission View" }]

    useEffect(() => {
        async function fetchMetadata() {
            try {
                const res = await axios.get<SubmissionMetadata>(`${API}/submissions/data?id=${submissionId}`, authConfig())
                setMetadata(res.data)
            } catch (e) {
                console.error(e)
                alert("Failed to fetch submission metadata.")
            }
        }

        fetchMetadata()
    }, [API, submissionId])

    const projectName = metadata?.project.name || ""
    const isAdminMode = metadata?.role === "admin"

    return (
        <>
            <Helmet>
                <title>{isAdminMode ? "[Admin] Abacus" : "Abacus"}</title>
            </Helmet>

            <MenuComponent />

            <div className="submission-view-root">
                <DirectoryBreadcrumbs
                    items={breadcrumbItems} trailingSeparator={true}
                />

                <div className="pageTitle">{projectName ? `${projectName} Submission Results` : "Submission Results"}</div>

                <div className="submission-view-content">
                    <div className="submission-details">
                        <div className="submission-details-content">
                            {metadata ? (
                                <div className="submission-details-bar">
                                    {isAdminMode && (
                                        <div className="meta-chip">
                                            <span className="meta-label">School:</span>
                                            <span className="meta-value">{metadata.school.name}</span>
                                        </div>
                                    )}

                                    {metadata.role !== "student" && (
                                        <div className="meta-chip">
                                            <span className="meta-label">Team:</span>
                                            <span className="meta-value">{metadata.team.name}</span>
                                        </div>
                                    )}

                                    <div className="meta-chip">
                                        <span className="meta-label">Submitted by:</span>
                                        <span className="meta-value">Member {metadata.memberId}</span>
                                    </div>

                                    <div className="meta-chip">
                                        <span className="meta-label">Submitted at:</span>
                                        <span className="meta-value">{metadata.time}</span>
                                    </div>
                                </div>
                            ) : (
                                <div>Loading submission details...</div>
                            )}
                        </div>
                    </div>
                    <CodeDiffView submissionId={submissionId} revealHiddenOutput={isAdminMode} />
                </div>
            </div>
        </>
    )
}