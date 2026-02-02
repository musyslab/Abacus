// Similar to admin/AdminStudentRoster.tsx

import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs"
import MenuComponent from "../components/MenuComponent"
import { Helmet } from "react-helmet"

const AdminSchoolRoster = () => {
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

        {/* Admin / Judge */}
        <DirectoryBreadcrumbs
            items={[{ label: 'School List' }]}
            trailingSeparator={true}
        />
    </>
  )
}

export default AdminSchoolRoster