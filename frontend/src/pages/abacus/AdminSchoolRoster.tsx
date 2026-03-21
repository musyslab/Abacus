import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { FaSearch } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";
import MenuComponent from "../components/MenuComponent";
import "../../styling/AdminSchoolRoster.scss";

type Division = "Blue" | "Gold" | "Eagle";
type FilterMode = "all" | Division;

type TeacherInfo = {
  id: number;
  name: string | null;
  email: string | null;
};

type DivisionSummary = {
  teamCount: number;
  studentCount: number;
};

type SchoolSummary = {
  id: number;
  name: string;
  teachers: TeacherInfo[] | null;
  teamCount: number;
  studentCount: number;
  divisions: Record<Division, DivisionSummary> | null;
};

const DIVISIONS: Division[] = ["Blue", "Gold", "Eagle"];
const DIVISION_CAPS: Record<Division, number> = {
  Blue: 80,
  Gold: 80,
  Eagle: 20,
};

const VIEW_OPTIONS: { label: string; value: FilterMode }[] = [
  { label: "All", value: "all" },
  { label: "Blue", value: "Blue" },
  { label: "Gold", value: "Gold" },
  { label: "Eagle", value: "Eagle" },
];

const EMPTY_DIVISION_SUMMARY: DivisionSummary = {
  teamCount: 0,
  studentCount: 0,
};

function getDivisionSummary(
  school: SchoolSummary,
  division: Division
): DivisionSummary {
  return school.divisions?.[division] || EMPTY_DIVISION_SUMMARY;
}

function getTeamCountForView(school: SchoolSummary, view: FilterMode): number {
  if (view === "all") return Number(school.teamCount || 0);
  return Number(getDivisionSummary(school, view).teamCount || 0);
}

function getStudentCountForView(school: SchoolSummary, view: FilterMode): number {
  if (view === "all") return Number(school.studentCount || 0);
  return Number(getDivisionSummary(school, view).studentCount || 0);
}

const AdminSchoolRoster = () => {
  const apiBase = (import.meta.env.VITE_API_URL as string) || "";
  const navigate = useNavigate();

  const [schools, setSchools] = useState<SchoolSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedView, setSelectedView] = useState<FilterMode>("all");

  function authConfig() {
    const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  async function fetchSchoolSummary() {
    setIsLoading(true);
    setPageError("");
    try {
      const res = await axios.get<SchoolSummary[]>(
        `${apiBase}/schools/admin/summary`,
        authConfig()
      );
      const data = Array.isArray(res.data) ? res.data : [];
      const sorted = data
        .slice()
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setSchools(sorted);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to load schools.";
      setPageError(msg);
      setSchools([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchSchoolSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return schools;

    return schools.filter((s) => {
      const schoolName = (s.name || "").toLowerCase();
      const teacherMatch = (s.teachers || []).some(
        (t) =>
          (t.name || "").toLowerCase().includes(q) ||
          (t.email || "").toLowerCase().includes(q)
      );

      return schoolName.includes(q) || teacherMatch;
    });
  }, [schools, query]);

  const overallSummary = useMemo(() => {
    const summary: {
      totalTeams: number;
      totalStudents: number;
      divisions: Record<Division, DivisionSummary>;
    } = {
      totalTeams: 0,
      totalStudents: 0,
      divisions: {
        Blue: { teamCount: 0, studentCount: 0 },
        Gold: { teamCount: 0, studentCount: 0 },
        Eagle: { teamCount: 0, studentCount: 0 },
      },
    };

    for (const school of schools) {
      summary.totalTeams += Number(school.teamCount || 0);
      summary.totalStudents += Number(school.studentCount || 0);

      for (const division of DIVISIONS) {
        const divisionSummary = getDivisionSummary(school, division);
        summary.divisions[division].teamCount += Number(
          divisionSummary.teamCount || 0
        );
        summary.divisions[division].studentCount += Number(
          divisionSummary.studentCount || 0
        );
      }
    }

    return summary;
  }, [schools]);

  const selectedViewLabel =
    selectedView === "all" ? "All divisions" : `${selectedView} division`;

  return (
    <>
      <Helmet>
        <title>Abacus</title>
      </Helmet>

      <MenuComponent showProblemList={true} showAdminUpload={true} />

      <div className="admin-school-roster-root">
        <DirectoryBreadcrumbs
          items={[{ label: "School List" }]}
          trailingSeparator={true}
        />

        <div className="pageTitle">School List</div>

        <div className="admin-school-roster-container">
          <div className="roster-overview">
            <div className="overview-card overview-card--primary">
              <div className="overview-card__eyebrow">Overall roster totals (Across All Schools)</div>
              <div className="overview-card__headline">
                {overallSummary.totalTeams} Teams
              </div>
              <div className="overview-card__subheadline">
                {overallSummary.totalStudents} Students
              </div>
            </div>

            {DIVISIONS.map((division) => {
              const teamsUsed = overallSummary.divisions[division].teamCount;
              const studentsInDivision =
                overallSummary.divisions[division].studentCount;
              const cap = DIVISION_CAPS[division];
              const remaining = Math.max(cap - teamsUsed, 0);
              const percent = cap > 0 ? Math.min((teamsUsed / cap) * 100, 100) : 0;

              return (
                <div
                  key={division}
                  className={`overview-card overview-card--${division.toLowerCase()}`}
                >
                  <div className="overview-card__eyebrow">{division} Division</div>

                  <div className="division-stats">
                    <div className="division-stats__row">
                      <span>Teams</span>
                      <strong>{teamsUsed}</strong>
                    </div>
                    <div className="division-stats__row">
                      <span>Students</span>
                      <strong>{studentsInDivision}</strong>
                    </div>
                  </div>

                  <div className="cap-progress">
                    <div className="cap-progress__track" aria-hidden="true">
                      <div
                        className={`cap-progress__fill cap-progress__fill--${division.toLowerCase()}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="cap-progress__meta">
                      <span>
                        {teamsUsed} / {cap} Teams Used
                      </span>
                      <span>
                        {remaining === 0
                          ? "At cap"
                          : `${remaining} Team${remaining === 1 ? "" : "s"} Left`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="page-subtitle muted">
            Search schools and teachers, then switch the table between all teams
            and division-specific counts.
          </div>

          {pageError ? (
            <div className="callout callout--error">{pageError}</div>
          ) : null}

          <div className="toolbar">
            <div className="toolbar__left">
              <label className="sr-only" htmlFor="school-search">
                Search schools
              </label>

              <div className="search">
                <span className="search__icon" aria-hidden="true">
                  <FaSearch />
                </span>

                <input
                  id="school-search"
                  className="search__input"
                  type="text"
                  placeholder="Search by school, teacher, or email..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                />

                {query ? (
                  <button
                    type="button"
                    className="search__clear"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    title="Clear"
                  >
                    ✕
                  </button>
                ) : null}
              </div>

              <div className="filter-bar" role="tablist" aria-label="Roster view filter">
                {VIEW_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={selectedView === option.value}
                    className={`filter-chip filter-chip--${String(
                      option.value
                    ).toLowerCase()} ${selectedView === option.value ? "is-active" : ""
                      }`}
                    onClick={() => setSelectedView(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="toolbar__right muted">
              Showing <strong>{filtered.length}</strong> of{" "}
              <strong>{schools.length}</strong> schools in{" "}
              <strong>{selectedViewLabel}</strong>
            </div>
          </div>

          <div className="table-wrap">
            <table className="school-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Teachers</th>
                  <th className="num">Teams</th>
                  <th className="num">Students</th>
                  <th className="actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty">
                      {isLoading ? "Loading..." : "No schools found."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    const viewTeamCount = getTeamCountForView(s, selectedView);
                    const viewStudentCount = getStudentCountForView(
                      s,
                      selectedView
                    );
                    const isZeroDivisionRow =
                      selectedView !== "all" &&
                      viewTeamCount === 0 &&
                      viewStudentCount === 0;

                    return (
                      <tr
                        key={s.id}
                        className={isZeroDivisionRow ? "is-zero-row" : ""}
                      >
                        <td>
                          <div className="school-name">{s.name}</div>
                          <div className="muted small mono">ID: {s.id}</div>
                        </td>

                        <td>
                          {s.teachers && s.teachers.length > 0 ? (
                            <div className="teacher-cell">
                              {s.teachers.map((teacher, idx) => {
                                const teacherName =
                                  (teacher.name || "").trim() || "Unassigned";
                                const teacherEmail = (teacher.email || "").trim();

                                return (
                                  <div
                                    key={teacher.id || idx}
                                    className="teacher-entry"
                                  >
                                    <div className="teacher-name">
                                      {teacherName}
                                    </div>

                                    {teacherEmail ? (
                                      <div className="muted small">
                                        <a
                                          className="link"
                                          href={`mailto:${teacherEmail}`}
                                        >
                                          {teacherEmail}
                                        </a>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="muted small">No teachers assigned</div>
                          )}
                        </td>

                        <td className="num mono">
                          <div className="count-cell__value">{viewTeamCount}</div>
                          {selectedView !== "all" ? (
                            <div className="muted small">
                              Total: {Number(s.teamCount || 0)}
                            </div>
                          ) : null}
                        </td>

                        <td className="num mono">
                          <div className="count-cell__value">
                            {viewStudentCount}
                          </div>
                          {selectedView !== "all" ? (
                            <div className="muted small">
                              Total: {Number(s.studentCount || 0)}
                            </div>
                          ) : null}
                        </td>

                        <td className="actions">
                          <button
                            type="button"
                            className="row-action"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigate(`/admin/${s.id}/team-manage`);
                            }}
                          >
                            Team Manage
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminSchoolRoster;