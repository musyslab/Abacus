// Similar to admin/AdminStudentRoster.tsx

import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs"
import MenuComponent from "../components/MenuComponent"
import { Helmet } from "react-helmet"

const StudentRoster = () => {
  return (
    <>
        <Helmet>
            <title>Abacus</title>
        </Helmet>

        <MenuComponent
            showUpload={false}
            showAdminUpload={false}
            showHelp={false}
            showCreate={false}
            showLast={false}
            showReviewButton={false}
        />

        {/* Admin */}
        <DirectoryBreadcrumbs
            items={[
                { label: 'Teacher List', to:'/admin/schools' },
                { label: 'Student List' },
            ]}
        />
        {/* Judge */}
        <DirectoryBreadcrumbs
            items={[
                { label: 'Teacher List', to:'/judge/schools' },
                { label: 'Student List' },
            ]}
        />
        {/* Teacher */}
        <DirectoryBreadcrumbs
            items={[{ label: 'Student List' }]}
            trailingSeparator={true}
        />
    </>
  )
}

export default StudentRoster