import React, { useMemo, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import img from "../../images/MUCS-tag.png";
import "../../styling/Login.scss";

type RegisterResponse = {
  message: string;
  access_token?: string;
  role?: number;
};

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const prefillEmail = useMemo(() => searchParams.get("email") || "", [searchParams]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [school, setSchool] = useState("");
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErrorMessage("");

    if (!firstName || !lastName || !school || !email || !password || !confirmPassword) {
      setErrorMessage("All fields are required.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    const apiBase = (import.meta.env.VITE_API_URL as string) || "";
    setIsLoading(true);

    try {
      const res = await axios.post<RegisterResponse>(`${apiBase}/auth/register`, {
        fname: firstName,
        lname: lastName,
        school,
        email,
        password,
      });

      if (res.data.access_token) {
        localStorage.setItem("AUTOTA_AUTH_TOKEN", res.data.access_token);
        const role = res.data.role ?? 0;
        navigate(role === 0 ? "/student/classes" : "/admin/classes", { replace: true });
        return;
      }

      setErrorMessage(res.data.message || "Account creation failed.");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Account creation failed.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-page">
      <Helmet>
        <title>Abacus</title>
      </Helmet>

      <h2 className="login-title">Create your Abacus account</h2>

      <form className="login-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="fname">
            First name
          </label>
          <input
            id="fname"
            type="text"
            className="form-input"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="lname">
            Last name
          </label>
          <input
            id="lname"
            type="text"
            className="form-input"
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="school">
            School
          </label>
          <input
            id="school"
            type="text"
            className="form-input"
            placeholder="Marquette"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="email">
            School Email
          </label>
          <input
            id="email"
            type="email"
            className="form-input"
            placeholder="first.last@marquette.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="form-input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="confirmPassword">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            className="form-input"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <button className="btn btn--primary login-form__submit" type="submit" disabled={isLoading}>
          {isLoading ? "Creating account…" : "Create account"}
        </button>
      </form>

      {errorMessage ? (
        <div className="alert alert--error" role="alert" aria-live="assertive">
          {errorMessage}
        </div>
      ) : null}

      <div className="login-links">
        Already have an account?{" "}
        <Link className="login-links__link" to="/login">
          Log in
        </Link>
        .
      </div>

      <Link to="/home" className="login-logo">
        <img className="login-logo__img" src={img} alt="School logo" />
      </Link>
    </div>
  );
}
