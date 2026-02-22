import { useParams } from "react-router-dom"
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

export default function SubmissionView() {
    const API = (import.meta.env.VITE_API_URL as string) || "";

    const { id } = useParams<{ id: string; }>()
    const submissionId = id !== undefined ? parseInt(id, 10) : -1

    function authConfig() {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }

    const [metadata, setMetadata] = useState<SubmissionMetadata | null>(null)
    const projectName = metadata?.project.name || ""

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

    return (
        <>
            <Helmet>
                <title>Abacus</title>
            </Helmet>

            <MenuComponent/>

            <div className="submission-view-root">
                <DirectoryBreadcrumbs
                    items={[
                        { label: 'Submission View' },
                    ]} trailingSeparator={true}
                />

                <div className="pageTitle">{projectName ? `${projectName} Submission Results` : "Submission Results"}</div>

                <div className="submission-view-content">
                    <div className="submission-details">
                       <div className="submission-details-content">
                        {metadata ? (
                            <div className="submission-details-bar">
                            {metadata.role === "admin" && (
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
                                <span className="meta-label">Member:</span>
                                <span className="meta-value">
                                {metadata.memberId !== null ? metadata.memberId : "N/A"}
                                </span>
                            </div>

                            <div className="meta-chip">
                                <span className="meta-label">Time:</span>
                                <span className="meta-value">{metadata.time}</span>
                            </div>
                            </div>
                        ) : (
                            <div>Loading submission details...</div>
                        )}
                        </div>
                    </div>
                    <CodeDiffView submissionId={submissionId} revealHiddenOutput />
                </div>
            </div>
        </>
  )
}