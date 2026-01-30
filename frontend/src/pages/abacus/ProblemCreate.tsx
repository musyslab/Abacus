
import DirectoryBreadcrumbs from "pages/components/DirectoryBreadcrumbs"
import MenuComponent from "pages/components/MenuComponent"
import { Helmet } from "react-helmet"

const ProblemCreate = () => {
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
                { label: 'Problem List', to:'/admin/problems' },
                { label: 'Create Problem' },
            ]}
        />
        {/* Judge */}
        <DirectoryBreadcrumbs
            items={[
                { label: 'Teacher List', to:'/judge/teachers' },
                { label: 'Problem List', to:'/judge/problems' },
                { label: 'Create Problem' },
            ]}
        />
    </>
  )
}

export default ProblemCreate