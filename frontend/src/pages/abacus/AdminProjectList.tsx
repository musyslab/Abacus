// Similar to admin/AdminProjectList.tsx

import { useEffect, useState } from "react";
import { Helmet } from "react-helmet"
import { Link } from "react-router-dom";
import { FaPlusCircle, FaEdit } from "react-icons/fa";
import axios from "axios";

import "../../styling/AdminProjectList.scss";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs"
import MenuComponent from "../components/MenuComponent"

type ProjectObject = {
    Id: number;
    Name: string;
    Language: string;
    TotalSubmissions: number;
    Type: string;
    Difficulty: string;
    OrderIndex: number | null;
}

const AdminProjectList = () => {
    const API = (import.meta.env.VITE_API_URL as string) || "";
    const [projects, setProjects] = useState<ProjectObject[]>([]);

    function authConfig() {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }

    useEffect(() => {
        axios
            .get(`${API}/projects/all_projects`, authConfig())
            .then((res) => {
                const data = res.data as ProjectObject[];
                data.sort((a, b) => {
                    if (a.OrderIndex === null && b.OrderIndex === null) return 0;
                    if (a.OrderIndex === null) return 1;
                    if (b.OrderIndex === null) return -1;
                    return a.OrderIndex - b.OrderIndex;
                });
                setProjects(data);
            })
            .catch((err) => console.log(err));
    }, []);
    
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
                        {projects.map((project) => {
                            const orderIndex = project.OrderIndex ?? "-";
                            const difficulty = project.Difficulty.toLowerCase();

                            const isCompetition = project.Type === "competition";
                            const isPractice = project.Type === "practice";
                            //const isActive = something

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
                                            className="badge badge-competition"
                                            title="Competition problem"
                                        >
                                            Competition
                                        </span>
                                    )}
                                    {isPractice && (
                                        <span
                                            className="badge badge-practice"
                                            title="Practice problem"
                                        >
                                            Practice
                                        </span>
                                    )}
                                    {isCompetition && (
                                        <span
                                            className="badge badge-active"
                                            title="Project is active now"
                                        >
                                            ● Active
                                        </span>
                                    )}
                                </td>
                                <td className="project-difficulty">
                                    <span className={`badge badge-${difficulty}`}>{difficulty}</span>
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
    </>
  )
}

export default AdminProjectList