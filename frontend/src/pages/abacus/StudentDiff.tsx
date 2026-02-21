// Similar to /components/CodeDiffView.tsx

import { useParams } from "react-router-dom"
import DiffView from "../components/CodeDiffView"
import DirectoryBreadcrumbs from "../components/DirectoryBreadcrumbs"
import MenuComponent from "../components/MenuComponent"
import { Helmet } from "react-helmet"

const StudentDiff = () => {
    const { id } = useParams<{ id: string; }>()
    const submissionId = id !== undefined ? parseInt(id, 10) : -1

    return (
        <>
            <Helmet>
                <title>Abacus</title>
            </Helmet>

            <MenuComponent/>

            <DirectoryBreadcrumbs
                items={[
                    { label: 'School List', to:'/admin/schools' },
                    { label: 'Code View' },
                ]}
            />

            <div className="pageTitle">Submission Results</div>

            <DiffView submissionId={submissionId} disableCopy />
        </>
  )
}

export default StudentDiff