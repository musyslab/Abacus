import AdminProjectList from './AdminProjectList';

export default function AdminProjectListGold() {
    return (
        <AdminProjectList
            division="gold"
            divisionLabel="Gold Division"
            manageBasePath="/admin/gold/problem/manage"
        />
    );
}