import { useEffect, useState, useRef, useLayoutEffect, useMemo, JSX, useCallback } from "react"
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet"
import axios from "axios";
import MenuComponent from "../components/MenuComponent"
import SegmentedControl from "../components/SegmentedControl";
import ErrorMessage from "../components/ErrorMessage";
import LoadingAnimation from "../components/LoadingAnimation";

import { 
    FaQuestionCircle,
    FaSnowflake,
    FaTrophy,
    FaClock,
    FaSync,
    FaHourglassHalf,
    FaFlask,
    FaDownload,
} from "react-icons/fa";

import "../../styling/Scoreboard.scss";

type Role = "admin" | "teacher" | "student";
type Division = "Blue" | "Gold";
type ProjectType = "competition" | "practice";

type ScoreboardStatus =
    | "practice"
    | "upcoming"
    | "live"
    | "frozen"
    | "frozen-admin"
    | "awaiting-results"
    | "final";

type ProjectEntry = {
    id: number;
    orderIndex: number;
}

type TeamProjectEntry = {
    id: number;
    attempts: number;
    solved: boolean;
    acceptedTimeMinutes: number | null;
    currentSubmissionId: number | null;
}

type TeamEntry = {
    teamId: number;
    teamName: string;
    schoolName: string;
    solvedCount: number;
    totalPenalty: number;
    lastAcceptedTime: number;
    projects: TeamProjectEntry[];
    rankDelta?: number;
}

type ApiResponse = {
    projects: ProjectEntry[];
    teams: TeamEntry[];
    status: ScoreboardStatus;
    timestamp?: string;
    transitionAt?: string;
}

type StatusDisplay = {
    class: string;
    icon?: JSX.Element;
    title: string;
    subtitle: string;
    pill?: string;
    metaLeft?: React.ReactNode;
    metaRight?: React.ReactNode;
}

type MetaChipProps = {
    label: string;
    value: string;
    status: string;
    icon: React.ReactNode;
    onClick?: () => void;
};

const REFRESH_INTERVAL_SECONDS = 60;
const REFRESH_OFFSET_SECONDS = 3;
const REFRESH_JITTER_SECONDS = 3;
const MAX_FAILED_REFRESHES = 3;
const SCORE_TOOLTIP_TEXT = (
    <>
        Teams are ranked by problems solved, then by lowest penalty time.
        <br /><br />
        Penalty time = accepted time + 20 minutes for each wrong submission before acceptance.
        <br /><br />
        Wrong submissions on unsolved problems do not count.
    </>
);
const PROJECT_COLORS = [
    "project--blue",
    "project--green",
    "project--lightblue",
    "project--orange",
    "project--purple",
    "project--red",
    "project--pink",
    "project--yellow",
    "project--black",
    "project--white",
] as const;

function formatTimestamp(isoString?: string | null): string {
    if (!isoString) return "--";

    const date = new Date(isoString);

    if (Number.isNaN(date.getTime())) return "--";

    return date.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
    });
}

function formatDuration(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000);

    if (totalSeconds <= 0) return "0:00";

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    }
    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function MetaChip({ label, value, status, icon, onClick }: MetaChipProps) {
    return (
        <div
            className={`scoreboard-meta-chip scoreboard-meta-chip--${status}`}
            onClick={onClick}
            role={onClick ? "button" : undefined}
            style={onClick ? { cursor: "pointer" } : undefined}
        >
            <span className="scoreboard-meta-chip__icon">{icon}</span>
            <div className="scoreboard-meta-chip__text">
                {label && <span className="scoreboard-meta-chip__label">{label}</span>}
                <span className="scoreboard-meta-chip__value">{value}</span>
            </div>
        </div>
    );
}

function getProjectColor(index: number): string {
    return PROJECT_COLORS[index % PROJECT_COLORS.length];
}

export default function Scoreboard() {
    const API = (import.meta.env.VITE_API_URL as string) || "";
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [role, setRole] = useState<Role | null>(null);
    const isRefreshing = useRef<boolean>(false);
    const isAdmin = role === "admin";

    // Errors
    const [error, setError] = useState<string | null>(null);
    const [refreshError, setRefreshError] = useState<boolean>(false);
    const failedRefreshCount = useRef<number>(0);

    // Filters
    const [division, setDivision] = useState<Division>("Blue");
    const [isOnline, setIsOnline] = useState<boolean>(false);
    const [projectType, setProjectType] = useState<ProjectType>("competition");

    // Data
    const [teams, setTeams] = useState<TeamEntry[]>([]);
    const [projects, setProjects] = useState<ProjectEntry[]>([]);
    const [countdown, setCountdown] = useState<number>(REFRESH_INTERVAL_SECONDS);
    const [status, setStatus] = useState<ScoreboardStatus>("upcoming");
    const [timestamp, setTimestamp] = useState<string | null>(null);
    const [transitionAt, setTransitionAt] = useState<number | null>(null);
    const [transitionCountdown, setTransitionCountdown] = useState<string>("");

    const jitterMsRef = useRef<number>(Math.floor(Math.random() * REFRESH_JITTER_SECONDS * 1000));
    const prevRankByTeamIdRef = useRef<Map<number, number>>(new Map());

    // Animating rank changes refs
    const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
    const prevRowTopsRef = useRef<Map<number, number>>(new Map());
    const animateNextLayoutRef = useRef<boolean>(false);

    function authConfig() {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }

    // Fetches scoreboard data
    const fetchScoreboard = useCallback(async (refresh = false) => {
        if (isRefreshing.current) return;

        let loadingTimer : number | undefined;

        if (refresh) isRefreshing.current = true;
        else {
            setError(null);
            loadingTimer = window.setTimeout(() => {
                setIsLoading(true);
            }, 300);
        }

        try {
            const res = await axios.get<ApiResponse>(`${API}/teams/scoreboard`,
                {
                    ...authConfig(),
                    params: { division: division, is_online: isOnline, project_type: projectType },
                }
            );
            const apiTeams = Array.isArray(res.data.teams) ? res.data.teams : [];
            const apiProjects = Array.isArray(res.data.projects) ? res.data.projects : [];
            const timestampRaw = res.data.timestamp ?? null;
            const transitionRaw = res.data.transitionAt ?? null;

            const newTeams = apiTeams.map((team, idx) => {
                const newRank = idx + 1;
                const oldRank = prevRankByTeamIdRef.current.get(team.teamId);

                return { ...team, rankDelta: refresh && oldRank !== undefined ? oldRank - newRank : 0 };
            });

            prevRankByTeamIdRef.current = new Map(newTeams.map((t, i) => [t.teamId, i + 1]));
            animateNextLayoutRef.current = refresh;

            setTeams(newTeams);
            setProjects(apiProjects);
            setStatus(res.data.status ?? "upcoming");
            setTimestamp(formatTimestamp(timestampRaw));
            setTransitionAt(transitionRaw ? new Date(transitionRaw).getTime() : null);

            setRefreshError(false);
            failedRefreshCount.current = 0;
        } catch (err: any) {
            if (refresh) {
                failedRefreshCount.current += 1;
                setRefreshError(true);
            } else {
                setError(err.response?.data?.message || "Unable to load scoreboard data");
            }
        } finally {
            if (!refresh) {
                if (loadingTimer !== undefined) window.clearTimeout(loadingTimer);
                setIsLoading(false);
            }
            isRefreshing.current = false;
        }
    }, [API, division, isOnline, projectType]);

    // Initial scoreboard fetch
    useEffect(() => {
        void fetchScoreboard();
    }, [fetchScoreboard]);

    // Clear rank references when filters change
    useEffect(() => {
        prevRankByTeamIdRef.current = new Map();
        prevRowTopsRef.current = new Map();
    }, [division, isOnline, projectType]);

    // Handles auto-refresh for live scoreboard
    const shouldAutoRefresh = status === "live" || status === "frozen-admin";
    useEffect(() => {
        if (!shouldAutoRefresh) return;

        let cancelled = false;
        let timers: number[] = [];

        const clearTimers = () => {
            timers.forEach(id => window.clearTimeout(id));
            timers = [];
        };

        const scheduleRefresh = () => {
            if (cancelled) return;
            clearTimers();

            const now = Date.now();
            const intervalMs = REFRESH_INTERVAL_SECONDS * 1000;
            const offsetMs = REFRESH_OFFSET_SECONDS * 1000;

            const lastAlignedMinute = Math.floor(now / intervalMs) * intervalMs;
            let nextRefreshAt = lastAlignedMinute + offsetMs + jitterMsRef.current;
            if (now >= nextRefreshAt) {
                nextRefreshAt += intervalMs;
            }

            const msUntilRefresh = nextRefreshAt - now;

            setCountdown(Math.ceil(msUntilRefresh / 1000));

            // Countdown timer
            const countdownInterval = window.setInterval(() => {
                if (cancelled) return;
                const remaining = Math.max(0, nextRefreshAt - Date.now());
                setCountdown(Math.ceil(remaining / 1000));
            }, 1000);
            timers.push(countdownInterval);

            // Refresh timer
            const refreshTimer = window.setTimeout(async () => {
                if (cancelled) return;
                window.clearInterval(countdownInterval);

                if (document.visibilityState === "visible") {
                    await fetchScoreboard(true);
                }

                scheduleRefresh();
            }, msUntilRefresh);
            timers.push(refreshTimer);
        };

        scheduleRefresh();

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                scheduleRefresh();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            cancelled = true;
            clearTimers();
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [shouldAutoRefresh, fetchScoreboard]);

    const shouldTransition = status === "upcoming" || status === "frozen" || status === "awaiting-results";
    // Handles auto-refresh for upcoming/frozen/awaiting-results scoreboard
    useEffect(() => {
        if (!shouldTransition || !transitionAt) return;

        const msUntil = transitionAt - Date.now() + REFRESH_OFFSET_SECONDS * 1000;

        if (msUntil <= 0) {
            fetchScoreboard(true);
            return;
        }

        const timer = window.setTimeout(() => {
            fetchScoreboard(true);
        }, msUntil);

        return () => window.clearTimeout(timer);
    }, [status, transitionAt, fetchScoreboard]);

    // Handles countdown for upcoming/frozen/awaiting-results transitions
    useEffect(() => {
        if (!shouldTransition || !transitionAt) return;

        const offsetMs = REFRESH_OFFSET_SECONDS * 1000;

        const tick = () => {
            const remaining = Math.max(0, transitionAt + offsetMs - Date.now());
            setTransitionCountdown(remaining > 0 ? formatDuration(remaining) : "Refreshing...");
        };

        tick();
        const interval = window.setInterval(tick, 1000);

        return () => window.clearInterval(interval);
    }, [status, transitionAt]);

    // Handles rank change animations
    useLayoutEffect(() => {
        const nextTops = new Map<number, number>();

        teams.forEach((team) => {
            const el = rowRefs.current.get(team.teamId);
            if (!el) return;

            const newTop = el.getBoundingClientRect().top;
            nextTops.set(team.teamId, newTop);

            if (!animateNextLayoutRef.current) return;

            const oldTop = prevRowTopsRef.current.get(team.teamId);
            if (oldTop === undefined) return;

            const deltaY = oldTop - newTop;
            if (deltaY === 0) return;

            el.style.transition = "";
            el.style.transform = "";

            el.style.transition = "none";
            el.style.transform = `translateY(${deltaY}px)`;
            void el.getBoundingClientRect();

            requestAnimationFrame(() => {
                el.style.transition = "transform 600ms cubic-bezier(0.22, 1, 0.36, 1)";
                el.style.transform = "translateY(0)";
            });

            const cleanup = () => {
                el.style.transition = "";
                el.style.transform = "";
                el.removeEventListener("transitionend", cleanup);
            };
            el.addEventListener("transitionend", cleanup);
        });

        prevRowTopsRef.current = nextTops;
        animateNextLayoutRef.current = false;
    }, [teams]);

    async function handleDownloadScoreboard() {
        try {
            const res = await axios.get<Blob>(`${API}/teams/scoreboard/download`, {
                ...authConfig(),
                params: { division: division, is_online: isOnline },
                responseType: "blob",
            })
            const a = document.createElement("a");
            const url = window.URL.createObjectURL(res.data);
            a.href = url;
            a.download = `Scoreboard_${division}_${isOnline ? "Virtual" : "InPerson"}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            alert(err.response?.data?.message || "Unable to download scoreboard");
        }
    }

    const statusDisplay: StatusDisplay = useMemo(() => {
        switch (status) {
            case "practice":
                return {
                    class: status,
                    icon: <FaFlask />,
                    title: "Practice Scoreboard",
                    subtitle: "View standings based on practice submissions",
                    pill: "Practice",
                    metaLeft: timestamp ? (
                        <MetaChip
                            label="Generated at"
                            value={timestamp}
                            status={status}
                            icon={<FaClock size={16}/>}
                        />
                    ) : undefined,
                    metaRight: <MetaChip
                        label="Refresh"
                        value=""
                        status={"action atm-btn"}
                        icon={<FaSync size={14}/>}
                        onClick={() => fetchScoreboard(false)}
                    />,
                };
            case "upcoming":
                return {
                    class: status,
                    icon: <FaClock />,
                    title: "Scoreboard is not live",
                    subtitle: "Standings will appear once the competition begins",
                    pill: "Not live",
                    metaLeft: transitionCountdown ? (
                        <MetaChip
                            label="Starts in"
                            value={transitionCountdown}
                            status={status}
                            icon={<FaHourglassHalf size={16}/>}
                        />
                    ) : undefined,
                };
            case "live":
                return {
                    class: status,
                    icon: <span key={timestamp} className="live-dot" />,
                    title: "Scoreboard is live",
                    subtitle: "Standings refresh every minute",
                    pill: "Live",
                    metaLeft: timestamp ? (
                        <MetaChip
                            label="Last updated"
                            value={timestamp}
                            status={status}
                            icon={<FaClock size={16}/>}
                        />
                    ) : undefined,
                    metaRight: countdown > 0 ? (
                        <MetaChip
                            label="Refreshing in"
                            value={`${countdown}s`}
                            status={status}
                            icon={<FaSync size={16}/>}
                        />
                    ) : undefined,
                };
            case "frozen":
                return {
                    class: status,
                    icon: <FaSnowflake />,
                    title: "Scoreboard is frozen",
                    subtitle: "Standings are frozen until the end of the competition",
                    pill: "Frozen",
                    metaLeft: timestamp ? (
                        <MetaChip
                            label="Frozen at"
                            value={timestamp}
                            status={status}
                            icon={<FaClock size={16}/>}
                        />
                    ) : undefined,
                    metaRight: transitionCountdown ? (
                        <MetaChip
                            label="Competition ends in"
                            value={transitionCountdown}
                            status={status}
                            icon={<FaHourglassHalf size={16}/>}
                        />
                    ) : undefined,
                };
            case "frozen-admin":
                return {
                    class: status,
                    icon: <span key={timestamp} className="live-dot" />,
                    title: "Scoreboard is frozen (admin view)",
                    subtitle: "Standings are frozen for teams but live for admins",
                    pill: "Frozen (Admin)",
                    metaLeft: timestamp ? (
                        <MetaChip
                            label="Last updated"
                            value={timestamp}
                            status={status}
                            icon={<FaClock size={16}/>}
                        />
                    ) : undefined,
                    metaRight: countdown > 0 ? (
                        <MetaChip
                            label="Refreshing in"
                            value={`${countdown}s`}
                            status={status}
                            icon={<FaSync size={16}/>}
                        />
                    ) : undefined,
                };
            case "awaiting-results":
                return {
                    class: status,
                    icon: <FaTrophy />,
                    title: "Awaiting final results",
                    subtitle: "Final standings will be revealed after the award ceremony",
                    pill: "Awaiting Results",
                    metaLeft: transitionCountdown ? (
                        <MetaChip
                            label="Final results in"
                            value={transitionCountdown}
                            status={status}
                            icon={<FaHourglassHalf size={16}/>}
                        />
                    ) : undefined,
                };
            case "final":
                return {
                    class: status,
                    icon: <FaTrophy />,
                    title: "Final standings",
                    subtitle: "Competition has ended",
                    pill: "Final",
                    metaLeft: timestamp ? (
                        <MetaChip
                            label="Finalized at"
                            value={timestamp}
                            status={status}
                            icon={<FaClock size={16}/>}
                        />
                    ) : undefined,
                };
            default:
                return {
                    class: "",
                    title: "Loading...",
                    subtitle: "Fetching submissions",
                };
        }
    }, [status, timestamp, countdown, transitionCountdown]);

    const scoreboardVisible = (status !== "upcoming" && status !== "awaiting-results") || isAdmin;

    if (isLoading) {
        return <LoadingAnimation show={true} message="Loading scoreboard..." />;
    }

    if (error) {
        return (
            <>
                <ErrorMessage message={error} isHidden={false} />
                <button className="atm-btn" onClick={() => fetchScoreboard(false)}>Retry</button>
            </>
        );
    }

    return (
        <>
            <Helmet>
                <title>{isAdmin ? "[Admin] Abacus" : "Abacus"}</title>
            </Helmet>

            <MenuComponent 
                onUserRole={setRole}
                variant="public"
            />

            <div className="scoreboard-root">

                <div className="pageTitle">Scoreboard</div>

                <div className="scoreboard-content">
                    <div className="scoreboard-info">
                        <div className="scoreboard-filters">
                            <div className="filters-left">
                                {/* TODO: re-enable division filter when we have Gold division support
                                <div className="filter-group">
                                    <label className="filter-label">Division</label>
                                    <SegmentedControl
                                        className="segment-division"
                                        options={[{ label: "Blue", value: "Blue" }, { label: "Gold", value: "Gold" }]}
                                        value={division}
                                        onChange={(v) => setDivision(v as Division)}
                                        getOptionClassName={(v) => v.toLowerCase()}
                                    />
                                </div>
                                */}
                                <div className="filter-group">
                                    <label className="filter-label">Attendance</label>
                                    <SegmentedControl
                                        className="segment-attendance"
                                        options={[{ label: "In-person", value: false }, { label: "Virtual", value: true }]}
                                        value={isOnline}
                                        onChange={(v) => setIsOnline(v as boolean)}
                                        getOptionClassName={(v) => v ? 'virtual' : 'inperson'}
                                    />
                                </div>
                                {isAdmin && (
                                    <>
                                        <div className="filter-group">
                                            <label className="filter-label">Problem Type</label>
                                            <SegmentedControl
                                                className="segment-project-type"
                                                options={[{ label: "Competition", value: "competition" }, { label: "Practice", value: "practice" }]}
                                                value={projectType}
                                                onChange={(v) => setProjectType(v as ProjectType)}
                                                getOptionClassName={(v) => v}
                                            />
                                        </div>
                                        <div className="filter-group">
                                            <button 
                                                className="atm-btn scoreboard-download-btn"
                                                onClick={handleDownloadScoreboard}
                                            >
                                                <FaDownload size={14} />
                                                Download as Excel
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="filters-right">
                                <div className="leaderboard-legend">
                                    <div className="score-header">
                                        <div className="score-tooltip-wrapper">
                                            <button
                                                type="button"
                                                className="score-tooltip-button"
                                                aria-label="Explain score"
                                            >
                                                <FaQuestionCircle  className="score-tooltip-icon"/>
                                            </button>

                                            <div className="score-tooltip score-tooltip--left">
                                                {SCORE_TOOLTIP_TEXT}
                                            </div>
                                        </div>
                                        <div className="legend-text">
                                            Score: solved & penalty &bull; lower penalty breaks ties
                                        </div>
                                    </div>

                                    <div className="legend-text">
                                        P1-Pn: attempts
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="scoreboard-status">
                            <div className="scoreboard-status__top">
                                <div className="scoreboard-status__heading">
                                    <div className="scoreboard-status__header">Status</div>
                                    <div className="scoreboard-status__title">
                                        {statusDisplay.title}
                                    </div>
                                    <div className="scoreboard-status__subtitle">
                                        {statusDisplay.subtitle}
                                    </div>
                                </div>
                                {statusDisplay.pill && (
                                    <div className={`scoreboard-status__pill scoreboard-status__pill--${statusDisplay.class}`}>
                                        {statusDisplay.icon && (
                                            <span className={`scoreboard-status__icon scoreboard-status__icon--${statusDisplay.class}`}>
                                                {statusDisplay.icon}
                                            </span>
                                        )}
                                        <span className="scoreboard-status__pill-text">{statusDisplay.pill}</span>
                                    </div>
                                )}
                            </div>
                            <div className="scoreboard-status__bottom">
                                {statusDisplay.metaLeft && (
                                    <>{statusDisplay.metaLeft}</>
                                )}
                                {statusDisplay.metaRight && (
                                    <>
                                        {statusDisplay.metaRight}
                                    </>
                                )}
                            </div>
                            {refreshError && (
                                <ErrorMessage
                                    message={
                                        failedRefreshCount.current >= MAX_FAILED_REFRESHES
                                            ? "Unable to reach server — scoreboard data may be outdated"
                                            : "Refresh failed — retrying next cycle"
                                    }
                                    isHidden={!refreshError}
                                />
                            )}
                        </div>
                    </div>
                    {scoreboardVisible && (
                        <table className="scoreboard-table">
                            <thead className="scoreboard-table-head">
                                <tr className="scoreboard-table-row">
                                    <th className="scoreboard-table-header">Rank</th>
                                    <th className="scoreboard-table-header"></th>
                                    <th className="scoreboard-table-header">Team</th>
                                    <th className="scoreboard-table-header">School</th>
                                    <th className="scoreboard-table-header">
                                        <div className="score-header">
                                            <span>Score</span>

                                            <div className="score-tooltip-wrapper">
                                                <button
                                                    type="button"
                                                    className="score-tooltip-button"
                                                    aria-label="Explain score"
                                                >
                                                    <FaQuestionCircle  className="score-tooltip-icon"/>
                                                </button>

                                                <div className="score-tooltip score-tooltip--bottom">
                                                    {SCORE_TOOLTIP_TEXT}
                                                </div>
                                            </div>
                                        </div>
                                    </th>
                                    {projects.map((project, idx) => (
                                        <th 
                                            key={project.id}
                                            className="scoreboard-table-header"
                                            title = {`Problem ${project.orderIndex}`}
                                        >
                                            <span 
                                                className={`scoreboard-project-number ${getProjectColor(idx)}`}
                                            >
                                                P{project.orderIndex}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="scoreboard-table-body">
                                {teams.length === 0 ? (
                                    <tr className="scoreboard-table-row">
                                        <td colSpan={5 + projects.length} className="scoreboard-table-cell scoreboard-no-teams">
                                            No teams to display.
                                        </td>
                                    </tr>
                                ) : (
                                    teams.map((team, index) => (
                                        <tr
                                            key={team.teamId}
                                            ref={(row) => {
                                                if (row) rowRefs.current.set(team.teamId, row);
                                                else rowRefs.current.delete(team.teamId);
                                            }}
                                            className={`scoreboard-table-row ${
                                                index === 0 ? "scoreboard-row-first"
                                                : index === 1 ? "scoreboard-row-second"
                                                : index === 2 ? "scoreboard-row-third"
                                                : ""
                                            }`}
                                        >
                                            <td className="scoreboard-table-cell scoreboard-rank-cell">
                                                <span
                                                    className={`scoreboard-rank-badge ${
                                                        index === 0 ? "scoreboard-rank-first"
                                                        : index === 1 ? "scoreboard-rank-second"
                                                        : index === 2 ? "scoreboard-rank-third"
                                                        : ""
                                                    }`}
                                                >
                                                    {index + 1}
                                                </span>
                                            </td>
                                            <td className="scoreboard-table-cell scoreboard-delta-cell">
                                                {team.rankDelta !== undefined && team.rankDelta !== 0 && (
                                                    <span
                                                        className={`rank-delta ${
                                                                team.rankDelta > 0 ? "rank-up" : "rank-down"
                                                            } rank-delta-visible`}
                                                    >
                                                        {Math.abs(team.rankDelta)}
                                                    </span>
                                                )}
                                            </td>
                                            <td 
                                                className="scoreboard-table-cell scoreboard-team-cell"
                                                title={team.teamName}
                                            >
                                                {team.teamName}
                                            </td>
                                            <td
                                                className="scoreboard-table-cell scoreboard-school-cell"
                                                title={team.schoolName}
                                            >
                                                {team.schoolName}
                                            </td>
                                            <td 
                                                className="scoreboard-table-cell scoreboard-score-cell"
                                                title={`${team.solvedCount} solve${team.solvedCount !== 1 ? 's' : ''} | ${team.totalPenalty} penalty`}
                                            >
                                                <div className="scoreboard-score-pill">
                                                    <span className="score-pill__solves">{team.solvedCount}</span>
                                                    <span className="score-pill__divider" />
                                                    <span className="score-pill__penalty">{team.totalPenalty}</span>
                                                </div>
                                            </td>
                                            {team.projects.map((project) => {
                                                const pillClass = `scoreboard-project-pill ${
                                                    project.solved && project.attempts === 1 ? "solved-first"
                                                    : project.solved ? "solved"
                                                    : project.attempts > 0 ? "attempted"
                                                    : ""
                                                }`;
                                                const pillValue = project.attempts > 0 ? project.attempts : "";

                                                return (
                                                    <td 
                                                        key={project.id} 
                                                        className="scoreboard-table-cell scoreboard-project-cell"
                                                        title={`${project.solved ? `Solved at ${project.acceptedTimeMinutes} minutes` : project.attempts > 0 ? "Unsolved" : "Not attempted"
                                                            }${project.attempts > 0 ? ` | ${project.attempts} attempt${project.attempts > 1 ? 's' : ''}` : ""}`}
                                                    >
                                                        {isAdmin && project.currentSubmissionId ? (
                                                            <Link 
                                                                to={`/submission/${project.currentSubmissionId}`}
                                                                className={`${pillClass} scoreboard-project-pill__link`}
                                                            >
                                                                {pillValue}
                                                            </Link>
                                                        ) : (
                                                            <div className={pillClass}>
                                                                {pillValue}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </>
    )
}