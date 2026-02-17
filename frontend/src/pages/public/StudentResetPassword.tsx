import React, { useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { FaUser } from "react-icons/fa";

import img from "../../images/AbacusLogo.png";
import "../../styling/Login.scss";
import MenuComponent from "../components/MenuComponent";

export default function StudentResetPassword() {
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
      await axios.post(`${apiBase}/auth/student/request-password-reset`, {
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
        variant="public"
      />

      <div className="login-page">
        <Helmet>
          <title>Abacus</title>
        </Helmet>

        <h2 className="login-title">Student password help</h2>

        <div className="login-switch">
          <span className="login-switch__label">Back to login:</span>
          <Link className="login-switch__link" to="/student-login">
            Student login
          </Link>
          <span className="login-switch__sep">|</span>
          <Link className="login-switch__link" to="/teacher-login">
            Teacher login
          </Link>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Student email
            </label>
            <div className="input-with-icon">
              <FaUser className="input-with-icon__icon" aria-hidden="true" />
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="student@school.edu"
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
            If you were invited by a teacher, use your school email to receive a password setup link.
          </div>
        </div>

        <div className="login-logo">
          <img className="login-logo__img" src={img} alt="School logo" />
        </div>
      </div>
    </>
  );
}
