import React from "react";
import { Helmet } from "react-helmet";

import MenuComponent from "../components/MenuComponent";
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs";

const StudentEagleSubmissions = () => {
    return (
        <>
            <Helmet>
                <title>Abacus</title>
            </Helmet>

            <MenuComponent />

            <div className="admin-team-manage-root">
                <DirectoryBreadcrumbs
                    items={[
                        { label: "Eagle Submissions" }
                    ]}
                    trailingSeparator={false}
                />

                <div className="pageTitle">Eagle Submissions</div>

                <div className="admin-team-manage-content">
                    <div className="callout callout--info">
                        Eagle division submissions page created successfully.
                    </div>

                    <div className="callout callout--warning">
                        Add the Eagle-specific submission UI here.
                    </div>
                </div>
            </div>
        </>
    );
};

export default StudentEagleSubmissions;