import React, { useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { FaEye, FaEyeSlash, FaLock } from "react-icons/fa";

import img from "../../images/AbacusLogo.png";
import "../../styling/Login.scss";
import MenuComponent from "../components/MenuComponent";

type CompletePasswordResponse = {
  message: string;
  access_token?: string;
  role?: number; // 0 student, 1 admin
};

function hasUppercase(pw: string) {
  return /[A-Z]/.test(pw);
}

function hasSpecialChar(pw: string) {
  return /[!@#$%^&*(),.?":{}|<>]/.test(pw);
}

function hasMinLength(pw: string) {
  return pw.length >= 8;
}

export default function SetPassword() {
  const apiBase = (import.meta.env.VITE_API_URL as string) || "";
  const [searchParams] = useSearchParams();

  const token = (searchParams.get("token") || "").trim();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  // When true, redirect the user back to /home after success
  const [redirectHome, setRedirectHome] = useState(false);

  const ruleMinLength = hasMinLength(password);
  const ruleUppercase = hasUppercase(password);
  const ruleSpecial = hasSpecialChar(password);

const isPasswordValid = ruleMinLength && ruleUppercase && ruleSpecial;

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErrorMessage("");

    if (!token) {
      setErrorMessage("Missing token. Please request a new password link.");
      return;
    }

    if (!password || !confirmPassword) {
      setErrorMessage("All fields are required.");
      return;
    }

    if (!isPasswordValid) {
      setErrorMessage(
        "Password must be at least 8 characters, contain an uppercase letter, and a special character."
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await axios.post<CompletePasswordResponse>(`${apiBase}/auth/password/complete`, {
        token,
        password,
      });

      // Ensure user must log in again
      localStorage.removeItem("AUTOTA_AUTH_TOKEN");

      alert("Password created successfully. Please log back in.");
      setRedirectHome(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Password update failed.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }

  if (redirectHome) {
    return <Navigate to="/home" replace />;
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

        <h2 className="login-title">Set your password</h2>

        <div className="login-switch">
          <span className="login-switch__label">Need another link?</span>
          <Link className="login-switch__link" to="/teacher-reset-password">
            Teacher reset
          </Link>
          <span className="login-switch__sep">|</span>
          <Link className="login-switch__link" to="/student-reset-password">
            Student reset
          </Link>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="password">
              New password
            </label>
            <div className="input-with-icon">
              <FaLock className="input-with-icon__icon" aria-hidden="true" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                placeholder="New password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
              />
              {showPassword ? (
                <FaEye className="input-with-icon__icon-right" onClick={() => setShowPassword(!showPassword)} />
              ) : (
                <FaEyeSlash className="input-with-icon__icon-right" onClick={() => setShowPassword(!showPassword)} />
              )}
            </div>
          </div>

          {/* Password Checklist */}
          <ul style={{ marginTop: 10, paddingLeft: 20, fontSize: 14 }}>
                      <li style={{ color: ruleMinLength ? "green" : "red" }}>
                        At least 8 characters
                      </li>
                      <li style={{ color: ruleUppercase ? "green" : "red" }}>
                        At least one uppercase letter
                      </li>
                      <li style={{ color: ruleSpecial ? "green" : "red" }}>
                        At least one special character
                      </li>
          </ul>

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">
              Confirm password
            </label>
            <div className="input-with-icon">
              <FaLock className="input-with-icon__icon" aria-hidden="true" />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                required
                placeholder="Confirm password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
              />
              {showConfirmPassword ? (
                <FaEye className="input-with-icon__icon-right" onClick={() => setShowConfirmPassword(!showConfirmPassword)} />
              ) : (
                <FaEyeSlash className="input-with-icon__icon-right" onClick={() => setShowConfirmPassword(!showConfirmPassword)} />
              )}
            </div>
          </div>

          <button
            className="btn btn--primary login-form__submit"
            type="submit"
            disabled={isLoading || !isPasswordValid}
          >
            {isLoading ? "Saving…" : "Save password"}
          </button>
        </form>

        {errorMessage && (
          <div
            className="alert alert--error"
            role="alert"
            aria-live="assertive"
          >
            {errorMessage}
          </div>
        )}

        <div className="login-links">
          <div>This link expires. If it fails, request a new reset link from the pages above.</div>
        </div>

        <div className="login-logo">
          <img className="login-logo__img" src={img} alt="School logo" />
        </div>
      </div>
    </>
  );
}