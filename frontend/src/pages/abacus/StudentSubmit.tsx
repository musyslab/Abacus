// Similar to /student/StudentUpload.tsx

import DirectoryBreadcrumbs from "pages/components/DirectoryBreadcrumbs"
import MenuComponent from "pages/components/MenuComponent"
import { Helmet } from "react-helmet"

const StudentSubmit = () => {
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

        {/* Student */}
        <DirectoryBreadcrumbs
            items={[{ label: 'Problem List', to: '/student/problems' },
                    { label: 'Student Submit'}
            ]}
        />
    </>
  )
}

export default StudentSubmit