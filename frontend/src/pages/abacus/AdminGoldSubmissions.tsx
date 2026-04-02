import React, { useEffect, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import {
  FaCheckCircle,
  FaExternalLinkAlt,
  FaPlay,
  FaUndo,
  FaUserLock,
} from "react-icons/fa";

import MenuComponent from "../components/MenuComponent";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";

import "../../styling/AdminGoldSubmissions.scss";

type Submission = {
  id: number;
  link: string;
  studentId: number;
  submittedAt: string;
  grade: number | null;
  adminGraderId: number | null;
};

const AdminGoldSubmissions = () => {
  const API = (import.meta.env.VITE_API_URL as string) || "";

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentAdminId, setCurrentAdminId] = useState<number | null>(null);
  const [gradeInputs, setGradeInputs] = useState<Record<number, string>>({});
  const [savedGrades, setSavedGrades] = useState<Record<number, boolean>>({});

  function authConfig() {
    const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  const fetchSubmissions = async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const res = await axios.get(`${API}/gold-division/all`, authConfig());
      setSubmissions(res.data?.submissions || []);
      setCurrentAdminId(res.data?.currentAdminId ?? null);
    } catch (err) {
      console.error("Failed to fetch submissions", err);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchSubmissions(true);

    const interval = setInterval(() => {
      fetchSubmissions(false);
    }, 3000); // reloads table info every 3 seconds

    return () => clearInterval(interval);
  }, []);

  const claim = async (id: number) => {
    try {
      await axios.post(`${API}/gold-division/claim/${id}`, {}, authConfig());
      fetchSubmissions(false);
    } catch (err) {
      console.error("Failed to claim submission", err);
    }
  };

  const unclaim = async (id: number) => {
    try {
      await axios.post(`${API}/gold-division/unclaim/${id}`, {}, authConfig());
      fetchSubmissions(false);
    } catch (err) {
      console.error("Failed to unclaim submission", err);
    }
  };

  const grade = async (id: number, gradeValue: number) => {
    if (Number.isNaN(gradeValue)) return;

    try {
      await axios.post(
        `${API}/gold-division/grade/${id}`,
        { grade: gradeValue },
        authConfig()
      );

      setGradeInputs((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      setSavedGrades((prev) => ({
        ...prev,
        [id]: true,
      }));

      setTimeout(() => {
        setSavedGrades((prev) => {
          const copy = { ...prev };
          delete copy[id];
          return copy;
        });
      }, 2500);

      fetchSubmissions(false);
    } catch (err) {
      console.error("Failed to grade submission", err);
    }
  };

  const formatDateTime = (timestampStr: string | null) => {
    if (!timestampStr) return "—";
  
    const date = new Date(timestampStr);
  
    return isNaN(date.getTime()) ? "—" : date.toLocaleString();
  };


  return (
    <>
      <Helmet>
        <title>Admin Gold Submissions</title>
      </Helmet>

      <MenuComponent />

      <div className="gold-page">
        <DirectoryBreadcrumbs
          items={[
            { label: "Admin Menu", to: "/admin" },
            { label: "Gold Submissions" },
          ]}
        />

        <div className="pageTitle">Gold Submissions</div>

        <div className="table-section">
          <div className="tableTitle">Student Scratch Projects</div>

          {loading ? (
            <div className="gold-loading">Loading...</div>
          ) : (
            <table border={1} className="gold-submissions-table">
              <thead className="table-head">
                <tr className="head-row">
                  <th className="col-student-id">Student ID</th>
                  <th className="col-link">Project</th>
                  <th className="col-submitted">Submitted At</th>
                  <th className="col-status">Status</th>
                  <th className="col-grade">Current Grade</th>
                  <th className="col-input">Enter Grade</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>

              <tbody className="table-body">
                {submissions.length === 0 ? (
                  <tr className="empty-row">
                    <td className="empty-cell" colSpan={7}>
                      No gold submissions found.
                    </td>
                  </tr>
                ) : (
                  submissions.map((s) => {
                    const claimedByMe =
                      currentAdminId !== null &&
                      s.adminGraderId === currentAdminId;
                    const claimedByOther =
                      s.adminGraderId !== null &&
                      s.adminGraderId !== currentAdminId;
                    const unclaimed = s.adminGraderId === null;

                    return (
                      <tr
                        key={s.id}
                        className={`data-row ${
                          claimedByMe ? "is-claimed-by-me" : ""
                        } ${claimedByOther ? "is-claimed-by-other" : ""}`}
                      >
                        <td className="cell-student-id">
                          <strong>{s.studentId}</strong>
                        </td>

                        <td className="cell-link">
                          <a
                            className="button button-view-code link-code"
                            href={s.link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <FaExternalLinkAlt />
                            View Project
                          </a>
                        </td>

                        <td className="cell-submitted">
                          {formatDateTime(s.submittedAt)}
                        </td>

                        <td className="cell-status">
                          {unclaimed && (
                            <span className="status-badge waiting">
                              Unclaimed
                            </span>
                          )}
                          {claimedByMe && (
                            <span className="status-badge mine">
                              <FaCheckCircle />
                              Claimed by you
                            </span>
                          )}
                          {claimedByOther && (
                            <span className="status-badge locked">
                              <FaUserLock />
                              Claimed by another admin
                            </span>
                          )}
                        </td>

                        <td className="cell-grade">
                          {s.grade ?? "Not graded"}
                        </td>

                        <td className="cell-input">
                          {claimedByMe ? (
                            <input
                              type="number"
                              placeholder="Enter grade"
                              value={
                                gradeInputs[s.id] ??
                                (s.grade !== null ? String(s.grade) : "")
                              }
                              onChange={(e) =>
                                setGradeInputs((prev) => ({
                                  ...prev,
                                  [s.id]: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <span className="muted-text">—</span>
                          )}
                        </td>

                        <td className="cell-actions">
                          {unclaimed && (
                            <button
                              className="button button-accept"
                              onClick={() => claim(s.id)}
                            >
                              <FaPlay />
                              Claim
                            </button>
                          )}

                          {claimedByMe && (
                            <>
                              <button
                                className={`button button-completed ${
                                  savedGrades[s.id] ? "is-saved" : ""
                                }`}
                                onClick={() =>
                                  grade(s.id, Number(gradeInputs[s.id]))
                                }
                                disabled={
                                  gradeInputs[s.id] === undefined ||
                                  gradeInputs[s.id] === ""
                                }
                              >
                                <span className="save-content">
                                  <span
                                    className={`save-text ${
                                      savedGrades[s.id] ? "hide" : ""
                                    }`}
                                  >
                                    <FaCheckCircle />
                                    Save Grade
                                  </span>

                                  <span
                                    className={`save-check ${
                                      savedGrades[s.id] ? "show" : ""
                                    }`}
                                  >
                                    ✓
                                  </span>
                                </span>
                              </button>

                              <button
                                className="button button-warning"
                                onClick={() => unclaim(s.id)}
                              >
                                <FaUndo />
                                Unclaim
                              </button>
                            </>
                          )}

                          {claimedByOther && (
                            <span className="muted-text">Unavailable</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
};

export default AdminGoldSubmissions;