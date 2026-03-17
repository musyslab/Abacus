// AdminProjectList.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet"
import { Link } from "react-router-dom";
import { FaPlusCircle, FaEdit, FaChevronUp, FaChevronDown } from "react-icons/fa";
import axios from "axios";
import Select from "react-select";

import "../../styling/AdminProjectList.scss";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs"
import MenuComponent from "../components/MenuComponent"

type ProjectType = "competition" | "practice" | "none";

type ProjectObject = {
    Id: number;
    Name: string;
    TotalSubmissions: number;
    Type: ProjectType;
    Difficulty: string;
    OrderIndex: number | null;
}

function sortProjectsByOrderIndex(projects: ProjectObject[]) {
    return projects.sort((a, b) => {
        if (a.OrderIndex === null && b.OrderIndex === null) return 0;
        if (a.OrderIndex === null) return 1;
        if (b.OrderIndex === null) return -1;
        return a.OrderIndex - b.OrderIndex;
    });
}

export default function AdminProjectList() {
    const API = (import.meta.env.VITE_API_URL as string) || "";
    const [projects, setProjects] = useState<ProjectObject[]>([]);
    const [filter, setFilter] = useState<ProjectType | null>(null);

    const [orderModal, setOrderModal] = useState<{
        projects: ProjectObject[];
        isSaving: boolean;
    } | null>(null);

    const bodyOverflowRef = useRef<string | null>(null);

    function authConfig() {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }

    // Handle body overflow when the modal is open, to prevent background scrolling.
    useEffect(() => {
        const hasModal = !!orderModal;
        if (hasModal) {
            if (bodyOverflowRef.current === null) bodyOverflowRef.current = document.body.style.overflow;
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
            const data = res.data as ProjectObject[];
            const sortedData = sortProjectsByOrderIndex(data);
            setProjects(sortedData);
        } catch (err) {
            console.log(err);
        }
    }

    useEffect(() => {
        fetchProjects();
    }, [API]);

    const filteredProjects = useMemo(() => {
        if (!filter) return projects;
        return projects.filter(p => p.Type === filter);
    }, [projects, filter]);

    function openOrderModal() {
        setOrderModal({
            projects: sortProjectsByOrderIndex(projects.filter(p => p.Type === "competition")),
            isSaving: false,
        });
    }

    async function confirmOrderModal() {
        if (!orderModal) return;
        const order = orderModal.projects.map(p => p.Id);
        setOrderModal({ ...orderModal, isSaving: true });
        try {
            const res = await axios.post(`${API}/projects/reorder`, {id_order: order,}, authConfig());
            fetchProjects();
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

        [newProjects[index], newProjects[targetIndex]] = [newProjects[targetIndex], newProjects[index]];
        setOrderModal({ ...orderModal, projects: newProjects });
    }

    const competitionCount = projects.filter(p => p.Type === "competition").length;
    
    return (
    <>
        <Helmet>
            <title>[Admin] Abacus</title>
        </Helmet>

        <MenuComponent
            showProblemList={true}
            showAdminUpload={true}
        />

        <div className="admin-project-list-root">
            <DirectoryBreadcrumbs
                items={[
                    { label: 'School List', to:'/admin/schools' },
                    { label: 'Problem List' },
                ]}
            />
            <div className="pageTitle">Problem List</div>

            <div className="admin-project-list-content">
                <div className="projects-container">
                    <div className="projects-header">
                        <div className="projects-header-actions">
                            <span className="projects-filter-label">Type: </span>
                            <Select
                                className="projects-filter-select"
                                classNamePrefix="projects-select"
                                options={[
                                    { value: "", label: "All" },
                                    { value: "competition", label: "Competition" },
                                    { value: "practice", label: "Practice" },
                                    { value: "none", label: "None" },
                                ]}
                                value={filter ? { value: filter, label: filter.charAt(0).toUpperCase() + filter.slice(1) } : { value: "", label: "All" }}
                                onChange={(option) => setFilter(option ? (option.value as ProjectType) : null)}
                            />

                            <button 
                                className="button button-reorder" 
                                onClick={openOrderModal}
                                disabled={competitionCount < 2}
                            >
                                Reorder Competition Problems
                            </button>
                        </div>
                    </div>
                    <table className="projects-table">
                        <thead className="projects-table-head">
                            <tr className="projects-table-row">
                                <th className="projects-table-header project-order">#</th>
                                <th className="projects-table-header project-name">Problem</th>
                                <th className="projects-table-header project-difficulty">Difficulty</th>
                                <th className="projects-table-header project-submissions">Submissions</th>
                                <th className="projects-table-header project-edit">Edit</th>
                            </tr>
                        </thead>
                        <tbody className="projects-table-body">
                            {filteredProjects.map((project) => {
                                const orderIndex = project.OrderIndex ?? "-";
                                const difficulty = project.Difficulty.toLowerCase();

                                const isCompetition = project.Type === "competition";
                                const isPractice = project.Type === "practice";
                                //const isActive = when a project is available to students

                                return (
                                <tr
                                    className={`project-row ${isCompetition ? "is-active" : ""}`}
                                    key={project.Id}
                                >
                                    <td className="project-order">{orderIndex}</td>
                                    <td className="project-name">
                                        {project.Name}
                                        {isCompetition && (
                                            <span
                                                className="project-badge badge--competition"
                                                title="Competition problem"
                                            >
                                                Competition
                                            </span>
                                        )}
                                        {isPractice && (
                                            <span
                                                className="project-badge badge--practice"
                                                title="Practice problem"
                                            >
                                                Practice
                                            </span>
                                        )}
                                        {isCompetition && (
                                            <span
                                                className="project-badge badge--active"
                                                title="Problem is active to students"
                                            >
                                                ● Active
                                            </span>
                                        )}
                                    </td>
                                    <td className="project-difficulty">
                                        <span className={`project-badge badge--${difficulty}`}>{difficulty}</span>
                                    </td>
                                    <td className="project-submissions">{project.TotalSubmissions}</td>
                                    <td className="project-edit">
                                        <Link className="button button-edit" to={`/admin/problem/manage/${project.Id}`}>
                                            <FaEdit aria-hidden="true" />
                                            <span className="button-text">Edit</span>
                                        </Link>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <Link className="button button-create-assignment" to={`/admin/problem/manage/0`}>
                    <FaPlusCircle aria-hidden="true" />
                    <span className="button-text">Create new problem</span>
                </Link>
            </div>
        </div>

        {orderModal && (
            <div className="modal-overlay" aria-modal="true">
                <div className="modal modal--reorder">
                    <div className="modal__title">Reorder Competition Problems</div>
                    <div className="modal__body">
                        <div className="modal__subtitle">
                            <div className="muted">Click the arrows to reorder the problems.</div>
                            <div className="muted">{orderModal.projects.length} / 10</div>
                        </div>
                        <div className="reorder-list callout">
                            {orderModal.projects.map((project, index) => {
                                const difficulty = project.Difficulty.toLowerCase();
                                return (
                                <div className="reorder__row" key={project.Id}>
                                    <div className="reorder__index">{index + 1}.</div>
                                    <div className="reorder-card">
                                        <span className="reorder-card__title">{project.Name}</span>
                                        <span className={`project-badge badge--${difficulty}`}>{difficulty}</span>
                                    </div>
                                    <div className="reorder-card__actions">
                                        {index > 0 && 
                                            <button 
                                                type="button"
                                                className="reorder-btn"
                                                onClick={() => moveProject(index, "up")}
                                            >
                                                <FaChevronUp className="reorder-btn__icon" aria-hidden="true" />
                                            </button>
                                        }
                                        {index < orderModal.projects.length - 1 && 
                                            <button 
                                                type="button"
                                                className="reorder-btn"
                                                onClick={() => moveProject(index, "down")}
                                            >
                                                <FaChevronDown className="reorder-btn__icon" aria-hidden="true" />
                                            </button>
                                        }
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="modal__actions reorder__actions">
                        <button className="btn" onClick={() => setOrderModal(null)}>Cancel</button>
                        <button className="btn btn-primary" onClick={confirmOrderModal} disabled={orderModal.isSaving}>
                            {orderModal.isSaving ? "Saving..." : "Save"}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </>
  )
}