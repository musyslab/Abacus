import React, { Component } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { Link, Navigate } from "react-router-dom";
import { FaUser, FaLock, FaEyeSlash, FaEye } from "react-icons/fa";

import img from "../../images/AbacusLogo.png";
import "../../styling/Login.scss";
import MenuComponent from "../components/MenuComponent";

interface TeacherLoginPageState {
  isLoggedIn: boolean;
  isErrorMessageHidden: boolean;
  email: string;
  password: string;
  role: number;
  error_message: string;
  isLoading: boolean;
  showPassword: boolean;
}

class TeacherLogin extends Component<{}, TeacherLoginPageState> {
  constructor(props: {}) {
    super(props);

    this.state = {
      isLoggedIn: localStorage.getItem("AUTOTA_AUTH_TOKEN") !== null,
      isErrorMessageHidden: true,
      email: "",
      password: "",
      role: -1,
      error_message: "",
      isLoading: false,
      showPassword: false,
    };

    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleEmailChange = this.handleEmailChange.bind(this);
    this.handlePasswordChange = this.handlePasswordChange.bind(this);
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
      .post(`${baseUrl}/auth/admin/login`, {
        password: this.state.password,
        email: this.state.email,
      })
      .then(async (res) => {
        const token = res.data.access_token;
        const role = Number(res.data.role ?? 0);
        localStorage.setItem("AUTOTA_AUTH_TOKEN", token);

        this.setState({ isLoggedIn: true, role, isLoading: false });
      })
      .catch((err) => {
        const msg = err.response?.data?.message || "Login failed.";
        this.setState({ error_message: msg, isErrorMessageHidden: false, isLoading: false });
      });
  }

  render() {
    if (this.state.isLoggedIn) {
      if (this.state.role === 0) {
        return <Navigate to="/teacher/team-manage" replace />;
      }
      return <Navigate to="/admin/schools" replace />;
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

          <h2 className="login-title">Abacus Teacher login</h2>

          <div className="login-switch">
            <span className="login-switch__label">Are you a student?</span>
            <Link className="login-switch__link" to="/student-login">
              Student login
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
                  placeholder="Teacher email"
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
            <div>
              Need a teacher account?{" "}
              <Link className="login-links__link" to="/register">
                Register here
              </Link>
              .
            </div>
            <div>
              Forgot your password?{" "}
              <Link className="login-links__link" to="/teacher-reset-password">
                Reset it
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

export default TeacherLogin;
