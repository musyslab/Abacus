import React, { Component } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { Link, Navigate } from "react-router-dom";
import { FaUser, FaLock, FaEyeSlash, FaEye } from "react-icons/fa";

import img from "../../images/AbacusLogo.png";
import "../../styling/Login.scss";
import MenuComponent from "../components/MenuComponent";

interface StudentLoginPageState {
  studentHomePath: string | null;
  isErrorMessageHidden: boolean;
  email: string;
  password: string;
  error_message: string;
  isLoading: boolean;
  showPassword: boolean;
  isResolvingHome: boolean;
}

class StudentLogin extends Component<{}, StudentLoginPageState> {
  constructor(props: {}) {
    super(props);

    const hasToken = localStorage.getItem("AUTOTA_AUTH_TOKEN") !== null;

    this.state = {
      studentHomePath: null,
      isErrorMessageHidden: true,
      email: "",
      password: "",
      error_message: "",
      isLoading: false,
      showPassword: false,
      isResolvingHome: hasToken,
    };

    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleEmailChange = this.handleEmailChange.bind(this);
    this.handlePasswordChange = this.handlePasswordChange.bind(this);
  }

  componentDidMount() {
    const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
    if (token) {
      this.resolveStudentHome(token);
    }
  }

  resolveStudentHome(token: string) {
    const baseUrl = import.meta.env.VITE_API_URL as string | undefined;
    axios
      .get(`${baseUrl}/teams/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const div = String(res.data?.division ?? "").trim();
        const path = div === "Eagle" ? "/student/eagle-home" : "/student/problems";
        this.setState({ studentHomePath: path, isResolvingHome: false });
      })
      .catch(() => {
        this.setState({ studentHomePath: "/student/problems", isResolvingHome: false });
      });
  }

  handleEmailChange(ev: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ email: ev.target.value });
  }

  handlePasswordChange(ev: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ password: ev.target.value });
  }

  handleSubmit(ev?: React.FormEvent<HTMLFormElement>) {
    ev?.preventDefault();

    const baseUrl = import.meta.env.VITE_API_URL as string | undefined;

    this.setState({ isErrorMessageHidden: true, isLoading: true });

    axios
      .post(`${baseUrl}/auth/student/login`, {
        password: this.state.password,
        email: this.state.email,
      })
      .then((res) => {
        localStorage.setItem("AUTOTA_AUTH_TOKEN", res.data.access_token);
        return axios.get(`${baseUrl}/teams/me`, {
          headers: { Authorization: `Bearer ${res.data.access_token}` },
        });
      })
      .then((teamRes) => {
        const div = String(teamRes.data?.division ?? "").trim();
        const path = div === "Eagle" ? "/student/eagle-home" : "/student/problems";
        this.setState({ isLoading: false, studentHomePath: path });
      })
      .catch((err) => {
        if (localStorage.getItem("AUTOTA_AUTH_TOKEN")) {
          this.setState({ isLoading: false, studentHomePath: "/student/problems" });
          return;
        }
        const msg = err.response?.data?.message || "Login failed.";
        this.setState({ error_message: msg, isErrorMessageHidden: false, isLoading: false });
      });
  }

  render() {
    if (this.state.studentHomePath) {
      return <Navigate to={this.state.studentHomePath} replace />;
    }

    if (this.state.isResolvingHome) {
      return (
        <>
          <MenuComponent variant="public" />
          <div className="login-page">
            <Helmet>
              <title>Abacus</title>
            </Helmet>
            <p className="login-title">Loading…</p>
          </div>
        </>
      );
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

          <h2 className="login-title">Abacus Student login</h2>

          <div className="login-switch">
            <span className="login-switch__label">Are you a teacher?</span>
            <Link className="login-switch__link" to="/teacher-login">
              Teacher login
            </Link>
          </div>

          <form className="login-form" onSubmit={this.handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email
              </label>
              <div className="input-with-icon">
                <FaUser className="input-with-icon__icon" aria-hidden="true" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="Student email"
                  autoComplete="email"
                  onChange={this.handleEmailChange}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <div className="input-with-icon">
                <FaLock className="input-with-icon__icon" aria-hidden="true" />
                <input
                  id="password"
                  name="password"
                  type={this.state.showPassword ? "text" : "password"}
                  required
                  placeholder="Password"
                  autoComplete="current-password"
                  onChange={this.handlePasswordChange}
                  className="form-input"
                />
                {this.state.showPassword ? (
                  <FaEyeSlash className="input-with-icon__icon-right" onClick={() => this.setState({ showPassword: false })} />
                ) : (
                  <FaEye className="input-with-icon__icon-right" onClick={() => this.setState({ showPassword: true })} />
                )}
              </div>
            </div>

            <button className="btn btn--primary login-form__submit" type="submit" disabled={this.state.isLoading}>
              {this.state.isLoading ? "Logging in…" : "Login"}
            </button>
          </form>

          {!this.state.isErrorMessageHidden && this.state.error_message ? (
            <div className="alert alert--error" role="alert" aria-live="assertive">
              {this.state.error_message}
            </div>
          ) : null}

          <div className="login-links">
                      <div>Student accounts are created by teachers.</div>
            <div>
              Need to set or reset your password?{" "}
              <Link className="login-links__link" to="/student-reset-password">
                Email me a reset link
              </Link>
              .
            </div>
          </div>

          <div className="login-logo">
            <img className="login-logo__img" src={img} alt="School logo" />
          </div>
        </div>
      </>
    );
  }
}

export default StudentLogin;
