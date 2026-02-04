import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { FaSearch } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";
import MenuComponent from "../components/MenuComponent";
import "../../styling/AdminSchoolRoster.scss";

type SchoolSummary = {
  id: number;
  name: string;
  teacherId: number | null;
  teacherName: string | null;
  teacherEmail: string | null;
  teamCount: number;
  studentCount: number;
};

const AdminSchoolRoster = () => {
  const apiBase = (import.meta.env.VITE_API_URL as string) || "";
  const navigate = useNavigate();

  const [schools, setSchools] = useState<SchoolSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [query, setQuery] = useState("");

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
      const teacher = (s.teacherName || "").toLowerCase();
      const email = (s.teacherEmail || "").toLowerCase();
      const name = (s.name || "").toLowerCase();
      return name.includes(q) || teacher.includes(q) || email.includes(q);
    });
  }, [schools, query]);

  return (
    <>
      <Helmet>
        <title>Abacus</title>
      </Helmet>

      <MenuComponent showProblemList={true} />

      <div className="admin-school-roster-root">
        <DirectoryBreadcrumbs
          items={[{ label: "School List" }]}
          trailingSeparator={true}
        />

        <div className="pageTitle">School List</div>

        <div className="admin-school-roster-container">
          <div className="page-subtitle muted">
            View all schools, assigned teachers, and basic roster counts.
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
                  placeholder="Search by school, teacher, or email…"
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
            </div>

            <div className="toolbar__right muted">
              Showing <strong>{filtered.length}</strong> of{" "}
              <strong>{schools.length}</strong>
            </div>
          </div>

          <div className="table-wrap">
            <table className="school-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Teacher</th>
                  <th className="num">Teams</th>
                  <th className="num">Students</th>
                  <th className="actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty">
                      {isLoading ? "Loading…" : "No schools found."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    const teacherName = (s.teacherName || "").trim();
                    const teacherEmail = (s.teacherEmail || "").trim();
                    const teacherLabel = teacherName || "Unassigned";

                    return (
                      <tr key={s.id}>
                        <td>
                          <div className="school-name">{s.name}</div>
                          <div className="muted small mono">ID: {s.id}</div>
                        </td>

                        <td>
                          <div className="teacher-name">{teacherLabel}</div>
                          {teacherEmail ? (
                            <div className="muted small">
                              <a className="link" href={`mailto:${teacherEmail}`}>
                                {teacherEmail}
                              </a>
                            </div>
                          ) : (
                            <div className="muted small">
                              {teacherName ? "" : "No teacher assigned"}
                            </div>
                          )}
                        </td>

                        <td className="num mono">{Number(s.teamCount || 0)}</td>
                        <td className="num mono">
                          {Number(s.studentCount || 0)}
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