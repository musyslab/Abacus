// Similar to admin/AdminProjectList.tsx

import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs"
import MenuComponent from "../components/MenuComponent"
import { Helmet } from "react-helmet"

const ProblemList = () => {
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
                { label: 'Teacher List', to:'/admin/teachers' },
                { label: 'Problem List' },
            ]}
        />
        {/* Judge */}
        <DirectoryBreadcrumbs
            items={[
                { label: 'Teacher List', to:'/judge/teachers' },
                { label: 'Problem List' },
            ]}
        />
        {/* Student */}
        <DirectoryBreadcrumbs
            items={[{ label: 'Problem List' }]}
            trailingSeparator={true}
        />
    </>
  )
}

export default ProblemList