// AdminProblemSubmissions.tsx
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import Select from "react-select";
import { FaDownload, FaEye } from "react-icons/fa";

import "../../styling/AdminProblemSubmissions.scss";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";
import MenuComponent from "../components/MenuComponent";

type ReviewStatus = "passed" | "failed";
type SortMode = "alphabetical" | "lastsubmitted";

type ReviewRow = {
    teamId: number;
    schoolId: number;
    submissionId: number;
    schoolName: string;
    teamName: string;
    status: ReviewStatus;
    submittedAt: string;
    submittedAtLabel: string;
};

type ReviewResponse = {
    projectId: number;
    projectName: string;
    rows: ReviewRow[];
};

type SelectOption = {
    value: string;
    label: string;
};

export default function AdminProblemSubmissions() {
    const API = (import.meta.env.VITE_API_URL as string) || "";
    const { id } = useParams<{ id: string }>();
    const projectId = Number(id);

    const [rows, setRows] = useState<ReviewRow[]>([]);
    const [projectName, setProjectName] = useState("");
    const [selectedSchoolId, setSelectedSchoolId] = useState("");
    const [sortBy, setSortBy] = useState<SortMode>("alphabetical");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    function authConfig() {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }

    function buildCombinedName(row: ReviewRow) {
        const school = row.schoolName?.trim() || `School ${row.schoolId}`;
        const team = row.teamName?.trim() || `Team ${row.teamId}`;
        return `${school} / ${team}`;
    }

    function formatSubmittedAt(value: string, fallbackLabel?: string) {
        if (!value || value === "N/A") {
            return fallbackLabel || "N/A";
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return fallbackLabel || value;
        }

        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "2-digit",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        }).format(parsed);
    }

    useEffect(() => {
        let cancelled = false;

        async function fetchReviewRows() {
            if (!Number.isFinite(projectId) || projectId <= 0) {
                setError("Invalid problem id.");
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError("");

            try {
                const res = await axios.get<ReviewResponse>(
                    `${API}/submissions/problem-review?project_id=${projectId}`,
                    authConfig()
                );

                if (cancelled) return;

                setRows(Array.isArray(res.data?.rows) ? res.data.rows : []);
                setProjectName(res.data?.projectName || "");
            } catch (err) {
                if (cancelled) return;
                console.error(err);
                setError("Failed to load review data.");
                setRows([]);
                setProjectName("");
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        fetchReviewRows();

        return () => {
            cancelled = true;
        };
    }, [API, projectId]);

    const schoolOptions = useMemo<SelectOption[]>(() => {
        const bySchool = new Map<string, string>();

        rows.forEach((row) => {
            const key = String(row.schoolId || "");
            const label = row.schoolName?.trim() || `School ${row.schoolId}`;
            if (!bySchool.has(key)) {
                bySchool.set(key, label);
            }
        });

        return [
            { value: "", label: "All schools" },
            ...Array.from(bySchool.entries())
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([value, label]) => ({ value, label })),
        ];
    }, [rows]);

    const filteredRows = useMemo(() => {
        const timeValue = (value: string) => {
            const parsed = Date.parse(value);
            return Number.isNaN(parsed) ? -Infinity : parsed;
        };

        let next = rows;
        if (selectedSchoolId !== "") {
            next = next.filter((row) => String(row.schoolId) === selectedSchoolId);
        }

        if (sortBy === "lastsubmitted") {
            return [...next].sort((a, b) => timeValue(b.submittedAt) - timeValue(a.submittedAt));
        }

        return [...next].sort((a, b) => buildCombinedName(a).localeCompare(buildCombinedName(b)));
    }, [rows, selectedSchoolId, sortBy]);

    async function downloadSubmission(row: ReviewRow) {
        try {
            const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
            const res = await axios.get<Blob>(`${API}/submissions/codefinder?id=${row.submissionId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                responseType: "blob",
            });

            const headers = res.headers as Record<string, string | undefined>;
            const contentDisposition = String(headers["content-disposition"] ?? "");
            const match = /filename\*?=(?:UTF-8''|")?([^\";]+)\"?/i.exec(contentDisposition);
            const headerName = match ? decodeURIComponent(match[1]) : "";
            const fallbackName = `submission_${row.submissionId}.zip`;
            const fileName = headerName || fallbackName;

            const anchor = document.createElement("a");
            anchor.href = URL.createObjectURL(res.data);
            anchor.download = fileName;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(anchor.href);
        } catch (err) {
            console.error(err);
            window.alert("Failed to download submission.");
        }
    }

    const selectedSchoolOption =
        schoolOptions.find((option) => option.value === selectedSchoolId) ?? schoolOptions[0];

    const pageTitle = projectName ? `Submissions: ${projectName}` : "Submissions";

    return (
        <>
            <Helmet>
                <title>[Admin] Abacus</title>
            </Helmet>

            <MenuComponent
                showProblemList={true}
                showAdminUpload={true}
            />

            <div className="admin-problem-review-root">
                <DirectoryBreadcrumbs
                    items={[
                        { label: "School List", to: "/admin/schools" },
                        { label: "Problem List", to: "/admin/problems" },
                        { label: "Submissions" },
                    ]}
                />

                <div className="pageTitle">{pageTitle}</div>

                <div className="problem-review-content">
                    <div className="problem-review-panel">
                        <div className="problem-review-toolbar">
                            <div className="problem-review-toolbar__group">
                                <label className="problem-review-toolbar__label">School:</label>
                                <div className="problem-review-filter">
                                    <Select
                                        classNamePrefix="problem-review-select"
                                        options={schoolOptions}
                                        value={selectedSchoolOption}
                                        onChange={(option) => setSelectedSchoolId(option?.value ?? "")}
                                        isSearchable={true}
                                    />
                                </div>
                            </div>

                            <div className="problem-review-toolbar__group problem-review-toolbar__group--sort">
                                <label className="problem-review-toolbar__label" htmlFor="problem-review-sort">
                                    Sort by:
                                </label>
                                <select
                                    id="problem-review-sort"
                                    className="problem-review-sort"
                                    value={sortBy}
                                    onChange={(event) => setSortBy(event.target.value as SortMode)}
                                >
                                    <option value="alphabetical">Alphabetical</option>
                                    <option value="lastsubmitted">Last submitted</option>
                                </select>
                            </div>
                        </div>

                        {isLoading && <div className="problem-review-state">Loading review data...</div>}

                        {!isLoading && error && (
                            <div className="problem-review-state problem-review-state--error">{error}</div>
                        )}

                        {!isLoading && !error && (
                            <div
                                className="problem-review-table-wrap"
                                role="region"
                                aria-label="Problem submissions table"
                                tabIndex={0}
                            >
                                <table className="problem-review-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Last Submitted</th>
                                            <th>Status</th>
                                            <th>View</th>
                                            <th>Download</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {filteredRows.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="problem-review-empty">
                                                    No submissions found for this problem.
                                                </td>
                                            </tr>
                                        )}

                                        {filteredRows.map((row) => {
                                            const canView = row.schoolId > 0 && row.teamId > 0 && row.submissionId > 0;
                                            const canDownload = row.submissionId > 0;

                                            return (
                                                <tr key={`${row.teamId}-${row.submissionId}`}>
                                                    <td className="problem-review-name-cell">
                                                        <div className="problem-review-name">{buildCombinedName(row)}</div>
                                                    </td>

                                                    <td className="problem-review-submitted-cell">
                                                        {formatSubmittedAt(row.submittedAt, row.submittedAtLabel)}
                                                    </td>

                                                    <td
                                                        className={
                                                            row.status === "passed"
                                                                ? "problem-review-status-cell problem-review-status-cell--passed"
                                                                : "problem-review-status-cell problem-review-status-cell--failed"
                                                        }
                                                    >
                                                        {row.status === "passed" ? "PASSED" : "FAILED"}
                                                    </td>

                                                    <td className="problem-review-action-cell">
                                                        {canView ? (
                                                            <Link
                                                                className="problem-review-action problem-review-action--view"
                                                                to={`/admin/problem/${projectId}/review/submission/${row.submissionId}`}
                                                            >
                                                                <FaEye aria-hidden="true" />
                                                                <span>View</span>
                                                            </Link>
                                                        ) : (
                                                            <span className="problem-review-unavailable">N/A</span>
                                                        )}
                                                    </td>

                                                    <td className="problem-review-action-cell">
                                                        <button
                                                            type="button"
                                                            className="problem-review-action problem-review-action--download"
                                                            onClick={() => downloadSubmission(row)}
                                                            disabled={!canDownload}
                                                        >
                                                            <FaDownload aria-hidden="true" />
                                                            <span>Download</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}