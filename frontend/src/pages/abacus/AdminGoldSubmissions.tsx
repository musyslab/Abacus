import React, { useEffect, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import {
  FaCheckCircle,
  FaExternalLinkAlt,
  FaPlay,
  FaUndo,
  FaUserLock,
  FaPen,
} from "react-icons/fa";

import MenuComponent from "../components/MenuComponent";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";

import "../../styling/AdminGoldSubmissions.scss";

type Submission = {
  id: number;
  link: string;
  studentId: number;
  submittedAt: string;
  points: number | null;
  feedback: string | null;
  adminGraderId: number | null;
};

const AdminGoldSubmissions = () => {
  const API = (import.meta.env.VITE_API_URL as string) || "";

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentAdminId, setCurrentAdminId] = useState<number | null>(null);

  const [pointsInput, setPointsInput] = useState<string>("");
  const [feedbackInput, setFeedbackInput] = useState<string>("");

  const [saved, setSaved] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [activeSubmission, setActiveSubmission] =
    useState<Submission | null>(null);

  function authConfig() {
    const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  const fetchSubmissions = async (showLoader = false) => {
    if (showLoader) setLoading(true);

    try {
      const res = await axios.get(`${API}/gold-division/all`, authConfig());
      setSubmissions(res.data?.submissions || []);
      setCurrentAdminId(res.data?.currentAdminId ?? null);
    } catch (err) {
      console.error("Failed to fetch submissions", err);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions(true);
    const interval = setInterval(() => fetchSubmissions(false), 3000);
    return () => clearInterval(interval);
  }, []);

  const claim = async (id: number) => {
    await axios.post(`${API}/gold-division/claim/${id}`, {}, authConfig());
    fetchSubmissions(false);
  };

  const unclaim = async (id: number) => {
    await axios.post(`${API}/gold-division/unclaim/${id}`, {}, authConfig());
    fetchSubmissions(false);
  };

  const openModal = (submission: Submission) => {
    setActiveSubmission(submission);
    setPointsInput(submission.points?.toString() ?? "");
    setFeedbackInput(submission.feedback ?? "");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setActiveSubmission(null);
    setSaved(false);
  };

  const saveEvaluation = async () => {
    if (!activeSubmission) return;

    const pointsValue = Number(pointsInput);
    if (Number.isNaN(pointsValue)) return;

    await axios.post(
      `${API}/gold-division/grade/${activeSubmission.id}`,
      {
        points: pointsValue,
        feedback: feedbackInput,
      },
      authConfig()
    );

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
      closeModal();
    }, 1500);

    fetchSubmissions(false);
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
                  <th>Student ID</th>
                  <th>Project</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Points</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody className="table-body">
                {submissions.map((s) => {
                  const claimedByMe =
                    currentAdminId !== null &&
                    s.adminGraderId === currentAdminId;

                  const claimedByOther =
                    s.adminGraderId !== null &&
                    s.adminGraderId !== currentAdminId;

                  const unclaimed = s.adminGraderId === null;

                  return (
                    <tr key={s.id} className="data-row">
                      <td>
                        <strong>{s.studentId}</strong>
                      </td>

                      <td>
                        <a
                          className="button button-view-code"
                          href={s.link}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FaExternalLinkAlt />
                          View
                        </a>
                      </td>

                      <td>{formatDateTime(s.submittedAt)}</td>

                      <td>
                        {unclaimed && <span className="status-badge waiting">Unclaimed</span>}
                        {claimedByMe && (
                          <span className="status-badge mine">
                            <FaCheckCircle />
                            Yours
                          </span>
                        )}
                        {claimedByOther && (
                          <span className="status-badge locked">
                            <FaUserLock />
                            Locked
                          </span>
                        )}
                      </td>

                      <td>{s.points ?? "—"}</td>

                      <td className="cell-actions">
                        {unclaimed && (
                          <button className="button button-accept" onClick={() => claim(s.id)}>
                            <FaPlay />
                            Claim
                          </button>
                        )}

                        {claimedByMe && (
                          <>
                            <button
                              className="button button-completed"
                              onClick={() => openModal(s)}
                            >
                              <FaPen />
                              Grade
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

                        {claimedByOther && <span className="muted-text">Unavailable</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* MODAL */}
        {modalOpen && activeSubmission && (
          <div className="modal-overlay">
            <div className="modal">
              <h2>Grade Submission</h2>

              <label>Points</label>
              <input
                type="number"
                value={pointsInput}
                onChange={(e) => setPointsInput(e.target.value)}
              />

              <label>Feedback</label>
              <textarea
                value={feedbackInput}
                onChange={(e) => setFeedbackInput(e.target.value)}
              />

              <div className="modal-actions">
                <button
                  className={`button button-completed ${saved ? "is-saved" : ""}`}
                  onClick={saveEvaluation}
                >
                  {saved ? "✓ Saved" : "Save"}
                </button>

                <button className="button" onClick={closeModal}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminGoldSubmissions;