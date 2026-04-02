import React, { useEffect, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";

import MenuComponent from "../components/MenuComponent";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";
import "../../styling/StudentGoldSubmissions.scss";

const StudentGoldSubmissions = () => {
  const API = (import.meta.env.VITE_API_URL as string) || "";

  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [grade, setGrade] = useState<number | null>(null);

  function authConfig() {
    const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  const isValidScratchLink = (url: string) => {
    return url.includes("scratch.mit.edu/projects/");
  };

  const extractProjectId = (url: string) => {
    const match = url.match(/projects\/(\d+)/);
    return match ? match[1] : null;
  };

  const projectId = extractProjectId(link);
  const isError = message.includes("❌");

  const fetchMySubmission = async () => {
    try {
      const res = await axios.get(
        `${API}/gold-division/my`,
        authConfig()
      );

      if (res.data) {
        setGrade(res.data.grade);
        setLink(res.data.link || "");
      }
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    fetchMySubmission();
  }, []);

  const handleSubmit = async () => {
    if (!link) {
      setMessage("❌ Please enter a Scratch link.");
      return;
    }

    if (!isValidScratchLink(link)) {
      setMessage("❌ Please enter a valid Scratch project link.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      await axios.post(
        `${API}/gold-division/create`,
        {
          scratch_link: link,
        },
        authConfig()
      );

      setMessage("✅ Submission successful!");
      setGrade(null); // reset until refreshed
      fetchMySubmission();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || "Submission failed. Try again.";
      setMessage(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Abacus</title>
      </Helmet>

      <MenuComponent />

      <div className="student-gold-root">
        <DirectoryBreadcrumbs
          items={[
            { label: "Team Manage", to: "/teacher/team-manage" },
            { label: "Gold Division Submission" },
          ]}
          trailingSeparator={false}
        />

        <div className="pageTitle">Gold Division Submission</div>

        <div className="student-gold-content">
          <div className="callout callout--info">
            Submit your Scratch project link below. A live preview will appear automatically when a valid
            Scratch project link is entered.
          </div>

          <div className="gold-panel">
            <div className="gold-panel__header">
              <div>
                <div className="gold-panel__title">Scratch Project Submission</div>
                <div className="gold-panel__subtitle">
                  Paste your Scratch project URL to preview and submit it.
                </div>
              </div>
            </div>

            <div className="gold-form">
              <div className="field">
                <label className="field__label" htmlFor="gold-scratch-link">
                  Scratch project link
                </label>
                <input
                  id="gold-scratch-link"
                  type="text"
                  placeholder="https://scratch.mit.edu/projects/..."
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  className="field__input gold-input"
                />
                <div className="field__help">
                  Use a Scratch project URL in the format shown above.
                </div>
              </div>

              {projectId && (
                <div className="preview-container">
                  <div className="preview-label">Live Preview</div>
                  <iframe
                    src={`https://scratch.mit.edu/projects/${projectId}/embed`}
                    allowTransparency={true}
                    frameBorder="0"
                    scrolling="no"
                    allowFullScreen
                    title="Scratch Preview"
                    className="preview-frame"
                  />
                </div>
              )}

              <div className="gold-actions">
                <button
                  onClick={handleSubmit}
                  className="btn btn--primary gold-button"
                  disabled={loading || !link}
                  type="button"
                >
                  {loading ? "Submitting..." : "Submit Project"}
                </button>
              </div>

              {/* Submission Message */}
              {message && (
                <div
                  className={`gold-message ${
                    isError ? "gold-message--error" : "gold-message--success"
                  }`}
                >
                  {message}
                </div>
              )}

              {/* Grade Display */}
              {grade !== null && (
                <div className="gold-message gold-message--success">
                  Your grade: {grade}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentGoldSubmissions;