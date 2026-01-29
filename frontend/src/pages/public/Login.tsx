import React, { Component } from "react";

// Uncomment for Marquette
import img from "../../images/MUCS-tag.png";

// Uncomment for Carroll
// import img from "../../Pioneer.png";

import { FaUser, FaLock } from "react-icons/fa";

import "../../styling/Login.scss";

import axios from "axios";
import { Helmet } from "react-helmet";
import { Link, Navigate } from "react-router-dom";

interface LoginPageState {
  isLoggedIn: boolean;
  isErrorMessageHidden: boolean;
  email: string;
  password: string;
  role: number;
  error_message: string;
  isLoading: boolean;
}

class Login extends Component<{}, LoginPageState> {
  constructor(props: {}) {
    super(props);

    this.state = {
      // login state
      isLoggedIn: localStorage.getItem("AUTOTA_AUTH_TOKEN") !== null,
      isErrorMessageHidden: true,
      email: "",
      password: "",
      role: -1,
      error_message: "",
      isLoading: false,
    };

    // login handlers
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleEmailChange = this.handleEmailChange.bind(this);
    this.handlePasswordChange = this.handlePasswordChange.bind(this);
  }

  // -----------------------------
  // Login handlers
  // -----------------------------
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
      .post(`${baseUrl}/auth/login`, {
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
      const redirectPath = this.state.role === 0 ? "/student/classes" : "/admin/classes";
      return <Navigate to={redirectPath} replace />;
    }

    return (
      <div className="login-page">
        <Helmet>
          <title>Abacus</title>
        </Helmet>

        <h2 className="login-title">Login to your Abacus account</h2>

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
                placeholder="School email"
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
          Create an account{" "}
          <Link className="login-links__link" to="/register">
            here
          </Link>
          .
        </div>

        <Link to="/home" className="login-logo">
          <img className="login-logo__img" src={img} alt="School logo" />
        </Link>
      </div>
    );
  }
}

export default Login;