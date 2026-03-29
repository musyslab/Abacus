import React, { useState } from "react";
import axios from "axios";
import "../../styling/StudentGoldSubmissions.scss";

const StudentGoldSubmissions = () => {
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false)

  const isValidScratchLink = (url: string) => {
    return url.includes("scratch.mit.edu/projects/");
  };

  const extractProjectId = (url: string) => {
    const match = url.match(/projects\/(\d+)/);
    return match ? match[1] : null;
  };

  const projectId = extractProjectId(link);

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

      await axios.post("/gold-submissions/create", {
        scratch_link: link,
      });

      setMessage("✅ Submission successful!");
      setLink("");
    } catch (err: any) {
      setMessage("❌ Submission failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const isError = message.includes("❌");

  return (
    <div className={isFullscreen ? "fullscreen-container" : "gold-container"}>
      <div className="gold-card">
        <h2 className="gold-title">Gold Division Submission</h2>

        <p className="gold-subtitle">
          Submit your Scratch project link below
        </p>

        <input
          type="text"
          placeholder="https://scratch.mit.edu/projects/..."
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className="gold-input"
        />
        {projectId && (
          <div className="preview-container">
            <p className="preview-label">Live Preview:</p>
            <iframe
              src={`https://scratch.mit.edu/projects/${projectId}/embed`}
              allowTransparency={true}
              frameBorder="0"
              scrolling="no"
              allowFullScreen={true}
              title="Scratch Preview"
              className="preview-frame"
            ></iframe>
          </div>
        )}

        <button
          onClick={handleSubmit}
          className="gold-button"
          disabled={loading || !link}
        >
          {loading ? "Submitting..." : "Submit Project"}
        </button>

        {message && (
          <p className={`gold-message ${isError ? "error" : "success"}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default StudentGoldSubmissions;