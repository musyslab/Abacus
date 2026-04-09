import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

type TeamMeResponse = {
    division?: string | null;
};

export default function StudentProjectSelection() {
    const apiBase = (import.meta.env.VITE_API_URL as string) || "";
    const navigate = useNavigate();
    const [pageError, setPageError] = useState<string>("");

    function authConfig() {
        const token = localStorage.getItem("AUTOTA_AUTH_TOKEN");
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    }

    useEffect(() => {
        let mounted = true;

        async function resolveDestination() {
            try {
                const res = await axios.get<TeamMeResponse>(
                    `${apiBase}/teams/me`,
                    authConfig()
                );

                const division = String(res.data?.division || "")
                    .trim()
                    .toLowerCase();

                if (!mounted) return;

                if (division === "gold") {
                    navigate("/student/gold/problems", { replace: true });
                    return;
                }

                if (division === "eagle") {
                    navigate("/student/eagle-home", { replace: true });
                    return;
                }

                navigate("/student/blue/problems", { replace: true });
            } catch (err: unknown) {
                if (!mounted) return;

                if (axios.isAxiosError(err)) {
                    const msg =
                        (err.response?.data as { message?: string } | undefined)
                            ?.message ||
                        err.message ||
                        "Failed to determine your team division.";
                    setPageError(msg);
                    return;
                }

                setPageError("Failed to determine your team division.");
            }
        }

        resolveDestination();

        return () => {
            mounted = false;
        };
    }, [apiBase, navigate]);

    return (
        <div style={{ padding: "24px" }}>
            {pageError || "Loading your division-specific problem page..."}
        </div>
    );
}