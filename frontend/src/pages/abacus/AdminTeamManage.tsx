// src/pages/admin/AdminTeamManage.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { useParams } from "react-router-dom";

import MenuComponent from "../components/MenuComponent";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";
import "../../styling/AdminTeamManage.scss";

import { FaPen } from "react-icons/fa";

type Division = "Blue" | "Gold" | "Eagle";

type ApiTeamMember = {
    studentId: number;
    memberId: number; // 1..4
    emailHash: string; // sha256 hex, stored in DB (no plaintext email)
    hasAccount: boolean; // PasswordHash is set
    isLocked: boolean;
};

type ApiTeam = {
    id: number;
    teamNumber: number;
    name: string;
    division: Division;
    isOnline: boolean;
    members: ApiTeamMember[];
};

type InviteMeta = {
    sentCount: number;
    lastSentAt?: string; // ISO
    openedAt?: string; // future (email tracking not implemented)
};

type MemberSlot = {
    memberId: number; // 1..4
    studentId?: number;
    emailHash?: string;
    emailInput: string; // only for unsaved slot
    hasAccount: boolean;
    isLocked: boolean;
    isSaving: boolean;
    error?: string;
};

type TeamVm = {
    id: number;
    teamNumber: number;
    name: string;
    division: Division;
    isOnline: boolean;
    members: MemberSlot[]; // always 4 slots
    nameError?: string;
};

const INVITE_META_KEY = "AUTOTA_TEAM_INVITES_V1";
const DIVISIONS = ["Blue", "Gold", "Eagle"];
const ATTENDANCE = [{label: "In-person", value: false }, {label: "Virtual", value: true}];
const DIVISION_SIZES: Record<Division, { min: number; max: number }> = {
    Blue: { min: 3, max: 4 },
    Gold: { min: 2, max: 3 },
    Eagle: { min: 2, max: 4 },
};

function safeJsonParse<T>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

function loadInviteMetaMap(): Record<string, InviteMeta> {
    return safeJsonParse<Record<string, InviteMeta>>(localStorage.getItem(INVITE_META_KEY), {});
}

function saveInviteMetaMap(map: Record<string, InviteMeta>) {
    localStorage.setItem(INVITE_META_KEY, JSON.stringify(map));
}

async function sha256Hex(input: string): Promise<string> {
    const normalized = input.trim().toLowerCase();
    const buf = new TextEncoder().encode(normalized);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

function buildMemberSlots(apiMembers: ApiTeamMember[]): MemberSlot[] {
    return [1, 2, 3, 4].map((memberId) => {
        const member = apiMembers.find((m) => m.memberId === memberId);
        return {
            memberId,
            studentId: member?.studentId,
            emailHash: member?.emailHash,
            emailInput: "",
            hasAccount: member?.hasAccount ?? false,
            isLocked: member?.isLocked ?? false,
            isSaving: false,
            error: undefined,
        };
    });
}

function buildTeamVm(apiTeam: ApiTeam): TeamVm {
    return {
        id: apiTeam.id,
        teamNumber: apiTeam.teamNumber,
        name: apiTeam.name,
        division: apiTeam.division,
        isOnline: apiTeam.isOnline,
        members: buildMemberSlots(apiTeam.members || []),
    };
}

function addTeamVm(prev: TeamVm[], apiTeam: ApiTeam): TeamVm[] {
    const teamVm = buildTeamVm(apiTeam);
    return [...prev, teamVm].sort((a, b) => a.teamNumber - b.teamNumber);
}

export default function AdminTeamManage() {
    const apiBase = (import.meta.env.VITE_API_URL as string) || "";
    
    const { school_id } = useParams();
    const schoolIdParam = Number(school_id);
    const isAdminMode = Number.isFinite(schoolIdParam) && schoolIdParam > 0;
    const managedSchoolId = isAdminMode ? schoolIdParam : null;

    /*
    const { public_id } = useParams<{ public_id: string }>();
    const [resolvedSchoolId, setResolvedSchoolId] = useState<number | null>(null);

    useEffect(() => {
        if (!public_id){
            return;
        }
        const resolveId = async () => {
            try{
                const res = await axios.get(`${apiBase}/schools/admin/getIdfromURL/${public_id}`, authConfig());
                const realId = Array.isArray(res.data) ? res.data[0]?.id : res.data?.id;
                if(realId){
                    setResolvedSchoolId(realId);
                }
                else{
                    console.error("Could not resovlve school ID");
                }

            } catch (err){
                console.error("Failed to resolve school ID from public ID.");
            }
        };
        resolveId();
    }, [public_id, apiBase]);
    const managedSchoolId = resolvedSchoolId;
    const isAdminMode = !!managedSchoolId;
    */
    
    const [schoolName, setSchoolName] = useState<string>("");

    function authConfig() {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }

    const [teams, setTeams] = useState<TeamVm[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [pageError, setPageError] = useState<string>("");

    // Controls how many member rows are visible per team.
    // Required behavior: if a team has 0 saved members, show only 1 member row.
    const [teamVisibleCounts, setTeamVisibleCounts] = useState<Record<number, number>>({});

    const [resendModal, setResendModal] = useState<{
        teamId: number;
        memberId: number;
        emailHash: string;
        email: string;
        error: string;
        isSending: boolean;
    } | null>(null);

    const [saveConfirmModal, setSaveConfirmModal] = useState<{
        teamId: number;
        memberId: number;
        email: string;
        acknowledged: boolean;
        error: string;
        isSaving: boolean;
    } | null>(null);

    const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
        teamId: number;
        memberId: number;
        isSaved: boolean;
        isDeleting: boolean;
        error: string;
    } | null>(null);

    const bodyOverflowRef = useRef<string | null>(null);

    // Handle body overflow when modals are open, to prevent background scrolling.
    useEffect(() => {
        const hasModal = !!saveConfirmModal || !!deleteConfirmModal || !!resendModal;
        if (hasModal) {
            if (bodyOverflowRef.current === null) bodyOverflowRef.current = document.body.style.overflow;
            document.body.style.overflow = "hidden";
        } else if (bodyOverflowRef.current !== null) {
            document.body.style.overflow = bodyOverflowRef.current;
            bodyOverflowRef.current = null;
        }
    }, [saveConfirmModal, deleteConfirmModal, resendModal]);

    useEffect(() => {
        return () => {
            if (bodyOverflowRef.current !== null) {
                document.body.style.overflow = bodyOverflowRef.current;
                bodyOverflowRef.current = null;
            }
        };
    }, []);

    function getTeamSavedCount(team: TeamVm) {
        return team.members.filter((m) => !!m.studentId).length;
    }

    function getTeamMembersToShow(team: TeamVm) {
        const saved = team.members.filter((m) => !!m.studentId);
        const empty = team.members.filter((m) => !m.studentId).sort((a, b) => a.memberId - b.memberId);

        const savedCount = saved.length;
        const maxSize = DIVISION_SIZES[team.division].max;
        // show 1 row for brand-new team, otherwise show saved + next empty.
        const defaultVisible = Math.min(maxSize, Math.max(1, savedCount + 1));
        const totalVisible = Math.max(teamVisibleCounts[team.id] ?? 0, defaultVisible);

        const emptyToShow = Math.min(empty.length, Math.max(0, totalVisible - savedCount));
        return [...saved, ...empty.slice(0, emptyToShow)].sort((a, b) => a.memberId - b.memberId);
    }

    function canAddMoreMembers(team: TeamVm) {
        const savedCount = getTeamSavedCount(team);
        const maxSize = DIVISION_SIZES[team.division].max;
        const defaultVisible = Math.min(maxSize, Math.max(1, savedCount + 1));
        const totalVisible = Math.max(teamVisibleCounts[team.id] ?? 0, defaultVisible);
        return totalVisible < maxSize;
    }

    const emptyTeamExists = useMemo(() => {
        return teams.filter((team) => getTeamSavedCount(team) === 0).length > 0;
    }, [teams]);

    function addMemberRow(teamId: number) {
        const team = teams.find((t) => t.id === teamId);
        if (!team) return;
        const maxSize = DIVISION_SIZES[team.division].max;
        setTeamVisibleCounts((prev) => ({
            ...prev,
            [teamId]: Math.min(maxSize, (prev[teamId] ?? 1) + 1),
        }));
    }

    async function fetchSchoolName() {
        setSchoolName("");
        try {
            if (managedSchoolId) {
                const res = await axios.get(`${apiBase}/schools/id/${managedSchoolId}`, authConfig());
                const name = Array.isArray(res.data) ? res.data?.[0]?.name : res.data?.name;
                setSchoolName(String(name || ""));
                return;
            }
            const res = await axios.get(`${apiBase}/schools/me`, authConfig());
            setSchoolName(String(res.data?.name || ""));
        } catch {
            setSchoolName("");
        }
    }

    async function fetchTeams() {
        setIsLoading(true);
        setPageError("");
        try {
            const res = await axios.get<ApiTeam[]>(
                `${apiBase}/teams/school`,
                {
                    ...authConfig(),
                    params: managedSchoolId ? { school_id: managedSchoolId } : undefined,
                }
            );
            const data = Array.isArray(res.data) ? res.data : [];
            const mapped = data
                .slice()
                .sort((a, b) => a.teamNumber - b.teamNumber)
                .map((apiTeam) => buildTeamVm(apiTeam));

            setTeams(mapped);
            
            setTeamVisibleCounts((prev) => {
                const next = { ...prev };

                for (const t of mapped) {
                    const savedCount = t.members.filter((m) => !!m.studentId).length;
                    const maxSize = DIVISION_SIZES[t.division].max;
                    const defaultVisible = Math.min(maxSize, Math.max(1, savedCount + 1));
                    next[t.id] = Math.max(next[t.id] ?? 0, defaultVisible);
                }
                return next;
            });
            
        } catch (err: any) {
            const msg = err?.response?.data?.message || "Failed to load teams.";
            setPageError(msg);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        fetchSchoolName();
        fetchTeams();
    }, [apiBase, managedSchoolId]);

    async function handleNewTeam() {
        setIsLoading(true);
        setPageError("");
        try {
            const res = await axios.post(`${apiBase}/teams/create`, {
                ...(managedSchoolId ? { school_id: managedSchoolId } : {}),
            }, authConfig());

            const newTeam = res.data as ApiTeam;
            setTeams(prev => addTeamVm(prev, newTeam));
            setTeamVisibleCounts((prev) => ({ ...prev, [newTeam.id]: 1 }));

        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || "Team creation failed.";
            setPageError(msg);
        }
        setIsLoading(false);
    }

    async function handleDeleteTeam(teamId: number) {
        setIsLoading(true);
        setPageError("");
        try {
            await axios.delete(`${apiBase}/teams/delete`, {
                ...authConfig(),
                data: { team_id: teamId, ...(managedSchoolId ? { school_id: managedSchoolId } : {}) },
            });

            setTeams((prev) => prev.filter((t) => t.id !== teamId));
            setTeamVisibleCounts((prev) => {
                const next = { ...prev };
                delete next[teamId];
                return next;
            });

            if (resendModal?.teamId === teamId) setResendModal(null);
            if (saveConfirmModal?.teamId === teamId) setSaveConfirmModal(null);
            if (deleteConfirmModal?.teamId === teamId) setDeleteConfirmModal(null);
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || "Team deletion failed.";
            setPageError(msg);
        }
        setIsLoading(false);       
    }

    function updateMember(teamId: number, memberId: number, patch: Partial<MemberSlot>) {
        setTeams((prev) =>
            prev.map((t) => {
                if (t.id !== teamId) return t;
                return {
                    ...t,
                    members: t.members.map((m) => (m.memberId === memberId ? { ...m, ...patch } : m)),
                };
            })
        );
    }

    function openSaveConfirmModal(teamId: number, memberId: number, emailRaw: string) {
        const email = (emailRaw || "").trim().toLowerCase();
        if (!email) {
            updateMember(teamId, memberId, { error: "Email is required." });
            return;
        }
        setSaveConfirmModal({
            teamId,
            memberId,
            email,
            acknowledged: false,
            error: "",
            isSaving: false,
        });
    }

    function openDeleteConfirmModal(teamId: number, memberId: number, isSaved: boolean) {
        setDeleteConfirmModal({
            teamId,
            memberId,
            isSaved,
            isDeleting: false,
            error: "",
        });
    }

    async function confirmSaveFromModal() {
        if (!saveConfirmModal) return;
        if (!saveConfirmModal.acknowledged) {
            setSaveConfirmModal({ ...saveConfirmModal, error: "Please confirm you wrote the information down." });
            return;
        }

        setSaveConfirmModal({ ...saveConfirmModal, isSaving: true, error: "" });
        const res = await handleSaveMember(saveConfirmModal.teamId, saveConfirmModal.memberId, saveConfirmModal.email);
        if (res.ok) {
            setSaveConfirmModal(null);
            return;
        }
        setSaveConfirmModal({
            ...saveConfirmModal,
            isSaving: false,
            error: res.message || "Save failed.",
        });
    }

    async function confirmDeleteFromModal() {
        if (!deleteConfirmModal) return;
        setDeleteConfirmModal({ ...deleteConfirmModal, isDeleting: true, error: "" });
        const res = await handleDeleteMember(deleteConfirmModal.teamId, deleteConfirmModal.memberId);
        if (res.ok) {
            setDeleteConfirmModal(null);
            return;
        }
        setDeleteConfirmModal({
            ...deleteConfirmModal,
            isDeleting: false,
            error: res.message || "Delete failed.",
        });
    }

    async function handleSaveMember(
        teamId: number,
        memberId: number,
        emailOverride?: string
    ): Promise<{ ok: boolean; message?: string }> {
        const team = teams.find((t) => t.id === teamId);
        if (!team) return { ok: false, message: "Team not found." };
        const slot = team.members.find((m) => m.memberId === memberId);
        if (!slot) return { ok: false, message: "Member slot not found." };

        const email = (emailOverride ?? slot.emailInput).trim().toLowerCase();
        if (!email) {
            updateMember(teamId, memberId, { error: "Email is required." });
            return { ok: false, message: "Email is required." };
        }

        updateMember(teamId, memberId, { isSaving: true, error: undefined });

        try {
            const emailHash = await sha256Hex(email);

            const res = await axios.post(
                `${apiBase}/auth/student/create`,
                {
                    email_hash: emailHash,
                    team_id: teamId,
                    member_id: memberId,
                    ...(managedSchoolId ? { school_id: managedSchoolId } : {}),
                },
                authConfig()
            );

            const studentId = res?.data?.student_id as number | undefined;
            if (!studentId) {
                throw new Error(res?.data?.message || "Save failed.");
            }

            // Attempt to send the invite email immediately while we still have the plaintext email.
            // If this fails, the member is still saved, but the progress view will show "Not sent yet".
            let inviteSendError: string | undefined = undefined;
            try {
                await axios.post(
                    `${apiBase}/auth/student/invite`,
                    {
                        team_id: teamId,
                        member_id: memberId,
                        email,
                        ...(managedSchoolId ? { school_id: managedSchoolId } : {}),
                    },
                    authConfig()
                );

                const map = loadInviteMetaMap();
                const current = map[emailHash] || { sentCount: 0 };
                map[emailHash] = {
                    ...current,
                    sentCount: (current.sentCount || 0) + 1,
                    lastSentAt: new Date().toISOString(),
                };
                saveInviteMetaMap(map);
            } catch (err: any) {
                inviteSendError =
                    err?.response?.data?.message ||
                    "Member saved, but invite email failed to send. Use Resend email.";
            }

            updateMember(teamId, memberId, {
                studentId,
                emailHash,
                emailInput: "",
                hasAccount: false,
                isLocked: false,
                isSaving: false,
                error: inviteSendError,
            });

            // After saving one member, ensure the next row is visible (saved + next).
            setTeamVisibleCounts((prev) => {
                const next = { ...prev };
                const t = teams.find((x) => x.id === teamId);
                if (!t) return prev;
                const savedCount = t.members.filter((m) => !!m.studentId).length + 1; // include newly saved
                const maxSize = DIVISION_SIZES[t.division].max;
                next[teamId] = Math.max(next[teamId] ?? 0, Math.min(maxSize, savedCount + 1));
                return next;
            });

            return { ok: true };
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || "Save failed.";
            updateMember(teamId, memberId, { isSaving: false, error: msg });
            return { ok: false, message: msg };
        }
    }

    async function handleDeleteMember(teamId: number, memberId: number): Promise<{ ok: boolean; message?: string }> {
        const team = teams.find((t) => t.id === teamId);
        const slot = team?.members.find((m) => m.memberId === memberId);

        // Unsaved rows are local-only. "Delete" clears the draft row and collapses
        // any extra visible member rows that were manually added.
        if (!slot?.studentId) {
            updateMember(teamId, memberId, {
                studentId: undefined,
                emailHash: undefined,
                emailInput: "",
                hasAccount: false,
                isLocked: false,
                isSaving: false,
                error: undefined,
            });

            setTeamVisibleCounts((prev) => {
                const next = { ...prev };
                const t = teams.find((x) => x.id === teamId);
                if (!t) return prev;
                const savedCount = t.members.filter((m) => !!m.studentId).length;
                const maxSize = DIVISION_SIZES[t.division].max;
                const defaultVisible = Math.min(maxSize, Math.max(1, savedCount + 1));
                const currentVisible = Math.max(prev[teamId] ?? 0, defaultVisible);
                next[teamId] = Math.max(defaultVisible, currentVisible - 1);
                return next;
            });

            return { ok: true };
        }

        updateMember(teamId, memberId, { isSaving: true, error: undefined });
        try {
            await axios.delete(`${apiBase}/auth/student/delete`, {
                ...authConfig(),
                data: { team_id: teamId, member_id: memberId, ...(managedSchoolId ? { school_id: managedSchoolId } : {}) },
            });

            const teamNow = teams.find((t) => t.id === teamId);
            const emailHash = teamNow?.members.find((m) => m.memberId === memberId)?.emailHash;
            if (emailHash) {
                const map = loadInviteMetaMap();
                delete map[emailHash];
                saveInviteMetaMap(map);
            }

            updateMember(teamId, memberId, {
                studentId: undefined,
                emailHash: undefined,
                emailInput: "",
                hasAccount: false,
                isLocked: false,
                isSaving: false,
                error: undefined,
            });

            // If team now has 0 saved members, revert to showing 1 row.
            setTeamVisibleCounts((prev) => {
                const next = { ...prev };
                const t = teams.find((x) => x.id === teamId);
                if (!t) return prev;
                const savedCount = t.members.filter((m) => !!m.studentId).length - 1; // include deletion
                const maxSize = DIVISION_SIZES[t.division].max;
                const defaultVisible = Math.min(maxSize, Math.max(1, Math.max(0, savedCount) + 1));
                next[teamId] = Math.max(1, defaultVisible);
                return next;
            });

            return { ok: true };
        } catch (err: any) {
            const msg = err?.response?.data?.message || "Delete failed.";
            updateMember(teamId, memberId, { isSaving: false, error: msg });
            return { ok: false, message: msg };
        }
    }

    function openResendModal(teamId: number, memberId: number, emailHash: string) {
        setResendModal({
            teamId,
            memberId,
            emailHash,
            email: "",
            error: "",
            isSending: false,
        });
    }

    async function confirmResendInvite() {
        if (!resendModal) return;
        const email = resendModal.email.trim().toLowerCase();
        if (!email) {
            setResendModal({ ...resendModal, error: "Email is required to resend." });
            return;
        }
        setResendModal({ ...resendModal, isSending: true, error: "" });

        try {
            const h = await sha256Hex(email);
            if (h !== resendModal.emailHash) {
                setResendModal({
                    ...resendModal,
                    isSending: false,
                    error: "That email does not match the hashed email saved for this member.",
                });
                return;
            }

            await axios.post(
                `${apiBase}/auth/student/invite`,
                {
                    team_id: resendModal.teamId,
                    member_id: resendModal.memberId,
                    email,
                    ...(managedSchoolId ? { school_id: managedSchoolId } : {}),
                },
                authConfig()
            );

            const map = loadInviteMetaMap();
            const current = map[resendModal.emailHash] || { sentCount: 0 };
            map[resendModal.emailHash] = {
                ...current,
                sentCount: (current.sentCount || 0) + 1,
                lastSentAt: new Date().toISOString(),
            };
            saveInviteMetaMap(map);

            setResendModal(null);
        } catch (err: any) {
            const msg = err?.response?.data?.message || "Invite resend failed.";
            setResendModal({ ...resendModal, isSending: false, error: msg });
        }
    }

    function getInviteMeta(emailHash?: string): InviteMeta {
        if (!emailHash) return { sentCount: 0 };
        const map = loadInviteMetaMap();
        return map[emailHash] || { sentCount: 0 };
    }

    function validateTeamName(name: string, teamId: number): string | null {
        const trimmed = name.trim();
    
        if (trimmed.length < 3) {
            return "Team name must be at least 3 characters long.";
        }
        if (trimmed.length > 30) {
            return "Team name can be no longer than 30 characters.";
        }
        if (!/^[A-Za-z0-9\s'\-_]+$/.test(trimmed)) {
            return "Team name is limited to alphanumeric characters, spaces, underscores, hyphens, and apostrophes.";
        }
        if (!/[A-Za-z0-9]/.test(trimmed)) {
            return "Team name must contain at least one letter or number.";
        }

        const duplicate = teams.find(t => t.name.trim().toLowerCase() === trimmed.toLowerCase() && t.id !== teamId);
        if (duplicate) {
            return "Team name is already in use.";
        }

        return null;
    }
    
    async function updateTeam(teamId: number, updates: Partial<TeamVm>) {
        const original = teams.find(t => t.id === teamId);
        if (!original) return;

        if (updates.name !== undefined) {
            const error = validateTeamName(updates.name, teamId);
            setTeams(prev =>
                    prev.map(team =>
                        team.id === teamId
                            ? { ...team, nameError: error || undefined }
                            : team
                    )
                );
            if (error) return;
        }
        if (updates.division !== undefined) {
            const savedCount = getTeamSavedCount(original);
            const newDivisionMax = DIVISION_SIZES[updates.division].max;
            if (savedCount > newDivisionMax) {
                alert(`Cannot change division. This team has ${savedCount} saved members, but the ${updates.division} division has a max of ${newDivisionMax} members. Please remove some members before changing the division.`);
                return;
            }
            if (original.division === updates.division) return;
        }

        if (updates.isOnline !== undefined && original.isOnline === updates.isOnline) return;
    
        const previousState = { ...original };
    
        setTeams(prev =>
            prev.map(team =>
                team.id === teamId ? { ...team, ...updates } : team
            )
        );
    
        try {
            await axios.put(
                `${apiBase}/teams/update`,
                {
                    team_id: teamId,
                    ...(updates.name !== undefined ? { name: updates.name } : {}),
                    ...(updates.division !== undefined ? { division: updates.division } : {}),
                    ...(updates.isOnline !== undefined ? { is_online: updates.isOnline } : {}),
                    ...(managedSchoolId ? { school_id: managedSchoolId } : {}),
                },
                authConfig()
            );
        } catch (err: any) {
            setTeams(prev =>
                prev.map(team =>
                    team.id === teamId ? previousState : team
                )
            );
            const msg = err?.response?.data?.message || "Update division failed.";
            if(err?.response?.data?.message){
                alert(msg);
            }
            throw new Error(msg);
        }
    }
        

    function updateTeamName(teamId: number, name: string) {updateTeam(teamId, { name })}
    function updateTeamDivision(teamId: number, division: Division) {updateTeam(teamId, { division })}
    function updateTeamAttendance(teamId: number, isOnline: boolean) {updateTeam(teamId, { isOnline })}

    return (
        <>
            <Helmet>
                <title>{managedSchoolId ? "[Admin] Abacus" : "Abacus"}</title>
            </Helmet>

            <MenuComponent
                showProblemList={isAdminMode}
                showAdminUpload={isAdminMode}
            />

            <div className="admin-team-manage-root">
                <DirectoryBreadcrumbs
                    items={
                        managedSchoolId
                            ? [{ label: "School List", to: "/admin/schools" }, { label: "Team Manage" }]
                            : [{ label: "Team Manage" }]
                    }
                    trailingSeparator={!managedSchoolId}
                />
                <div className="pageTitle">
                    {schoolName ? schoolName : "Team Manage"}
                    {managedSchoolId ? " (Admin)" : ""}
                </div>

                <div className="admin-team-manage-content">
                    <div className="callout callout--warning">
                        <div className="callout__title">Important: write this down</div>
                        <div className="callout__body">
                            After you save a member, Abacus cannot show their email again (emails are stored as hashes). For each
                            student, you must record:
                            <ul>
                                <li>
                                    <strong>Team number</strong>
                                </li>
                                <li>
                                    <strong>Member ID (1 to 4)</strong>
                                </li>
                                <li>
                                    <strong>Student name</strong> (recorded outside Abacus)
                                </li>
                            </ul>
                        </div>
                    </div>

                    {pageError ? <div className="callout callout--error">{pageError}</div> : null}

                    <div className="toolbar">
                        <div>
                            <div className="toolbar__title">Teams</div>
                            <div className="toolbar__subtitle muted">Create teams, then add members for each.</div>
                        </div>
                    </div>

                    <div className="callout callout--info close">
                        <div className="team-size__label">Team Size Requirements</div>
                        <div className="team-size__pills">
                            <span className="pill pill--blue">Blue Division: 3–4 Members</span>
                            <span className ="pill pill--gold">Gold Division: 2–3 Members</span>
                            <span className="pill pill--eagle">Eagle Division: 2–4 Members</span>
                        </div>
                    </div>

                    {teams.length === 0 ? (
                        <div className="callout callout--info">No teams yet. Create one to get started.</div>
                    ) : null}

                    <div className="team-panels">
                        {teams.map((team) => {
                            const savedCount = getTeamSavedCount(team);
                            const membersToShow = getTeamMembersToShow(team);
                            const showAddMember = canAddMoreMembers(team);
                            const canDeleteTeam = savedCount === 0;

                            return (
                                <div key={team.id} className="panel">
                                    <div className="panel__header">
                                        <div className="panel__header-options">
                                            <div className="panel__header-name">
                                                <div className="panel__title editable-title">
                                                    <input
                                                        className={`team-name-input ${team.nameError ? "input-error" : ""}`}
                                                        type="text"
                                                        value={team.name}
                                                        onChange={(e) => {
                                                            const value = e.target.value;
                                                            const error = validateTeamName(value, team.id);

                                                            setTeams(prev =>
                                                                prev.map(t =>
                                                                    t.id === team.id
                                                                        ? { ...t, name: value, nameError: error || undefined }
                                                                        : t
                                                                )
                                                            );
                                                        }}
                                                        onBlur={() => updateTeamName(team.id, team.name)}
                                                        disabled={isLoading}
                                                    />
                                                    <FaPen className="edit-icon" />
                                                </div>
                                                {team.nameError && (
                                                    <div className="callout callout--error small">{team.nameError}</div>
                                                )}
                                                <div className="panel__subtitle">
                                                    Members saved: <strong>{savedCount}</strong> (minimum {DIVISION_SIZES[team.division].min}, maximum {DIVISION_SIZES[team.division].max})
                                                </div>
                                            </div>
                                            <div className="panel__header-update">
                                                <label className="panel__label">Division</label>
                                                <div className="segment-btn segment-division">
                                                    {DIVISIONS.map(option => {
                                                        const isSelected = team.division === option;
                                                        return (
                                                            <button
                                                                key={option}
                                                                className={`segment-option ${isSelected ? "selected" : ""} ${option.toLowerCase()}`}
                                                                type="button"
                                                                disabled={isLoading}
                                                                onClick={() => updateTeamDivision(team.id, option as Division)}
                                                            >
                                                                {option}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="panel__header-update">
                                                <label className="panel__label">Attendance</label>
                                                <div className="segment-btn segment-attendance">
                                                    {ATTENDANCE.map(option => {
                                                        const isSelected = team.isOnline === option.value;
                                                        return (
                                                            <button
                                                                key={option.label}
                                                                className={`segment-option ${isSelected ? "selected" : ""}`}
                                                                type="button"
                                                                disabled={isLoading}
                                                                onClick={() => updateTeamAttendance(team.id, option.value)}
                                                            >
                                                                {option.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                        {canDeleteTeam ? (
                                            <div className="panel__header-actions">
                                                <button
                                                    className="btn btn--danger"
                                                    type="button"
                                                    disabled={isLoading}
                                                    onClick={() => handleDeleteTeam(team.id)}
                                                >
                                                    Delete team
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="field__help right-aligned">
                                                Delete all members before deleting the team.
                                            </div>
                                        )}
                                    </div>

                                    {savedCount < DIVISION_SIZES[team.division].min ? (
                                        <div className="callout callout--info">
                                            This team is not complete yet. Save at least <strong>{DIVISION_SIZES[team.division].min}</strong> members before distributing
                                            team information.
                                        </div>
                                    ) : null}

                                    <ol className="member-list">
                                        {membersToShow.map((m) => {
                                            const saved = !!m.studentId;
                                            const invite = getInviteMeta(m.emailHash);

                                            const openedLabel = invite.openedAt
                                                ? `Invite opened (${new Date(invite.openedAt).toLocaleString()})`
                                                : "";

                                            return (
                                                <li key={m.memberId} className="member-row">
                                                    <div className="member-row__top">
                                                        <div className="member-row__title">
                                                            Member <span className="mono">{m.memberId}</span>
                                                        </div>
                                                        <div className="member-row__badges">
                                                            <span className={`badge ${saved ? "badge--success" : "badge--error"}`}>
                                                                {saved ? "Saved" : "Not saved"}
                                                            </span>

                                                            {saved ? (
                                                                <span className={`badge ${m.hasAccount ? "badge--success" : "badge--info"}`}>
                                                                    {m.hasAccount ? "Account active" : "Account setup pending"}
                                                                </span>
                                                            ) : null}

                                                            {invite.openedAt ? (
                                                                <span className="badge badge--muted">{openedLabel}</span>
                                                            ) : null}

                                                            {m.isLocked ? <span className="badge badge--error">Locked</span> : null}
                                                        </div>
                                                    </div>

                                                    {saved ? (
                                                        <div className="member-row__saved">
                                                            <div className="member-progress">
                                                                <div className="progress-row">
                                                                    <div className="progress-row__label">Invite email</div>
                                                                    <div
                                                                        className={`progress-row__value ${invite.sentCount > 0 ? "is-ok" : "is-pending"
                                                                            }`}
                                                                    >
                                                                        {invite.sentCount > 0
                                                                            ? `Sent ${invite.sentCount}x${invite.lastSentAt
                                                                                ? ` (last: ${new Date(
                                                                                    invite.lastSentAt
                                                                                ).toLocaleString()})`
                                                                                : ""
                                                                            }`
                                                                            : "Not sent yet"}
                                                                    </div>
                                                                </div>

                                                                <div className="progress-row">
                                                                    <div className="progress-row__label">Account setup</div>
                                                                    <div
                                                                        className={`progress-row__value ${m.hasAccount ? "is-ok" : "is-pending"
                                                                            }`}
                                                                    >
                                                                        {m.hasAccount ? "Created" : "Not created yet"}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {m.error ? <div className="inline-error">{m.error}</div> : null}

                                                            <div className="member-row__actions">
                                                                <button
                                                                    className="btn btn--secondary"
                                                                    type="button"
                                                                    disabled={m.isSaving || !m.emailHash}
                                                                    onClick={() =>
                                                                        openResendModal(team.id, m.memberId, m.emailHash || "")
                                                                    }
                                                                >
                                                                    Resend email
                                                                </button>
                                                                <button
                                                                    className="btn btn--danger"
                                                                    type="button"
                                                                    disabled={m.isSaving}
                                                                    onClick={() => openDeleteConfirmModal(team.id, m.memberId, true)}
                                                                >
                                                                    Delete member
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="member-row__edit">
                                                            <div className="field">
                                                                <label className="field__label" htmlFor={`email-${team.id}-${m.memberId}`}>
                                                                    Student email (required)
                                                                </label>
                                                                <input
                                                                    id={`email-${team.id}-${m.memberId}`}
                                                                    className="field__input"
                                                                    type="email"
                                                                    placeholder="student@school.edu"
                                                                    value={m.emailInput}
                                                                    onChange={(e) =>
                                                                        updateMember(team.id, m.memberId, {
                                                                            emailInput: e.target.value,
                                                                            error: undefined,
                                                                        })
                                                                    }
                                                                    autoComplete="off"
                                                                />
                                                                <div className="field__help">After saving, the email will not be displayed again.</div>
                                                            </div>

                                                            {m.error ? <div className="inline-error">{m.error}</div> : null}

                                                            <div className="member-row__actions">
                                                                <button
                                                                    className="btn btn--primary"
                                                                    type="button"
                                                                    disabled={m.isSaving}
                                                                    onClick={() => {
                                                                        openSaveConfirmModal(team.id, m.memberId, m.emailInput);
                                                                    }}
                                                                >
                                                                    {m.isSaving ? "Saving…" : "Save member"}
                                                                </button>
                                                                <button
                                                                    className="btn btn--danger"
                                                                    type="button"
                                                                    disabled={m.isSaving}
                                                                    onClick={() => openDeleteConfirmModal(team.id, m.memberId, false)}
                                                                >
                                                                    Delete member
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ol>

                                    {showAddMember ? (
                                        <div className="add-member-row">
                                            <button className="btn btn--secondary" type="button" onClick={() => addMemberRow(team.id)}>
                                                Add member
                                            </button>
                                        </div>
                                    ) : null}

                                    <div className="footer-note">
                                        Tip: If you need to resend an invite later, you must re-enter the student email. Abacus stores only
                                        a hash, so it cannot recover the original email address.
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="new-team-footer">
                        <button
                            className="btn btn--primary new-team-btn"
                            type="button"
                            title={emptyTeamExists ? "Please save or delete the existing empty team before creating a new one." : ""}
                            disabled={isLoading || emptyTeamExists}
                            onClick={() => handleNewTeam()}
                        >
                            New team
                        </button>
                    </div>
                </div>
            </div>

            {saveConfirmModal ? (
                <div className="modal-overlay" role="dialog" aria-modal="true">
                    <div className="modal modal--dramatic">
                        <div className="modal__title">Stop and write this down</div>
                        <div className="modal__body">
                            <div className="callout callout--warning">
                                <div className="callout__title">This information will NOT be stored</div>
                                <div className="callout__body">
                                    After saving, Abacus cannot show the student email again and does not store the student name. Record
                                    these now.
                                </div>
                            </div>

                            <div className="kv">
                                <div className="kv__row">
                                    <div className="kv__label">Team</div>
                                    <div className="kv__value mono">{saveConfirmModal.teamId}</div>
                                </div>
                                <div className="kv__row">
                                    <div className="kv__label">Member ID</div>
                                    <div className="kv__value mono">{saveConfirmModal.memberId}</div>
                                </div>
                                <div className="kv__row">
                                    <div className="kv__label">Email entered</div>
                                    <div className="kv__value mono">{saveConfirmModal.email}</div>
                                </div>
                                <div className="kv__row">
                                    <div className="kv__label">Student name</div>
                                    <div className="kv__value muted">Write this in your notes (not stored in Abacus).</div>
                                </div>
                            </div>

                            <label className="ack-row">
                                <input
                                    type="checkbox"
                                    checked={saveConfirmModal.acknowledged}
                                    onChange={(e) =>
                                        setSaveConfirmModal({ ...saveConfirmModal, acknowledged: e.target.checked, error: "" })
                                    }
                                    disabled={saveConfirmModal.isSaving}
                                />
                                <span>I wrote down the Team number, Member ID, and the student name.</span>
                            </label>

                            {saveConfirmModal.error ? <div className="inline-error">{saveConfirmModal.error}</div> : null}
                        </div>
                        <div className="modal__actions">
                            <button
                                className="btn btn--secondary"
                                type="button"
                                onClick={() => setSaveConfirmModal(null)}
                                disabled={saveConfirmModal.isSaving}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn--primary"
                                type="button"
                                onClick={confirmSaveFromModal}
                                disabled={saveConfirmModal.isSaving || !saveConfirmModal.acknowledged}
                            >
                                {saveConfirmModal.isSaving ? "Saving…" : "Save member"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {deleteConfirmModal ? (
                <div className="modal-overlay" role="dialog" aria-modal="true">
                    <div className="modal modal--danger">
                        <div className="modal__title">Confirm delete</div>
                        <div className="modal__body">
                            <div className="callout callout--error">
                                <div className="callout__title">This cannot be undone</div>
                                <div className="callout__body">
                                    You are about to delete Team <strong>{deleteConfirmModal.teamId}</strong>, Member{" "}
                                    <strong>{deleteConfirmModal.memberId}</strong>.
                                    {deleteConfirmModal.isSaved ? " This removes the saved member record." : " This clears the unsaved row."}
                                </div>
                            </div>

                            {deleteConfirmModal.error ? <div className="inline-error">{deleteConfirmModal.error}</div> : null}
                        </div>
                        <div className="modal__actions">
                            <button
                                className="btn btn--secondary"
                                type="button"
                                onClick={() => setDeleteConfirmModal(null)}
                                disabled={deleteConfirmModal.isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn--danger"
                                type="button"
                                onClick={confirmDeleteFromModal}
                                disabled={deleteConfirmModal.isDeleting}
                            >
                                {deleteConfirmModal.isDeleting ? "Deleting…" : "Delete member"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {resendModal ? (
                <div className="modal-overlay" role="dialog" aria-modal="true">
                    <div className="modal">
                        <div className="modal__title">
                            Resend invite for Team {resendModal.teamId}, Member {resendModal.memberId}
                        </div>
                        <div className="modal__body">
                            <div className="muted">
                                Because Abacus stores only a hash, you must re-enter the email to resend. We will verify it matches the
                                saved hash.
                            </div>

                            <label className="field__label" htmlFor="resend-email">
                                Student email
                            </label>
                            <input
                                id="resend-email"
                                className="field__input"
                                type="email"
                                placeholder="student@school.edu"
                                value={resendModal.email}
                                onChange={(e) => setResendModal({ ...resendModal, email: e.target.value, error: "" })}
                                autoComplete="off"
                            />

                            {resendModal.error ? <div className="inline-error">{resendModal.error}</div> : null}
                        </div>
                        <div className="modal__actions">
                            <button
                                className="btn btn--secondary"
                                type="button"
                                onClick={() => setResendModal(null)}
                                disabled={resendModal.isSending}
                            >
                                Cancel
                            </button>
                            <button className="btn btn--primary" type="button" onClick={confirmResendInvite} disabled={resendModal.isSending}>
                                {resendModal.isSending ? "Sending…" : "Resend email"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}