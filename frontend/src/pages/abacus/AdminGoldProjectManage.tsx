import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';
import axios from 'axios';

import MenuComponent from '../components/MenuComponent';
import DirectoryBreadcrumbs from '../components/DirectoryBreadcrumbs';
import SegmentedControl from '../components/SegmentedControl';
import LoadingAnimation from '../components/LoadingAnimation';
import { FaExchangeAlt, FaRegFile } from 'react-icons/fa';

import '../../styling/AdminProjectManage.scss';

type GoldProjectType = 'competition' | 'none';

export default function AdminGoldProjectManage() {
    const { id } = useParams();
    const projectId = Number(id);

    if (Number.isNaN(projectId)) {
        return <>Error: Missing or invalid project ID.</>;
    }

    const API = (import.meta.env.VITE_API_URL as string) || '';

    const [projectName, setProjectName] = useState('');
    const [projectType, setProjectType] = useState<GoldProjectType>('none');
    const [descriptionFile, setDescriptionFile] = useState<File | undefined>(undefined);
    const [descriptionFileName, setDescriptionFileName] = useState('');
    const [serverDescriptionFileName, setServerDescriptionFileName] = useState('');
    const [edit, setEdit] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    function authConfig() {
        const token = localStorage.getItem('AUTOTA_AUTH_TOKEN');
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }

    useEffect(() => {
        async function loadData() {
            if (projectId === 0) return;

            try {
                const res = await axios.get(
                    `${API}/projects/get_project_id?id=${projectId}`,
                    authConfig()
                );
                const data = res.data || {};
                setProjectName(data.name || '');
                setProjectType((data.type as GoldProjectType) || 'none');

                const serverDesc = (data.descriptionFile || '') as string;
                setDescriptionFileName(serverDesc);
                setServerDescriptionFileName(serverDesc);

                setEdit(true);
            } catch (e) {
                console.log(e);
            }
        }

        loadData();
    }, [API, projectId]);

    function handleDescriptionFileChange(event: React.FormEvent) {
        const target = event.target as HTMLInputElement;
        const files = target.files;

        if (files != null && files.length === 1) {
            setDescriptionFile(files[0]);
            setDescriptionFileName(files[0].name);
        } else {
            setDescriptionFile(undefined);
            setDescriptionFileName('');
        }
    }

    async function handleSubmit() {
        if (!projectName.trim() || !descriptionFileName.trim()) {
            window.alert('Please fill out all fields.');
            return;
        }

        try {
            setSubmitting(true);

            const formData = new FormData();
            if (edit) {
                formData.append('id', String(projectId));
            }
            formData.append('name', projectName.trim());
            formData.append('language', 'none');
            formData.append('project_type', projectType);
            formData.append('division', 'gold');

            if (descriptionFile) {
                formData.append('assignmentdesc', descriptionFile);
            }

            if (edit) {
                await axios.post(
                    `${API}/projects/edit_project`,
                    formData,
                    authConfig()
                );
                window.alert('Gold Division problem saved.');
                window.location.href = `/admin/gold/problem/manage/${projectId}`;
            } else {
                const res = await axios.post(
                    `${API}/projects/create_project`,
                    formData,
                    authConfig()
                );
                const newId = res.data;
                window.alert('Gold Division problem created.');
                window.location.href = `/admin/gold/problem/manage/${newId}`;
            }
        } catch (error: any) {
            window.alert(
                error?.response?.data?.message ||
                    'An error occurred while saving the Gold Division problem.'
            );
            console.log(error);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <>
            <Helmet>
                <title>[Admin] Abacus</title>
            </Helmet>

            <MenuComponent />

            <DirectoryBreadcrumbs
                items={[
                    { label: 'Admin Menu', to: '/admin' },
                    { label: 'Gold Division Problem List', to: '/admin/gold/problems' },
                    {
                        label: edit
                            ? 'Gold Division Problem Manage'
                            : 'Create Gold Division Problem',
                    },
                ]}
            />

            <div className="admin-project-config-container">
                <div className="pageTitle">
                    {edit
                        ? 'Gold Division Problem Manage'
                        : 'Create Gold Division Problem'}
                </div>

                <div className="tab-content">
                    <div className="pane-project-settings">
                        <form
                            className="form-project-settings"
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSubmit();
                            }}
                        >
                            <div className="segment-main">
                                <div className="form-field input-field">
                                    <label>Problem Name</label>
                                    <input
                                        type="text"
                                        value={projectName}
                                        onChange={(e) =>
                                            setProjectName(e.currentTarget.value)
                                        }
                                    />
                                </div>

                                <div className="form-field input-field">
                                    <label>Problem Type</label>
                                    <SegmentedControl
                                        className="segment-project-type"
                                        options={[
                                            { label: 'None', value: 'none' },
                                            { label: 'Competition', value: 'competition' },
                                        ]}
                                        value={projectType}
                                        onChange={(v) =>
                                            setProjectType(v as GoldProjectType)
                                        }
                                        getOptionClassName={(v) => v.toLowerCase()}
                                    />
                                </div>

                                <div className="form-field input-field">
                                    <label>Description</label>
                                    <div
                                        className="file-drop-area"
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            const files = e.dataTransfer.files;
                                            if (files && files.length > 0) {
                                                handleDescriptionFileChange({
                                                    target: { files },
                                                } as any);
                                            }
                                        }}
                                    >
                                        {!descriptionFileName ? (
                                            <>
                                                <input
                                                    type="file"
                                                    className="file-input"
                                                    id="goldDescFile"
                                                    onChange={handleDescriptionFileChange}
                                                />
                                                <div className="file-drop-message">
                                                    Drag &amp; drop your file here or&nbsp;
                                                    <span className="browse-text">browse</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="file-preview">
                                                <button
                                                    type="button"
                                                    className="exchange-icon"
                                                    onClick={() => {
                                                        setDescriptionFile(undefined);
                                                        setDescriptionFileName('');
                                                        setServerDescriptionFileName('');
                                                        const el = document.getElementById(
                                                            'goldDescFile'
                                                        ) as HTMLInputElement | null;
                                                        if (el) el.value = '';
                                                    }}
                                                >
                                                    <FaExchangeAlt aria-hidden="true" />
                                                </button>

                                                <div className="file-preview-list">
                                                    <div className="file-preview-row solution-file-card">
                                                        <span
                                                            className="file-icon-wrapper"
                                                            aria-hidden="true"
                                                        >
                                                            <FaRegFile
                                                                className="file-outline-icon"
                                                                aria-hidden="true"
                                                            />
                                                        </span>
                                                        <span className="file-name">
                                                            {descriptionFileName}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="submit-button"
                                    disabled={submitting}
                                >
                                    {submitting
                                        ? edit
                                            ? 'Saving...'
                                            : 'Creating...'
                                        : edit
                                        ? 'Submit Gold Division changes'
                                        : 'Create Gold Division problem'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <LoadingAnimation
                show={submitting}
                message={
                    edit
                        ? 'Saving Gold Division problem...'
                        : 'Creating Gold Division problem...'
                }
            />
        </>
    );
}