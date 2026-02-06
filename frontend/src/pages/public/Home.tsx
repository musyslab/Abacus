import React, { Component } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";

import "../../styling/Home.scss";

import { FaGithub, FaInstagram } from "react-icons/fa";
import MenuComponent from "../components/MenuComponent";

class Home extends Component {

    render() {
        const year = new Date().getFullYear()
        const loggedIn = localStorage.getItem("AUTOTA_AUTH_TOKEN") !== null

        // References for sections
        const heroRef = React.createRef<HTMLElement>()
        const aboutRef = React.createRef<HTMLElement>()
        const abacusRef = React.createRef<HTMLElement>()
        const footerRef = React.createRef<HTMLElement>()

        // Scroll to section helper
        const scrollToSection = (section: HTMLElement) => {
            if (!section) return
            section.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }

        return (
            <div className="home-page">
                <Helmet>
                    <title>Abacus</title>
                </Helmet>

                <MenuComponent
                    variant="home"
                    onScrollToSection={(key) => {
                        if (key === "hero" && heroRef.current) scrollToSection(heroRef.current)
                        if (key === "about" && aboutRef.current) scrollToSection(aboutRef.current)
                        if (key === "abacus" && abacusRef.current) scrollToSection(abacusRef.current)
                        if (key === "contact" && footerRef.current) scrollToSection(footerRef.current)
                    }}
                />

                <section className="sec sec-hero" ref={heroRef}>
                    <h1 className="hero-title">{year} Wisconsin Dairy-land Programming Competition</h1>
                    <p className="hero-subtitle">
                        A team-based high school competition with multiple divisions and automatic grading through Abacus.
                        <br />
                        Hosted by CSTA Wisconsin-Dairyland and Marquette University ACM and UPE.
                    </p>
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
                <section className="sec" ref={aboutRef}>
                    <h2 className="sec-title">About the Competition</h2>
                    <p className="sec-text">
                        The competition supports both in-person and virtual participation, making it easy for schools to take part regardless of location.
                        Teachers can register teams, manage participation, and focus on supporting their students while the competition infrastructure
                        handles submissions and evaluation. After the competition teachers receive student submission reports to help guide future learning.
                    </p>
                    <p className="sec-text">
                        The competition is offered in two divisions:
                    </p>
                    <div className="sec-subtitle"><span className="blue-div">Blue Division</span> &#8212; Java & Python</div>
                    <p className="sec-text">
                        A traditional, team-based programming competition modeled after the ACM International Collegiate Programming Contest. Teams of three or
                        four students have three hours to collaboratively solve problems similar in scope to AP Computer Science exam questions.
                        Points are awarded based on the number of problems correctly solved and the time taken, with appropriate penalties for incorrect submissions.
                    </p>
                    <p className="sec-text">
                        The ACM International Collegiate Programming Contest is an algorithmic programming competition for college students in which teams of
                        three solve real-world problems under time pressure. It emphasizes collaboration, creativity, innovation, and performance under pressure,
                        and is widely recognized as the oldest, largest, and most prestigious programming contest in the world.
                    </p>
                    <div className="sec-subtitle"><span className="gold-div">Gold Division</span> &#8212; Scratch</div>
                    <p className="sec-text">
                        A team-based programming competition for high school students who are beginning their programming education.
                        Teams of two or three students have three hours to collaboratively solve problems focused on logic, mathematics, and creativity.
                        Points are awarded based on the number of problems correctly solved and original creative ideas, with penalties for incorrect submissions or academic dishonesty.
                    </p>
                    <p className="sec-text">
                        All problems are written using Scratch, an event-driven, block-based visual programming language developed at the MIT
                        Media Lab at the Massachusetts Institute of Technology.
                    </p>
                    <div className="sec-subtitle"><span className="eagle-div">Eagle Division</span> &#8212; AP Computer Science Principles</div>
                    <p className="sec-text">
                        Teams of two to four students will be working together to solve a problem that is present in society and is awaiting a technological solution.
                         The students then have three hours to develop a solution using their knowledge of computer science principles and technologies.
                          Students are not required to write code or create a working prototype, but rather have a flushed out, technical solution.
                    </p>
                    <p className="sec-text">
                        At the end of the three hours, each team will present (5 – 10 minutes) their solution to a small board of faculty members.
                         The faculty will ask a few questions and ultimately vote on a winner.
                    </p>
                    <div className="sec-subtitle">Logistics</div>
                    <div className="sec-text"><span className="bold">Date:</span> Wednesday, April 15th, {year}</div>
                    <div className="sec-text"><span className="bold">Location:</span> TBD</div>
                    <div className="sec-text"><span className="bold">Schedule:</span>
                        <ul className="sec-list">
                            <li className="sec-text">8:00 - 8:30 AM &#8212; Check-in and Setup</li>
                            <li className="sec-text">8:30 - 9:00 AM &#8212; Practice Problems</li>
                            <li className="sec-text">9:00 AM - 12:00 PM &#8212; Competition</li>
                            <li className="sec-text">12:15 - 1:00 PM &#8212; Lunch Break</li>
                            <li className="sec-text">1:00 - 2:00 PM &#8212; Awards Ceremony</li>
                        </ul>
                    </div>
                </section>
                <section className="sec" ref={abacusRef}>
                    <div className="sec-title">Abacus</div>
                    <div className="sec-text">A section explaining / showing Abacus</div>
                </section>
                <footer className="footer" ref={footerRef}>
                    <div className="footer-content">
                        <div className="footer-section">
                            <div className="footer-title">Explore</div>
                            <button type="button" className="footer-link" onClick={() => aboutRef.current && scrollToSection(aboutRef.current)}>
                                About
                            </button>
                            <button type="button" className="footer-link" onClick={() => abacusRef.current && scrollToSection(abacusRef.current)}>
                                Abacus
                            </button>
                            <button type="button" className="footer-link" onClick={() => footerRef.current && scrollToSection(footerRef.current)}>
                                Contact
                            </button>
                        </div>
                        <div className="footer-section">
                            <div className="footer-title">Contact</div>
                            <div className="footer-text">Email: acm@marquette.edu</div>
                        </div>
                        <div className="footer-section">
                            <div className="footer-title">Follow Us</div>
                            <div className="footer-icons">
                                <a className="footer-icon" href="https://github.com/musyslab/Abacus">
                                    <FaGithub />
                                </a>
                                <a className="footer-icon" href="https://www.instagram.com/acm_mu/">
                                    <FaInstagram />
                                </a>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>
        )
    }
}

export default Home;