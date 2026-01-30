// Similar to /components/CodeDiffView.tsx

import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs"
import MenuComponent from "../components/MenuComponent"
import { Helmet } from "react-helmet"

const StudentDiff = () => {
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

        <DirectoryBreadcrumbs
            items={[{ label: 'Teacher List' }]}
            trailingSeparator={true}
        />
        {/* Admin */}
         <DirectoryBreadcrumbs
            items={[
                { label: 'Teacher List', to:'/admin/teachers' },
                { label: 'Student List', to:'/admin/:teacher_id/students' },
                { label: 'Student Submission List', to:'/admin/:teacher_id/:student_id/student-submissions' },
                { label: 'Student Diff' },
            ]}
        />
        {/* Judge */}
        <DirectoryBreadcrumbs
            items={[
                { label: 'Teacher List', to:'/judge/teachers' },
                { label: 'Student List', to:'/judge/:teacher_id/students' },
                { label: 'Student Submission List', to:'/judge/:teacher_id/:student_id/student-submissions' },
                { label: 'Student Diff' },
            ]}
        />
        {/* Teacher */}
        <DirectoryBreadcrumbs
            items={[{ label: 'Student List', to:'/teacher/students' },
                    { label: 'Student Submissions List', to:'/teacher/student/:student_id' },
                    { label: 'Student Diff'}
            ]}
        />
        {/* Student */}
        <DirectoryBreadcrumbs
            items={[{ label: 'Problem List', to:'/student/problems' },
                    { label: 'Student Diff' }
            ]}
        />
    </>
  )
}

export default StudentDiff