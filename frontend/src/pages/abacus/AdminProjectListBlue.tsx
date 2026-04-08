import AdminProjectList from './AdminProjectList';

export default function AdminProjectListBlue() {
    return (
        <AdminProjectList
            division="blue"
            divisionLabel="Blue Division"
            manageBasePath="/admin/blue/problem/manage"
        />
    );
}