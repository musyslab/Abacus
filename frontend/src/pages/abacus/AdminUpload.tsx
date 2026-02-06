import React, { useEffect, useState } from 'react'
import axios from 'axios'
import MenuComponent from '../components/MenuComponent'
import ErrorMessage from '../components/ErrorMessage'
import LoadingAnimation from '../components/LoadingAnimation'
import { Helmet } from 'react-helmet'
import { useParams } from 'react-router-dom'
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

interface StudentObject {
    Id: number;
    TeamId: number;
    MemberId: number;
}

const AdminUpload = () => {
    const API = (import.meta.env.VITE_API_URL as string) || "";
    const { class_id } = useParams()
    let cid = -1
    if (class_id !== undefined) {
        cid = parseInt(class_id, 10)
    }

    const [files, setFiles] = useState<File[]>([])
    const [mainJavaFileName, setMainJavaFileName] = useState<string>('')

    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [error_message, setError_Message] = useState<string>('')
    const [isErrorMessageHidden, setIsErrorMessageHidden] = useState<boolean>(true)

    const [projects, setProjects] = useState<ProjectObject[]>([])
    const [selectedPid, setSelectedPid] = useState<number>(-1)

    const [students, setStudents] = useState<StudentObject[]>([])
    const [selectedSid, setSelectedSid] = useState<number>(-1)

    const canUpload = selectedPid > 0 && selectedSid > 0 && files.length > 0

    function authConfig() {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }

    // Fetch Data
    useEffect(() => {
        axios
            .get(`${API}/projects/all_projects`, authConfig())
            .then((res) => {
                setProjects(res.data);
            })
            .catch((err) => console.log(err));
        
        axios
            .get(`${API}/upload/all_students`, authConfig())
            .then((res) => {
                setStudents(res.data);
            })
            .catch((err) => console.log(err));
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
      setError_Message('Only .py, .java, .c, or .rkt files are allowed.')
      setIsErrorMessageHidden(false)
    }

    // Multi-file is only allowed for Java (.java)
    if (valid.length > 1 && !valid.every(isJavaFile)) {
      setFiles([])
      setError_Message('Multi-file upload is only available for Java (.java) files.')
      setIsErrorMessageHidden(false)
      return
    }

    setIsErrorMessageHidden(true)
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
        .catch((err) => console.error('Download failed:', err))
    }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()

    // Make sure at least one file is selected
    if (files.length === 0) {
        setError_Message('Please select a file to upload.')
        setIsErrorMessageHidden(false)
        return
    }

    // Enforce multi-file restriction at submit time too
    if (files.length > 1 && !files.every(isJavaFile)) {
        setError_Message('Multi-file upload is only available for Java (.java) files.')
        setIsErrorMessageHidden(false)
        return
    }

    // Validate extensions again at submit time (belt and suspenders)
    if (files.some((f) => !isAllowedFileName(f.name))) {
        setError_Message('Only .py or .java files are allowed.')
        setIsErrorMessageHidden(false)
        return
    }

    setIsErrorMessageHidden(true)
    setIsLoading(true)

    const formData = new FormData()
    files.forEach((f) => formData.append('files', f, f.name))
    formData.append('project_id', selectedPid.toString())
    formData.append('student_id', selectedSid.toString())

    axios
      .post(`${API}/upload/`, formData, authConfig())
      .then((res) => {
        // Take to the student output diff view after successful upload
        setIsLoading(false)
      })
      .catch((err) => {
        setError_Message(err.response?.data?.message || 'Upload failed.')
        setIsErrorMessageHidden(false)
        setIsLoading(false)
      })
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
                        <div className="select-item">
                            <label className="select-label">Select project</label>
                            <select
                                className="select-dropdown"
                                value={selectedPid > 0 ? selectedPid : ''}
                                onChange={(e) => setSelectedPid(Number(e.target.value))}
                            >
                                <option value="" disabled>Choose a project</option>
                                {projects.map((p) => (
                                    <option key={p.Id} value={p.Id}>
                                        {p.Name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="select-item">
                            <label className="select-label">Select student</label>
                            <select
                                className="select-dropdown"
                                value={selectedSid > 0 ? selectedSid : ''}
                                onChange={(e) => setSelectedSid(Number(e.target.value))}
                            >
                                <option value="" disabled>Choose a student</option>
                                {students.map((s) => (
                                    <option key={s.Id} value={s.Id}>
                                        Student: {s.Id}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="upload-section">
                        <h1 className="info-title">Upload Assignment</h1>
                        <button
                            type="button"
                            className="assignment-link"
                            onClick={() => downloadAssignment(selectedPid)}
                            disabled={selectedPid <= 0}
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
                                setError_Message('Only .py, .java, .c, or .rkt files are allowed.')
                                setIsErrorMessageHidden(false)
                                return
                            }

                            // Multi-file is only allowed for Java (.java)
                            if (valid.length > 1 && !valid.every(isJavaFile)) {
                                setFiles([])
                                setError_Message('Multi-file upload is only available for Java (.java) files.')
                                setIsErrorMessageHidden(false)
                                return
                            }

                            setIsErrorMessageHidden(true)
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
                <ErrorMessage message={error_message} isHidden={isErrorMessageHidden} />
            </div>
        </div>
    </>
  )
}

export default AdminUpload