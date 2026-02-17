
import React, { useEffect, useState } from "react";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs"
import MenuComponent from "../components/MenuComponent"
import { Helmet } from "react-helmet"
import axios from "axios";

type Division = "Blue" | "Gold" | "Eagle";

type TeamInfo = {
    id: number;
    name: string;
    division: Division;
}

export default function StudentProjectSelection() {
    const apiBase = (import.meta.env.VITE_API_URL as string) || "";
    function authConfig() {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }

    const [team, setTeam] = useState<TeamInfo | null>(null);

    async function fetchTeamInfo() {
        try {
            const res = await axios.get(`${apiBase}/teams/me`, authConfig());
            const data = res.data;
            setTeam({
                id: data.id,
                name: data.name,
                division: data.division
            });
        } catch (err) {
            setTeam(null);
        }
    }

    useEffect(() => {
        fetchTeamInfo();
    }, [apiBase]);

    return (
        <>
            <Helmet>
                <title>Abacus</title>
            </Helmet>

            <MenuComponent/>

            <div className="student-project-selection-root">
                <DirectoryBreadcrumbs items={[{ label: 'Problem Select' }]} trailingSeparator={true} />

                <div className="pageTitle">{team ? team.name : "Problem Select"}</div>

                <div className="student-project-selection-content">
                    <section className="sec">
                        <h2 className="sec-subtitle">Problem portal coming soon...</h2>
                        <p className="sec-text close">Problems will appear here once they are available.</p>
                    </section>
                </div>
            </div>
        </>
    )
}