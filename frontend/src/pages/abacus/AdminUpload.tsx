import React, { useEffect, useState } from 'react'
import axios from 'axios'
import MenuComponent from '../components/MenuComponent'
import LoadingAnimation from '../components/LoadingAnimation'
import { Helmet } from 'react-helmet'
import { useNavigate } from 'react-router-dom'
import Select from 'react-select'
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";
import '../../styling/AdminUpload.scss'
import '../../styling/FileUploadCommon.scss'

import {
    FaAlignJustify,
    FaCloudUploadAlt,
    FaCode,
    FaDownload,
    FaExchangeAlt,
    FaRegFile,
    FaTimesCircle,
} from 'react-icons/fa'

interface ProjectObject {
    Id: number;
    Name: string;
    Language: string;
    TotalSubmissions: number;
}

interface SchoolObject {
    id: number;
    name: string;
}

interface TeamObject {
    Id: number;
    Name: string;
}

interface StudentObject {
    Id: number;
    MemberId: number;
}

const AdminUpload = () => {
    const API = (import.meta.env.VITE_API_URL as string) || "";
    const navigate = useNavigate()

    const [files, setFiles] = useState<File[]>([])
    const [mainJavaFileName, setMainJavaFileName] = useState<string>('')

    const [isLoading, setIsLoading] = useState<boolean>(false)

    const [schools, setSchools] = useState<SchoolObject[]>([])
    const [selectedSchool, setSelectedSchool] = useState<number>(-1)

    const [teams, setTeams] = useState<TeamObject[]>([])
    const [selectedTeam, setSelectedTeam] = useState<number>(-1)

    const [students, setStudents] = useState<StudentObject[]>([])
    const [selectedStudent, setSelectedStudent] = useState<number>(-1)

    const [projects, setProjects] = useState<ProjectObject[]>([])
    const [selectedProject, setSelectedProject] = useState<number>(-1)

    const canUpload = selectedProject > 0 && selectedSchool > 0 && selectedTeam > 0 && selectedStudent > 0 && files.length > 0

    function authConfig() {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }

    // Fetch Data
    useEffect(() => {
        async function fetchData() {
            try {
                const [projectsRes, schoolsRes] = await Promise.all([
                    axios.get<ProjectObject[]>(`${API}/projects/all_projects`, authConfig()),
                    axios.get<SchoolObject[]>(`${API}/schools/public/all?hasTeams=true`, authConfig())
                ])
                setProjects(projectsRes.data)
                setSchools(schoolsRes.data)

            } catch (err: any) {
                console.log(err)
                alert('Failed to fetch data')
                setProjects([])
                setSchools([])
            }
        }
        
        fetchData()
    }, []);

    // Allowed upload file extensions (frontend gate)
    const ALLOWED_EXTS = ['.py', '.java']
    const isJavaFile = (f: File) => f.name.toLowerCase().endsWith('.java')
    const isJavaFileName = (n: string) => /\.java$/i.test(n)

    const isAllowedFileName = (name: string) => {
        const ext = '.' + (name.split('.').pop() || '').toLowerCase()
        return ALLOWED_EXTS.includes(ext)
    }

    // Detect entry point when multiple .java files are uploaded
    const JAVA_MAIN_RE = /\bpublic\s+static\s+void\s+main\s*\(/
    function pickMainJavaFile(allJavaNames: string[], namesWithMain: string[]): string {
        if (namesWithMain.length === 1) return namesWithMain[0]
        const mainDotJava = allJavaNames.find((n) => n.toLowerCase() === 'main.java')
        if (mainDotJava) return mainDotJava
        return namesWithMain[0] || ''
    }

    async function computeMainJavaFromLocal(localFiles: File[]) {
        const javaFiles = localFiles.filter((f) => isJavaFileName(f.name))
        if (javaFiles.length <= 1) {
            setMainJavaFileName('')
            return
        }

        const withMain: string[] = []
        for (const f of javaFiles) {
            try {
                const txt = await f.text()
                if (JAVA_MAIN_RE.test(txt)) withMain.push(f.name)
            } catch {
                // ignore read failures
            }
        }
        setMainJavaFileName(pickMainJavaFile(javaFiles.map((f) => f.name), withMain))
    }

    useEffect(() => {
        let cancelled = false
        ; (async () => {
            if (!(files.length > 1 && files.every(isJavaFile))) {
            if (!cancelled) setMainJavaFileName('')
            return
            }
            await computeMainJavaFromLocal(files)
        })()

        return () => {
        cancelled = true
        }
    }, [files])

    function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const selected = event.target.files ? Array.from(event.target.files) : []
        const valid = selected.filter((f) => isAllowedFileName(f.name))

        if (selected.length && valid.length === 0) {
            alert('Only .py and .java files are allowed.')
        }

        // Multi-file is only allowed for Java (.java)
        if (valid.length > 1 && !valid.every(isJavaFile)) {
            setFiles([])
            alert('Multi-file upload is only available for Java (.java) files.')
            return
        }

        setFiles(valid)
    }

    const downloadAssignment = (pid: number) => {
        if (!pid || pid <= 0) return
        axios
        .get(`${API}/projects/getAssignmentDescription?project_id=${pid}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('AUTOTA_AUTH_TOKEN')}` },
            responseType: 'blob',
        })
        .then((res) => {
            const type = (res.headers as any)['content-type'] || 'application/octet-stream'
            const blob = new Blob([res.data], { type })
            let name = (res.headers as any)['x-filename'] || 'assignment_description'
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = name
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
        })
        .catch((err) => {
            console.log(err)
            alert('Download failed.')
        })
    }

    async function handleSchoolChange(schoolId: number) {
        setSelectedSchool(schoolId)
        setSelectedTeam(-1)
        setSelectedStudent(-1)

        if (schoolId > 0) {
            try {
                const res = await axios.get<TeamObject[]>(
                    `${API}/teams/byschool?school_id=${schoolId}`,
                    authConfig()
                )
                console.log(res.data)
                const data = Array.isArray(res.data) ? res.data : [];
                setTeams(data)
            } catch (err: any) {
                console.log(err)
                alert('Failed to fetch teams')
                setTeams([])
            }
        }
    }

    async function handleTeamChange(teamId: number) {
        setSelectedTeam(teamId)
        setSelectedStudent(-1)

        if (teamId > 0) {
            try {
                const res = await axios.get<StudentObject[]>(
                    `${API}/teams/members?team_id=${teamId}`,
                    authConfig()
                )
                const data = Array.isArray(res.data) ? res.data : [];
                setStudents(data)
            } catch (err: any) {
                console.log(err)
                alert('Failed to fetch students')
                setStudents([])
            }
        }
    }

    async function handleSubmit(e?: React.FormEvent) {
        e?.preventDefault()

        // Make sure at least one file is selected
        if (files.length === 0) {
            alert('Please select a file to upload.')
            return
        }

        // Enforce multi-file restriction at submit time too
        if (files.length > 1 && !files.every(isJavaFile)) {
            alert('Multi-file upload is only available for Java (.java) files.')
            return
        }

        // Validate extensions again at submit time (belt and suspenders)
        if (files.some((f) => !isAllowedFileName(f.name))) {
            alert('Only .py or .java files are allowed.')
            return
        }

        setIsLoading(true)

        const formData = new FormData()
        files.forEach((f) => formData.append('files', f, f.name))
        formData.append('project_id', selectedProject.toString())
        formData.append('student_id', selectedStudent.toString())

        try {
            const res = await axios.post(`${API}/upload/`, formData, authConfig())
            setIsLoading(false)
            navigate(`/submission/${res.data.sid}`)
        } catch (err: any) {
            console.log(err)
            alert('Upload failed.')
            setIsLoading(false)
        }
    }

    // code => code icon, text => two-line text icon, otherwise => alternate icon
    const CODE_ICON_RE = /\.(py|java)$/i
    const TEXT_ICON_RE = /\.(txt|md|pdf|doc|docx)$/i

    const getFileIcon = (filename: string) => {
        if (CODE_ICON_RE.test(filename)) return <FaCode className="file-language-icon" aria-hidden="true" />
        if (TEXT_ICON_RE.test(filename))
        return <FaAlignJustify className="file-language-icon" aria-hidden="true" />
        return <FaTimesCircle className="file-language-icon" aria-hidden="true" />
    }

    return (
        <>
            <LoadingAnimation show={isLoading} message="Uploading..." />
            
            <Helmet>
                <title>[Admin] Abacus</title>
            </Helmet>

            <MenuComponent
                showAdminUpload={true}
                showProblemList={true}
            />

            <div className="admin-upload-root">
                <DirectoryBreadcrumbs
                    items={[
                        { label: "School List", to: "/admin/schools" },
                        { label: "Admin Upload" },
                    ]}
                />
                <div className="pageTitle">Admin Upload</div>
                <div className="admin-upload-content">
                    <form className={`upload-form ${isLoading ? 'is-loading' : ''}`} onSubmit={handleSubmit}>
                        <div className="select-section">
                            <div className="select-user-info">
                                <div className="select-item">
                                    <label className="select-label">Select school</label>
                                    <Select
                                        className="select-dropdown"
                                        classNamePrefix="select-dropdown"
                                        placeholder="Choose a school"
                                        value={
                                            selectedSchool > 0
                                                ? { value: selectedSchool, label: schools.find(s => s.id === selectedSchool)?.name }
                                                : null
                                        }
                                        onChange={(option) => handleSchoolChange(option ? option.value : -1)}
                                        options={schools.map((s) => ({
                                            value: s.id,
                                            label: s.name
                                        }))}
                                        isClearable
                                    />
                                </div>
                                <div className="select-item">
                                    <label className="select-label">Select team</label>
                                    <Select
                                        className="select-dropdown"
                                        classNamePrefix="select-dropdown"
                                        placeholder="Choose a team"
                                        value={
                                            selectedTeam > 0
                                                ? { value: selectedTeam, label: teams.find(t => t.Id === selectedTeam)?.Name }
                                                : null
                                        }
                                        onChange={(option) => handleTeamChange(option ? option.value : -1)}
                                        options={teams.map((t) => ({
                                            value: t.Id,
                                            label: t.Name
                                        }))}
                                        isDisabled={selectedSchool <= 0}
                                        isClearable
                                    />
                                </div>
                                <div className="select-item">
                                    <label className="select-label">Select student</label>
                                    <Select
                                        className="select-dropdown"
                                        classNamePrefix="select-dropdown"
                                        placeholder="Choose a student"
                                        value={
                                            selectedStudent > 0
                                                ? { value: selectedStudent, label: 'Member ' + students.find(s => s.Id === selectedStudent)?.MemberId }
                                                : null
                                        }
                                        onChange={(option) => setSelectedStudent(option ? option.value : -1)}
                                        options={students.map((s) => ({
                                            value: s.Id,
                                            label: 'Member ' + s.MemberId 
                                        }))}
                                        isDisabled={selectedTeam <= 0}
                                        isClearable
                                    />
                                </div>
                            </div>

                            <div className="select-item">
                                <label className="select-label">Select problem</label>
                                <Select
                                    className="select-dropdown--project"
                                    classNamePrefix="select-dropdown"
                                    placeholder="Choose a problem"
                                    value={
                                        selectedProject > 0
                                            ? { value: selectedProject, label: projects.find(p => p.Id === selectedProject)?.Name }
                                            : null
                                    }
                                    onChange={(option) => setSelectedProject(option ? option.value : -1)}
                                    options={projects.map((p) => ({
                                        value: p.Id,
                                        label: p.Name
                                    }))}
                                    isClearable
                                />
                            </div>
                        </div>

                        <div className="upload-section">
                            <h1 className="info-title">Upload Assignment</h1>
                            <button
                                type="button"
                                className="assignment-link"
                                onClick={() => downloadAssignment(selectedProject)}
                                disabled={selectedProject <= 0}
                                aria-label="Download assignment description"
                            >
                                <FaDownload className="assignment-link__icon" aria-hidden="true" />
                                <span>Download Assignment Instructions</span>
                            </button>

                            <div className="form-field">
                            <div
                                className="file-drop-area"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                e.preventDefault()
                                const dropped = Array.from(e.dataTransfer.files || [])
                                const valid = dropped.filter((f) => isAllowedFileName(f.name))

                                if (dropped.length && valid.length === 0) {
                                    alert('Only .py and .java files are allowed.')
                                    return
                                }

                                // Multi-file is only allowed for Java (.java)
                                if (valid.length > 1 && !valid.every(isJavaFile)) {
                                    setFiles([])
                                    alert('Multi-file upload is only available for Java (.java) files.')
                                    return
                                }

                                setFiles(valid)
                                }}
                            >
                                {!files.length ? (
                                <>
                                    <input
                                    type="file"
                                    className="file-input"
                                    accept=".py,.java,.c,.rkt"
                                    multiple
                                    onChange={handleFileChange}
                                    />

                                    <div className="file-drop-message">
                                    <FaCloudUploadAlt className="file-drop-icon" aria-hidden="true" />
                                    <p>
                                        Drag &amp; drop your file(s) here or&nbsp;
                                        <span className="browse-text">browse</span>
                                    </p>
                                    </div>
                                </>
                                ) : (
                                <div className="file-preview">
                                    <button
                                    type="button"
                                    className="exchange-icon"
                                    aria-label="Clear selected files"
                                    title="Clear selected files"
                                    onClick={() => setFiles([])}
                                    >
                                    <FaExchangeAlt aria-hidden="true" />
                                    </button>

                                    <div className="file-preview-list" title="Selected files">
                                    {files.map((f) => (
                                        <div key={f.name} className="file-preview-row solution-file-card">
                                        <div className="file-icon-wrapper" aria-hidden="true">
                                            <FaRegFile className="file-outline-icon" aria-hidden="true" />
                                            {getFileIcon(f.name)}
                                        </div>

                                        <span className="file-name">
                                            {f.name}
                                            {files.length > 1 &&
                                            files.every(isJavaFile) &&
                                            mainJavaFileName &&
                                            f.name === mainJavaFileName && (
                                                <span className="main-indicator">Main</span>
                                            )}
                                        </span>
                                        </div>
                                    ))}
                                    </div>
                                </div>
                                )}
                            </div>
                            </div>

                            <button
                                type="submit"
                                disabled={!canUpload}
                                className="upload-button"
                            >
                                Upload
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    )
}

export default AdminUpload