// AdminProjectList.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import {
    FaPlusCircle,
    FaEdit,
    FaEye,
    FaChevronUp,
    FaChevronDown,
    FaArrowsAlt ,
} from "react-icons/fa";
import axios from "axios";

import "../../styling/AdminProjectList.scss";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";
import MenuComponent from "../components/MenuComponent";
import {
    fetchCompetitionSchedule,
    getVisibleProjectType,
    type CompetitionSchedule,
} from "../components/CompetitionStageStatus";

type ProjectType = "competition" | "practice" | "none";
type ReorderableProjectType = Exclude<ProjectType, "none">;

type ProjectObject = {
    Id: number;
    Name: string;
    Type: ProjectType;
    OrderIndex: number | null;
    NotSubmittedCount: number;
    SubmittedAtLeastOnceCount: number;
    PassingAllTestcasesCount: number;
};

type ProjectSection = {
    type: ProjectType;
    title: string;
    emptyText: string;
    projects: ProjectObject[];
};

type RawProjectObject = Record<string, unknown>;

const REORDER_BUTTON_LABELS: Record<ReorderableProjectType, string> = {
    competition: "Reorder Competition Problems",
    practice: "Reorder Practice Problems",
};

const REORDER_MODAL_TITLES: Record<ReorderableProjectType, string> = {
    competition: "Reorder Competition Problems",
    practice: "Reorder Practice Problems",
};

function sortProjectsByOrderIndex(projects: ProjectObject[]) {
    return [...projects].sort((a, b) => {
        if (a.OrderIndex === null && b.OrderIndex === null) return 0;
        if (a.OrderIndex === null) return 1;
        if (b.OrderIndex === null) return -1;
        return a.OrderIndex - b.OrderIndex;
    });
}

function toNumber(value: unknown, fallback = 0) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return fallback;
}

function toNullableNumber(value: unknown) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsed = toNumber(value, Number.NaN);
    return Number.isFinite(parsed) ? parsed : null;
}

function toProjectType(value: unknown): ProjectType {
    return value === "competition" || value === "practice" || value === "none"
        ? value
        : "none";
}

function getCountValue(source: RawProjectObject, keys: string[], fallback = 0) {
    for (const key of keys) {
        if (key in source) {
            return toNumber(source[key], fallback);
        }
    }

    return fallback;
}

function normalizeProject(raw: RawProjectObject): ProjectObject {
    return {
        Id: toNumber(raw.Id, 0),
        Name: typeof raw.Name === "string" ? raw.Name : "",
        Type: toProjectType(raw.Type),
        OrderIndex: toNullableNumber(raw.OrderIndex),
        NotSubmittedCount: getCountValue(raw, [
            "NotSubmittedCount",
            "notSubmittedCount",
            "NotSubmitted",
            "notSubmitted",
        ]),
        SubmittedAtLeastOnceCount: getCountValue(raw, [
            "SubmittedAtLeastOnceCount",
            "submittedAtLeastOnceCount",
            "SubmittedCount",
            "submittedCount",
            "TotalSubmissions",
            "totalSubmissions",
        ]),
        PassingAllTestcasesCount: getCountValue(raw, [
            "PassingAllTestcasesCount",
            "passingAllTestcasesCount",
            "PassingCount",
            "passingCount",
        ]),
    };
}

export default function AdminProjectList() {
    const API = (import.meta.env.VITE_API_URL as string) || "";
    const [projects, setProjects] = useState<ProjectObject[]>([]);
    const [schedule, setSchedule] = useState<CompetitionSchedule | null>(null);
    const [now, setNow] = useState<Date>(() => new Date());

    const [orderModal, setOrderModal] = useState<{
        projectType: ReorderableProjectType;
        title: string;
        projects: ProjectObject[];
        isSaving: boolean;
    } | null>(null);

    const bodyOverflowRef = useRef<string | null>(null);

    function authConfig() {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }

    useEffect(() => {
        const hasModal = !!orderModal;

        if (hasModal) {
            if (bodyOverflowRef.current === null) {
                bodyOverflowRef.current = document.body.style.overflow;
            }
            document.body.style.overflow = "hidden";
        } else if (bodyOverflowRef.current !== null) {
            document.body.style.overflow = bodyOverflowRef.current;
            bodyOverflowRef.current = null;
        }
    }, [orderModal]);

    useEffect(() => {
        return () => {
            if (bodyOverflowRef.current !== null) {
                document.body.style.overflow = bodyOverflowRef.current;
                bodyOverflowRef.current = null;
            }
        };
    }, []);

    async function fetchProjects() {
        try {
            const res = await axios.get(`${API}/projects/all_projects`, authConfig());
            const data = Array.isArray(res.data) ? (res.data as RawProjectObject[]) : [];
            setProjects(data.map(normalizeProject));
        } catch (err) {
            console.log(err);
        }
    }

    useEffect(() => {
        fetchProjects();
    }, [API]);

    useEffect(() => {
        let active = true;

        fetchCompetitionSchedule(API)
            .then((data) => {
                if (!active) return;
                setSchedule(data);
            })
            .catch((err) => {
                console.log(err);
                if (!active) return;
                setSchedule(null);
            });

        return () => {
            active = false;
        };
    }, [API]);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setNow(new Date());
        }, 30000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, []);

    const competitionProjects = useMemo(() => {
        return sortProjectsByOrderIndex(
            projects.filter((project) => project.Type === "competition")
        );
    }, [projects]);

    const practiceProjects = useMemo(() => {
        return sortProjectsByOrderIndex(
            projects.filter((project) => project.Type === "practice")
        );
    }, [projects]);

    const noneProjects = useMemo(() => {
        return projects.filter((project) => project.Type === "none");
    }, [projects]);

    const sections = useMemo<ProjectSection[]>(
        () => [
            {
                type: "competition",
                title: "Competition Problems",
                emptyText: "No competition problems yet.",
                projects: competitionProjects,
            },
            {
                type: "practice",
                title: "Practice Problems",
                emptyText: "No practice problems yet.",
                projects: practiceProjects,
            },
            {
                type: "none",
                title: "Other Problems",
                emptyText: "No uncategorized problems yet.",
                projects: noneProjects,
            },
        ],
        [competitionProjects, practiceProjects, noneProjects]
    );

    const activeTableType = useMemo(() => {
        if (!schedule) return null;
        return getVisibleProjectType(schedule, now, "student");
    }, [schedule, now]);

    function openOrderModal(
        projectType: ReorderableProjectType,
        sectionProjects: ProjectObject[]
    ) {
        setOrderModal({
            projectType,
            title: REORDER_MODAL_TITLES[projectType],
            projects: sectionProjects,
            isSaving: false,
        });
    }

    async function confirmOrderModal() {
        if (!orderModal) return;

        const order = orderModal.projects.map((project) => project.Id);
        setOrderModal({ ...orderModal, isSaving: true });

        try {
            await axios.post(
                `${API}/projects/reorder`,
                {
                    id_order: order,
                    project_type: orderModal.projectType,
                },
                authConfig()
            );
            await fetchProjects();
        } catch (err) {
            alert("Failed to save project order.");
            console.log(err);
        } finally {
            setOrderModal(null);
        }
    }

    function moveProject(index: number, direction: "up" | "down") {
        if (!orderModal) return;

        const newProjects = [...orderModal.projects];
        const targetIndex = direction === "up" ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= newProjects.length) return;

        [newProjects[index], newProjects[targetIndex]] = [
            newProjects[targetIndex],
            newProjects[index],
        ];

        setOrderModal({ ...orderModal, projects: newProjects });
    }

    function renderProjectSection(section: ProjectSection) {
        const isCompetition = section.type === "competition";
        const showOrderColumn =
            section.type === "competition" || section.type === "practice";
        const showTableStatus = section.type === "competition" || section.type === "practice";
        const isActiveTable = showTableStatus && activeTableType === section.type;
        const reorderableType: ReorderableProjectType | null =
            section.type === "none" ? null : section.type;
        const colSpan = showOrderColumn ? 7 : 6;

        return (
            <section
                className={`projects-container problem-section problem-section--${section.type}`}
                key={section.type}
            >
                <div className="problem-section__header">
                    <div className="problem-section__header-left">
                        <div className="problem-section__title-row">
                            <div className="problem-section__title">{section.title}</div>

                            {showTableStatus && (
                                <span
                                    className={`table-status-badge ${isActiveTable ? "is-active" : "is-inactive"}`}
                                    title={
                                        isActiveTable
                                            ? "This problem table is currently active to students"
                                            : "This problem table is not currently active to students"
                                    }
                                >
                                    {isActiveTable ? "Active to students" : "Inactive"}
                                </span>
                            )}
                        </div>

                        <div className="problem-section__meta">
                            {section.projects.length} problem
                            {section.projects.length === 1 ? "" : "s"}
                        </div>
                    </div>

                    {reorderableType && (
                        <button
                            className="button button-reorder"
                            onClick={() => openOrderModal(reorderableType, section.projects)}
                            disabled={section.projects.length < 2}
                        >
                            <FaArrowsAlt  aria-hidden="true" />
                            <span className="button-text">
                                {REORDER_BUTTON_LABELS[reorderableType]}
                            </span>
                        </button>
                    )}
                </div>

                <table className="projects-table">
                    <thead className="projects-table-head">
                        <tr className="projects-table-row">
                            {showOrderColumn && (
                                <th className="projects-table-header project-order">#</th>
                            )}
                            <th className="projects-table-header project-name">Problem</th>
                            <th className="projects-table-header project-metric">Not Submitted</th>
                            <th className="projects-table-header project-metric">
                                Submitted
                            </th>
                            <th className="projects-table-header project-metric">
                                Passing All Testcases
                            </th>
                            <th className="projects-table-header project-review">Review</th>
                            <th className="projects-table-header project-edit">Edit</th>
                        </tr>
                    </thead>

                    <tbody className="projects-table-body">
                        {section.projects.length === 0 ? (
                            <tr className="project-row">
                                <td className="project-empty" colSpan={colSpan}>
                                    {section.emptyText}
                                </td>
                            </tr>
                        ) : (
                            section.projects.map((project, index) => (
                                <tr className="project-row" key={project.Id}>
                                    {showOrderColumn && (
                                        <td className="project-order">
                                            {project.OrderIndex ?? index + 1}
                                        </td>
                                    )}

                                    <td className="project-name">{project.Name}</td>

                                    <td className="project-metric">
                                        <span className="project-metric__value">
                                            {project.NotSubmittedCount}
                                        </span>
                                    </td>

                                    <td className="project-metric">
                                        <span className="project-metric__value">
                                            {project.SubmittedAtLeastOnceCount}
                                        </span>
                                    </td>

                                    <td className="project-metric">
                                        <span className="project-metric__value">
                                            {project.PassingAllTestcasesCount}
                                        </span>
                                    </td>

                                    <td className="project-review">
                                        <Link
                                            className="button button-review"
                                            to={`/admin/problem/${project.Id}/review`}
                                            aria-label={`Review submissions for ${project.Name}`}
                                        >
                                            <FaEye aria-hidden="true" />
                                            <span className="button-text">Review</span>
                                        </Link>
                                    </td>

                                    <td className="project-edit">
                                        <Link
                                            className="button button-edit"
                                            to={`/admin/problem/manage/${project.Id}`}
                                        >
                                            <FaEdit aria-hidden="true" />
                                            <span className="button-text">Edit</span>
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </section>
        );
    }

    return (
        <>
            <Helmet>
                <title>[Admin] Abacus</title>
            </Helmet>

            <MenuComponent />

            <div className="admin-project-list-root">
                <DirectoryBreadcrumbs
                    items={[
                        { label: "Admin Menu", to: "/admin" },
                        { label: "Problem List" },
                    ]}
                />

                <div className="pageTitle">Problem List</div>

                <div className="admin-project-list-content">
                    <div className="projects-sections">
                        {sections.map((section) => renderProjectSection(section))}
                    </div>

                    <Link className="button button-create-assignment" to="/admin/problem/manage/0">
                        <FaPlusCircle aria-hidden="true" />
                        <span className="button-text">Create new problem</span>
                    </Link>
                </div>
            </div>

            {orderModal && (
                <div className="modal-overlay" aria-modal="true">
                    <div className="modal modal--reorder">
                        <div className="modal__title">{orderModal.title}</div>

                        <div className="modal__body">
                            <div className="modal__subtitle">
                                <div className="muted">
                                    {orderModal.projectType === "competition"
                                        ? "Click the arrows to reorder the competition problems."
                                        : "Click the arrows to reorder the practice problems."}
                                </div>
                                <div className="muted">
                                    {orderModal.projectType === "competition"
                                        ? `${orderModal.projects.length} / 10`
                                        : `${orderModal.projects.length} total`}
                                </div>
                            </div>

                            <div className="reorder-list callout">
                                {orderModal.projects.map((project, index) => (
                                    <div className="reorder__row" key={project.Id}>
                                        <div className="reorder__index">{index + 1}.</div>

                                        <div className="reorder-card">
                                            <span className="reorder-card__title">
                                                {project.Name}
                                            </span>
                                        </div>

                                        <div className="reorder-card__actions">
                                            {index > 0 && (
                                                <button
                                                    type="button"
                                                    className="reorder-btn"
                                                    onClick={() => moveProject(index, "up")}
                                                >
                                                    <FaChevronUp
                                                        className="reorder-btn__icon"
                                                        aria-hidden="true"
                                                    />
                                                </button>
                                            )}

                                            {index < orderModal.projects.length - 1 && (
                                                <button
                                                    type="button"
                                                    className="reorder-btn"
                                                    onClick={() => moveProject(index, "down")}
                                                >
                                                    <FaChevronDown
                                                        className="reorder-btn__icon"
                                                        aria-hidden="true"
                                                    />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="modal__actions reorder__actions">
                            <button className="btn" onClick={() => setOrderModal(null)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={confirmOrderModal}
                                disabled={orderModal.isSaving}
                            >
                                {orderModal.isSaving ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}