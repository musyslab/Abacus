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
    const [projects, setProjects] = useState<ProjectObject[]>([]);

    useEffect(() => {
        let isMounted = true;

        axios
            .get(`${import.meta.env.VITE_API_URL}/projects/all_projects`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("AUTOTA_AUTH_TOKEN")}`,
                },
            })
            .then((res) => {
                const parsed: ProjectObject[] = (res.data as any[]).map(
                    (str: any) => JSON.parse(str) as ProjectObject
                );
                if (isMounted) setProjects(parsed);
            })
            .catch((err) => console.log(err));

        return () => {
            isMounted = false;
        };
    });
    return (
    <>
        <Helmet>
            <title>[Admin] Abacus</title>
        </Helmet>

        <MenuComponent
            showProblemList={true}
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
                        {projects.map((project) => {
                            return (
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
                            );
                        })}
                    </tbody>
                </table>

                <tbody className="projects-table-body"></tbody>
                <Link className="button button-create-assignment" to={`/admin/problem/manage/0`}>
                    <FaPlusCircle aria-hidden="true" />
                    <span className="button-text">Create new assignment</span>
                </Link>
            </div>
        </div>
    </>
  )
}

export default AdminProjectList