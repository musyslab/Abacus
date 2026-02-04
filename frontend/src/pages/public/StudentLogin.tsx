import React, { Component } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { Link, Navigate } from "react-router-dom";
import { FaUser, FaLock } from "react-icons/fa";

import img from "../../images/AbacusLogo.png";
import "../../styling/Login.scss";
import MenuComponent from "../components/MenuComponent";

interface StudentLoginPageState {
  isLoggedIn: boolean;
  isErrorMessageHidden: boolean;
  email: string;
  password: string;
  role: number;
  error_message: string;
  isLoading: boolean;
}

class StudentLogin extends Component<{}, StudentLoginPageState> {
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
      .post(`${baseUrl}/auth/student/login`, {
        password: this.state.password,
        email: this.state.email,
      })
      .then((res) => {
        localStorage.setItem("AUTOTA_AUTH_TOKEN", res.data.access_token);
        this.setState({ isLoggedIn: true, role: res.data.role, isLoading: false });
      })
      .catch((err) => {
        const msg = err.response?.data?.message || "Login failed.";
        this.setState({ error_message: msg, isErrorMessageHidden: false, isLoading: false });
      });
  }

  render() {
    if (this.state.isLoggedIn) {
      const redirectPath = "/student/classes";
      return <Navigate to={redirectPath} replace />;
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
                  type="password"
                  required
                  placeholder="Password"
                  autoComplete="current-password"
                  onChange={this.handlePasswordChange}
                  className="form-input"
                />
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
