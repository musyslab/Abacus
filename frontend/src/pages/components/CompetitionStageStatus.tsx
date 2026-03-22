import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

import "../../styling/CompetitionStageStatus.scss";

export type CompetitionStage =
    | "before-practice"
    | "practice"
    | "competition"
    | "over";

export type VisibleProjectType = "practice" | "competition";

export type CompetitionSchedule = {
    practiceStart: string;
    practiceEnd: string;
    competitionStart: string;
    competitionEnd: string;
};

type CountdownParts = {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
};

const API_BASE = (import.meta.env.VITE_API_URL as string) || "";

let competitionScheduleCache: CompetitionSchedule | null = null;
let competitionSchedulePromise: Promise<CompetitionSchedule> | null = null;

function pad2(value: number) {
    return String(value).padStart(2, "0");
}

function parseNaiveDateTime(value: string): Date {
    const [datePart, timePart = "00:00:00"] = String(value || "").split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hours, minutes, seconds] = timePart.split(":").map(Number);

    return new Date(
        year || 0,
        (month || 1) - 1,
        day || 1,
        hours || 0,
        minutes || 0,
        seconds || 0
    );
}

function parseCompetitionSchedule(data: any): CompetitionSchedule {
    const practiceStart = String(data?.practiceStart || "").trim();
    const practiceEnd = String(data?.practiceEnd || "").trim();
    const competitionStart = String(data?.competitionStart || "").trim();
    const competitionEnd = String(data?.competitionEnd || "").trim();

    if (!practiceStart || !practiceEnd || !competitionStart || !competitionEnd) {
        throw new Error("Invalid competition schedule response.");
    }

    return {
        practiceStart,
        practiceEnd,
        competitionStart,
        competitionEnd,
    };
}

export async function fetchCompetitionSchedule(
    apiBase: string = API_BASE
): Promise<CompetitionSchedule> {
    if (competitionScheduleCache) {
        return competitionScheduleCache;
    }

    if (!competitionSchedulePromise) {
        competitionSchedulePromise = axios
            .get(`${apiBase}/projects/competition_schedule`)
            .then((res) => {
                const parsed = parseCompetitionSchedule(res.data);
                competitionScheduleCache = parsed;
                return parsed;
            })
            .finally(() => {
                competitionSchedulePromise = null;
            });
    }

    return competitionSchedulePromise;
}

export function getCompetitionStage(
    schedule: CompetitionSchedule,
    now: Date = new Date()
): CompetitionStage {
    const practiceStart = parseNaiveDateTime(schedule.practiceStart);
    const competitionStart = parseNaiveDateTime(schedule.competitionStart);
    const competitionEnd = parseNaiveDateTime(schedule.competitionEnd);

    const nowMs = now.getTime();

    if (nowMs < practiceStart.getTime()) {
        return "before-practice";
    }

    if (nowMs < competitionStart.getTime()) {
        return "practice";
    }

    if (nowMs < competitionEnd.getTime()) {
        return "competition";
    }

    return "over";
}

export function getVisibleProjectType(
    schedule: CompetitionSchedule,
    now: Date = new Date()
): VisibleProjectType | null {
    const stage = getCompetitionStage(schedule, now);

    if (stage === "practice") {
        return "practice";
    }

    if (stage === "competition") {
        return "competition";
    }

    return null;
}

export function filterProjectsForCurrentStage<T extends { Type: string }>(
    projects: T[],
    schedule: CompetitionSchedule | null,
    now: Date = new Date()
): T[] {
    if (!schedule) {
        return [];
    }

    const visibleType = getVisibleProjectType(schedule, now);

    if (!visibleType) {
        return [];
    }

    return projects.filter(
        (project) => String(project.Type || "").toLowerCase() === visibleType
    );
}

function getCountdownParts(target: Date, now: Date): CountdownParts {
    const diffMs = Math.max(0, target.getTime() - now.getTime());
    const totalSeconds = Math.floor(diffMs / 1000);

    return {
        days: Math.floor(totalSeconds / 86400),
        hours: Math.floor((totalSeconds % 86400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
    };
}

export default function CompetitionStageStatus() {
    const [schedule, setSchedule] = useState<CompetitionSchedule | null>(
        competitionScheduleCache
    );
    const [loadError, setLoadError] = useState<string>("");
    const [now, setNow] = useState<Date>(() => new Date());

    useEffect(() => {
        let active = true;

        fetchCompetitionSchedule()
            .then((data) => {
                if (!active) return;
                setSchedule(data);
                setLoadError("");
            })
            .catch(() => {
                if (!active) return;
                setSchedule(null);
                setLoadError("Failed to load competition status.");
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setNow(new Date());
        }, 1000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, []);

    const stage = useMemo<CompetitionStage | null>(() => {
        if (!schedule) return null;
        return getCompetitionStage(schedule, now);
    }, [schedule, now]);

    const countdown = useMemo<CountdownParts>(() => {
        if (!schedule || !stage) {
            return {
                days: 0,
                hours: 0,
                minutes: 0,
                seconds: 0,
            };
        }

        if (stage === "before-practice") {
            return getCountdownParts(parseNaiveDateTime(schedule.practiceStart), now);
        }

        if (stage === "practice") {
            return getCountdownParts(parseNaiveDateTime(schedule.competitionStart), now);
        }

        if (stage === "competition") {
            return getCountdownParts(parseNaiveDateTime(schedule.competitionEnd), now);
        }

        return {
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0,
        };
    }, [schedule, stage, now]);

    const stageText = useMemo(() => {
        if (loadError) {
            return {
                title: "Competition status unavailable",
                subtitle: loadError,
                pill: "Unavailable",
                stageClass: "over" as CompetitionStage,
            };
        }

        if (!stage) {
            return {
                title: "Loading competition status",
                subtitle: "Fetching the current event schedule",
                pill: "Loading",
                stageClass: "before-practice" as CompetitionStage,
            };
        }

        if (stage === "before-practice") {
            return {
                title: "Practice has not started yet",
                subtitle: "Time until practice opens",
                pill: "Before Practice",
                stageClass: stage,
            };
        }

        if (stage === "practice") {
            return {
                title: "Practice mode is live",
                subtitle: "Time until the competition starts",
                pill: "Practice",
                stageClass: stage,
            };
        }

        if (stage === "competition") {
            return {
                title: "Competition is live",
                subtitle: "Time remaining in the competition",
                pill: "Competition",
                stageClass: stage,
            };
        }

        return {
            title: "Competition is over",
            subtitle: "The event has ended",
            pill: "Finished",
            stageClass: stage,
        };
    }, [stage, loadError]);

    return (
        <section
            className={`competition-stage-status competition-stage-status--${stageText.stageClass}`}
            aria-label="Competition stage status"
        >
            <div className="competition-stage-status__top">
                <div className="competition-stage-status__text">
                    <div className="competition-stage-status__eyebrow">
                        Competition Status
                    </div>
                    <div className="competition-stage-status__title">
                        {stageText.title}
                    </div>
                    <div className="competition-stage-status__subtitle">
                        {stageText.subtitle}
                    </div>
                </div>

                <div
                    className={`competition-stage-status__pill competition-stage-status__pill--${stageText.stageClass}`}
                >
                    {stageText.pill}
                </div>
            </div>

            <div
                className="competition-stage-status__countdown"
                aria-live="polite"
            >
                <div className="competition-stage-status__unit">
                    <div className="competition-stage-status__value">
                        {pad2(countdown.days)}
                    </div>
                    <div className="competition-stage-status__label">Days</div>
                </div>

                <div className="competition-stage-status__unit">
                    <div className="competition-stage-status__value">
                        {pad2(countdown.hours)}
                    </div>
                    <div className="competition-stage-status__label">Hours</div>
                </div>

                <div className="competition-stage-status__unit">
                    <div className="competition-stage-status__value">
                        {pad2(countdown.minutes)}
                    </div>
                    <div className="competition-stage-status__label">Minutes</div>
                </div>

                <div className="competition-stage-status__unit">
                    <div className="competition-stage-status__value">
                        {pad2(countdown.seconds)}
                    </div>
                    <div className="competition-stage-status__label">Seconds</div>
                </div>
            </div>
        </section>
    );
}