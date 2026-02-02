import React, { useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { FaUser } from "react-icons/fa";

import img from "../../images/AbacusLogo.png";
import "../../styling/Login.scss";
import MenuComponent from "../components/MenuComponent";

export default function TeacherResetPassword() {
  const apiBase = (import.meta.env.VITE_API_URL as string) || "";

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErrorMessage("");
    setStatusMessage("");

    if (!email.trim()) {
      setErrorMessage("Email is required.");
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(`${apiBase}/auth/admin/request-password-reset`, {
        email: email.trim(),
      });
      setStatusMessage("If an account exists for that email, a password link has been sent.");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Request failed.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <MenuComponent
        showUpload={false}
        showAdminUpload={false}
        showHelp={false}
        showCreate={false}
        showReviewButton={false}
        showLast={false}
        variant="public"
      />

      <div className="login-page">
        <Helmet>
          <title>Abacus</title>
        </Helmet>

        <h2 className="login-title">Teacher password reset</h2>

        <div className="login-switch">
          <span className="login-switch__label">Back to login:</span>
          <Link className="login-switch__link" to="/teacher-login">
            Teacher login
          </Link>
          <span className="login-switch__sep">|</span>
          <Link className="login-switch__link" to="/student-login">
            Student login
          </Link>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Teacher email
            </label>
            <div className="input-with-icon">
              <FaUser className="input-with-icon__icon" aria-hidden="true" />
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="teacher@school.edu"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <button className="btn btn--primary login-form__submit" type="submit" disabled={isLoading}>
            {isLoading ? "Sending…" : "Send password link"}
          </button>
        </form>

        {statusMessage ? (
          <div className="alert alert--success" role="status" aria-live="polite">
            {statusMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="alert alert--error" role="alert" aria-live="assertive">
            {errorMessage}
          </div>
        ) : null}

        <div className="login-links">
          <div>
            Tip: If your account was locked after failed attempts, resetting your password will unlock it.
          </div>
        </div>

        <div className="login-logo">
          <img className="login-logo__img" src={img} alt="School logo" />
        </div>
      </div>
    </>
  );
}
