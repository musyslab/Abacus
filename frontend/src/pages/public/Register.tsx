import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import img from "../../images/AbacusLogo.png";
import "../../styling/Login.scss";
import MenuComponent from "../components/MenuComponent";

type RegisterResponse = {
  message: string;
  access_token?: string;
  role?: number;
};

type SchoolOption = {
  id: number;
  name: string;
};

type SchoolMode = "existing" | "new";

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const apiBase = (import.meta.env.VITE_API_URL as string) || "";

  const prefillEmail = useMemo(() => searchParams.get("email") || "", [searchParams]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [schoolMode, setSchoolMode] = useState<SchoolMode>("existing");
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
  const [newSchoolName, setNewSchoolName] = useState("");

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchSchools() {
      setIsLoadingSchools(true);
      try {
        const res = await axios.get<SchoolOption[]>(`${apiBase}/schools/public/all`);
        const list = Array.isArray(res.data) ? res.data : [];
        const sorted = list.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        if (!cancelled) {
          setSchools(sorted);

          // If there are no existing schools, default to "new".
          if (sorted.length === 0) {
            setSchoolMode("new");
          }
        }
      } catch {
        // If we cannot load schools, still allow creating a new one.
        if (!cancelled) {
          setSchools([]);
          setSchoolMode("new");
        }
      } finally {
        if (!cancelled) setIsLoadingSchools(false);
      }
    }

    fetchSchools();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErrorMessage("");

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setErrorMessage("All fields are required.");
      return;
    }

    if (schoolMode === "existing") {
      if (!selectedSchoolId) {
        setErrorMessage("Please select a school.");
        return;
      }
    } else {
      if (!newSchoolName.trim()) {
        setErrorMessage("Please enter a school name.");
        return;
      }
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const payload: Record<string, any> = {
        fname: firstName,
        lname: lastName,
        email,
        password,
      };

      if (schoolMode === "existing") {
        payload.school_id = Number(selectedSchoolId);
      } else {
        payload.school = newSchoolName.trim();
      }

      const res = await axios.post<RegisterResponse>(`${apiBase}/auth/register`, payload);

      if (res.data.access_token) {
        const token = res.data.access_token;
        localStorage.setItem("AUTOTA_AUTH_TOKEN", token);
        const role = res.data.role ?? 0;

        if (role === 0) {
          const me = await axios.get(`${apiBase}/schools/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const schoolId = Number(me.data?.id) || 0;
          navigate(`/admin/${schoolId}/team-manage`, { replace: true });
          return;
        }

        navigate("/admin/schools", { replace: true });
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

        <h2 className="login-title">Teacher Account Creation</h2>

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
            <div className="form-label">School</div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="radio"
                  name="schoolMode"
                  value="existing"
                  checked={schoolMode === "existing"}
                  onChange={() => setSchoolMode("existing")}
                  disabled={isLoading || isLoadingSchools || schools.length === 0}
                />
                Select existing
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="radio"
                  name="schoolMode"
                  value="new"
                  checked={schoolMode === "new"}
                  onChange={() => setSchoolMode("new")}
                  disabled={isLoading}
                />
                Create new
              </label>
            </div>

            {schoolMode === "existing" ? (
              <div style={{ marginTop: 10 }}>
                <label className="form-label" htmlFor="schoolSelect">
                  Existing school
                </label>
                <select
                  id="schoolSelect"
                  className="form-select"
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  disabled={isLoading || isLoadingSchools || schools.length === 0}
                  required
                >
                  <option value="">
                    {isLoadingSchools
                      ? "Loading schools…"
                      : schools.length === 0
                        ? "No schools found (create a new one)"
                        : "Select a school"}
                  </option>
                  {schools.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <label className="form-label" htmlFor="schoolNew">
                  New school name
                </label>
                <input
                  id="schoolNew"
                  type="text"
                  className="form-input"
                  placeholder="Marquette"
                  value={newSchoolName}
                  onChange={(e) => setNewSchoolName(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            )}
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
          Already have a teacher account?{" "}
          <Link className="login-links__link" to="/teacher-login">
            Log in
          </Link>
          .
        </div>

        <div className="login-logo">
          <img className="login-logo__img" src={img} alt="School logo" />
        </div>
      </div>
    </>
  );
}