
import DirectoryBreadcrumbs from "pages/components/DirectoryBreadcrumbs"
import MenuComponent from "pages/components/MenuComponent"
import { Helmet } from "react-helmet"

const StudentSubmissions = () => {
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
                { label: 'Student List', to:'/admin/:teacher_id/students' },
                { label: 'Student Submissions List' },
            ]}
        />
        {/* Judge */}
        <DirectoryBreadcrumbs
            items={[
                { label: 'Teacher List', to:'/judge/teachers' },
                { label: 'Student List', to:'/judge/:teacher_id/students' },
                { label: 'Student Submissions List' },

            ]}
        />
         {/* Teacher */}
        <DirectoryBreadcrumbs
            items={[{ label: 'Student List', to:'/teacher/students' },
                    { label: 'Student Submissions List' }
            ]}
        />
    </>
  )
}

export default StudentSubmissions