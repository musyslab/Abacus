// Similar to admin/AdminProjectList.tsx

import { useEffect, useState } from "react";
import { Helmet } from "react-helmet"
import { Link } from "react-router-dom";
import { FaPlusCircle, FaEdit } from "react-icons/fa";
import axios from "axios";

import "../../styling/AdminProjectList.scss";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs"
import MenuComponent from "../components/MenuComponent"

interface ProjectObject {
    Id: number;
    Name: string;
    Language: string;
    TotalSubmissions: number;
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
                setProjects(res.data);
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

        <div className="admin-problem-list-root">
            <DirectoryBreadcrumbs
                items={[
                    { label: 'School List', to:'/admin/schools' },
                    { label: 'Problem List' },
                ]}
            />
            <div className="pageTitle">Problem List</div>

            <div className="admin-problem-list-content">
                <table className="projects-table">
                    <thead className="projects-table-head">
                        <tr className="projects-table-row">
                            <th className="projects-table-header">Problem Name</th>
                            <th className="projects-table-header">Language</th>
                            <th className="projects-table-header">Total Submissions</th>
                            <th className="projects-table-header">Edit Problem</th>
                        </tr>
                    </thead>
                    <tbody className="projects-table-body">
                        {projects.map((project) => (
                            <tr
                                className="project-row is-active"
                                key={project.Id}
                                aria-current="true"
                            >
                                <td className="project-name">
                                    {project.Name}
                                    <span
                                        className="badge-active"
                                        title="Project is active today"
                                        aria-label="Project is active today"
                                    >
                                        ● Active
                                    </span>
                                </td>
                                <td className="project-language">{project.Language}</td>
                                <td className="project-total-submissions">{project.TotalSubmissions}</td>

                                <td className="project-edit">
                                    <Link className="button button-edit" to={`/admin/problem/manage/${project.Id}`}>
                                        <FaEdit aria-hidden="true" />
                                        <span className="button-text">Edit</span>
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

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