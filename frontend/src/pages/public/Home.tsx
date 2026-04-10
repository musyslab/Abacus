import React, { Component } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";

import "../../styling/Home.scss";

import { FaGithub, FaInstagram } from "react-icons/fa";
import MenuComponent from "../components/MenuComponent";
import CompetitionStageStatus, {
    CompetitionSchedule,
    fetchCompetitionSchedule,
} from "../components/CompetitionStageStatus";

type HomeState = {
    competitionSchedule: CompetitionSchedule | null;
};

function parseNaiveDateTime(value: string): Date {
    const [datePart, timePart = "00:00:00"] = String(value || "").split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hours, minutes, seconds] = timePart.split(":").map(Number);

    return new Date(
        year || 0,
        (month || 1) - 1,
        day || 1,
        hours || 0,
        minutes || 0,
        seconds || 0
    );
}

function formatLongDate(value?: string | null): string {
    if (!value) return "Loading...";
    const dt = parseNaiveDateTime(value);

    if (Number.isNaN(dt.getTime())) return "Date unavailable";

    return dt.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

function formatLongDateTime(value?: string | null): string {
    if (!value) return "Loading...";
    const dt = parseNaiveDateTime(value);

    if (Number.isNaN(dt.getTime())) return "Date unavailable";

    return dt.toLocaleString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

class Home extends Component<Record<string, never>, HomeState> {
    aboutRef = React.createRef<HTMLElement>();
    eventRef = React.createRef<HTMLElement>();
    rulesRef = React.createRef<HTMLElement>();

    state: HomeState = {
        competitionSchedule: null,
    };

    componentDidMount() {
        fetchCompetitionSchedule()
            .then((competitionSchedule) => {
                this.setState({ competitionSchedule });
            })
            .catch(() => {
                this.setState({ competitionSchedule: null });
            });
    }

    scrollToSection = (section: HTMLElement | null) => {
        if (!section) return;
        section.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    render() {
        const EMAIL = "marquetteacm@gmail.com";
        const loggedIn = localStorage.getItem("AUTOTA_AUTH_TOKEN") !== null;

        const competitionDate = formatLongDate(
            this.state.competitionSchedule?.competitionStart
        );
        const registrationDeadline = formatLongDateTime(
            this.state.competitionSchedule?.registrationEnd
        );

        return (
            <div className="home-page">
                <Helmet>
                    <title>Abacus</title>
                </Helmet>

                <MenuComponent
                    variant="home"
                    onScrollToSection={(key) => {
                        if (key === "about") this.scrollToSection(this.aboutRef.current);
                        if (key === "event") this.scrollToSection(this.eventRef.current);
                        if (key === "rules") this.scrollToSection(this.rulesRef.current);
                    }}
                />

                <section className="sec sec-hero">
                    <h1 className="hero-title">
                        Wisconsin-Dairyland Programming Competition
                    </h1>
                    <p className="hero-subtext">
                        A team-based high school competition with multiple divisions and automatic
                        grading through Abacus.
                        <br />
                        Hosted by CSTA Wisconsin-Dairyland and Marquette University ACM and UPE.
                    </p>
                    <div className="hero-subtitle">{competitionDate}</div>

                    <CompetitionStageStatus audience="home" />

                    {!loggedIn ? (
                        <div className="action-btns">
                            <Link to="/register" className="register-btn home-btn">
                                Register Your School
                            </Link>
                            <Link to="/teacher-login" className="login-btn home-btn">
                                Teacher Login
                            </Link>
                            <Link to="/student-login" className="login-btn home-btn">
                                Student Login
                            </Link>
                        </div>
                    ) : null}
                </section>

                <section className="sec" ref={this.aboutRef}>
                    <h2 className="sec-title">About the Competition</h2>
                    <p className="sec-text">
                        The competition supports both in-person and virtual participation, making it
                        easy for schools to take part regardless of location. Teachers can register
                        teams, manage participation, and focus on supporting their students while
                        the competition infrastructure handles submissions and evaluation. After the
                        competition teachers can view student submissions to help guide future
                        learning.
                    </p>
                    <p className="sec-text">The competition is offered in three divisions:</p>
                    <p className="sec-text">
                        For frequently asked questions, please click{" "}
                        <a
                            href="https://docs.google.com/document/d/1VRXpKHG1uH4ixFmNQCAKpqmm8vCL0nM1ewvudH13scQ/edit?usp=sharing"
                            target="_blank"
                            rel="noreferrer"
                        >
                            this link
                        </a>
                        .
                    </p>
                    <div className="sec-subtitle">
                        <span className="blue-div">Blue Division</span> &#8212; Java & Python
                    </div>
                    <p className="sec-text">
                        A traditional, team-based programming competition modeled after the ACM
                        International Collegiate Programming Contest. Teams of three or four
                        students have three hours to collaboratively solve problems similar in scope
                        to AP Computer Science exam questions. Points are awarded based on the
                        number of problems correctly solved and the time taken, with appropriate
                        penalties for incorrect submissions.
                    </p>
                    <p className="sec-text">
                        The ACM International Collegiate Programming Contest is an algorithmic
                        programming competition for college students in which teams of three solve
                        real-world problems under time pressure. It emphasizes collaboration,
                        creativity, innovation, and performance under pressure, and is widely
                        recognized as the oldest, largest, and most prestigious programming contest
                        in the world.
                    </p>
                    <div className="sec-subtitle">
                        <span className="gold-div">Gold Division</span> &#8212; Scratch
                    </div>
                    <p className="sec-text">
                        A team-based programming competition for high school students who are
                        beginning their programming education. Teams of two or three students have
                        three hours to collaboratively solve problems focused on logic, mathematics,
                        and creativity. Points are awarded based on the number of problems
                        correctly solved and original creative ideas, with penalties for incorrect
                        submissions or academic dishonesty.
                    </p>
                    <p className="sec-text">
                        All problems are written using Scratch, an event-driven, block-based visual
                        programming language developed at the MIT Media Lab at the Massachusetts
                        Institute of Technology.
                    </p>
                    <div className="sec-subtitle">
                        <span className="eagle-div">Eagle Division</span> &#8212; AP Computer
                        Science Principles
                    </div>
                    <p className="sec-text">
                        Teams of two to four students will be working together to solve a problem
                        that is present in society and is awaiting a technological solution. The
                        students then have three hours to develop a solution using their knowledge
                        of computer science principles and technologies. Students are not required
                        to write code or create a working prototype, but rather have a flushed out,
                        technical solution.
                    </p>
                    <p className="sec-text">
                        At the end of the three hours, each team will present (5 – 10 minutes)
                        their solution to a small board of faculty members. The faculty will ask a
                        few questions and ultimately vote on a winner.
                    </p>
                </section>

                <section className="sec" ref={this.eventRef}>
                    <h2 className="sec-title">Event Details</h2>
                    <div className="sec-subtitle space">Date</div>
                    <p className="sec-text">{competitionDate}</p>
                    <div className="sec-subtitle">Location</div>
                    <p className="sec-text">In-person or Virtual</p>
                    <div className="sec-subtitle">Schedule</div>
                    <ul className="sec-list">
                        <li className="sec-list-item">8:00 - 8:30 AM &#8212; Check-in and Setup</li>
                        <li className="sec-list-item">8:30 - 9:00 AM &#8212; Practice Problems</li>
                        <li className="sec-list-item">9:00 AM - 12:00 PM &#8212; Competition</li>
                        <li className="sec-list-item">12:15 - 1:00 PM &#8212; Lunch Break</li>
                        <li className="sec-list-item">1:00 - 2:00 PM &#8212; Awards Ceremony</li>
                    </ul>
                </section>

                <section className="sec" ref={this.rulesRef}>
                    <h2 className="sec-title">Registration and Rules</h2>
                    <p className="sec-text close">
                        Registration for the competition is completed per team. An invoice will be
                        sent to each school.
                    </p>
                    <p className="sec-text bold close">Pricing Per Team</p>
                    <div className="pricing-grid">
                        <div className="pricing-card">
                            <h3 className="card-title">In-Person Participation</h3>
                            <table className="pricing-table">
                                <thead>
                                    <tr>
                                        <th>Division</th>
                                        <th>Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Gold & Eagle</td>
                                        <td>$60</td>
                                    </tr>
                                    <tr>
                                        <td>Blue</td>
                                        <td>$80</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="pricing-card">
                            <h3 className="card-title">Virtual Participation</h3>
                            <table className="pricing-table">
                                <thead>
                                    <tr>
                                        <th>Division</th>
                                        <th>Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Gold & Eagle</td>
                                        <td>$50</td>
                                    </tr>
                                    <tr>
                                        <td>Blue</td>
                                        <td>$60</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <p className="sec-text">
                        Registration closes on <span className="bold">{registrationDeadline}</span>.
                    </p>
                    <div className="sec-subtitle">Artifical Intelligence Policy</div>
                    <p className="sec-text">
                        The use of AI tools during the competition is <strong>strictly prohibited</strong>.
                        Violation of this policy may result in immediate disqualification of the team.
                        All teams are expected to compete independently and uphold academic integrity.
                    </p>
                    <div className="sec-subtitle">Approved Development Environments</div>
                    <p className="sec-text close">
                        To ensure fairness and compliance with the AI policy, only approved IDEs may
                        be used. The approved environments for the Blue division include:
                    </p>
                    <ul className="sec-list">
                        <li className="sec-list-item">Eclipse IDE</li>
                        <li className="sec-list-item">Python IDLE</li>
                    </ul>
                    <p className="sec-text">
                        No additional development tools are permitted. Specific device instructions
                        (school-provided or personal laptops) will be communicated based on division.
                    </p>
                    <div className="sec-subtitle">Submissions</div>
                    <p className="sec-text">
                        All solutions for the Blue division must be submitted through the Abacus
                        competition platform. Teams will upload their solution files directly within
                        the system. Only the latest submission file prior to the deadline with the
                        most testcases passed will be evaluated. Submissions outside of the official
                        competition window will not be accepted.
                    </p>
                </section>

                <footer className="footer">
                    <div className="footer-content">
                        <div className="footer-section">
                            <div className="footer-title">
                                Wisconsin-Dairyland Programming Competition
                            </div>
                            <div className="footer-text">Hosted by Marquette University</div>
                            <div className="footer-text">
                                Organized by the ACM/UPE Student Chapter
                            </div>
                        </div>
                        <div className="footer-section">
                            <div className="footer-title">Questions? Reach out at:</div>
                            <a className="footer-link" href={`mailto:${EMAIL}`}>
                                {EMAIL}
                            </a>
                        </div>
                        <div className="footer-section">
                            <div className="footer-title">Follow Us</div>
                            <div className="footer-icons">
                                <a
                                    className="footer-icon"
                                    href="https://github.com/musyslab/Abacus"
                                >
                                    <FaGithub />
                                </a>
                                <a
                                    className="footer-icon"
                                    href="https://www.instagram.com/acm_mu/"
                                >
                                    <FaInstagram />
                                </a>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>
        );
    }
}

export default Home;