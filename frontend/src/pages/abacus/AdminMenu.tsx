import { Helmet } from "react-helmet";
import { FaComments, FaPuzzlePiece, FaSchool, FaUpload } from "react-icons/fa";
import { Link } from "react-router-dom";

import DirectoryBreadcrumbs from '../components/DirectoryBreadcrumbs';
import MenuComponent from '../components/MenuComponent';
import CompetitionStageStatus from '../components/CompetitionStageStatus';

import '../../styling/AdminMenu.scss';

export default function AdminMenu() {
    const menuItems = [
        {
            title: 'School List',
            description: 'View schools and open team management.',
            to: '/admin/schools',
            className: 'admin-menu-nav__item admin-menu-nav__item--schools',
            icon: <FaSchool aria-hidden="true" />,
        },
        {
            title: 'Blue Division Problem List',
            description:
                'Create, edit, reorder, and review Blue Division problems.',
            to: '/admin/blue/problems',
            className: 'admin-menu-nav__item admin-menu-nav__item--problems',
            icon: <FaPuzzlePiece aria-hidden="true" />,
        },
        {
            title: 'Gold Division Problem List',
            description:
                'Create, edit, reorder, and review Gold Division problems.',
            to: '/admin/gold/problems',
            className: 'admin-menu-nav__item admin-menu-nav__item--problems',
            icon: <FaPuzzlePiece aria-hidden="true" />,
        },
        {
            title: 'Admin Upload',
            description: 'Open the upload workspace for admin submissions.',
            to: '/admin/upload',
            className: 'admin-menu-nav__item admin-menu-nav__item--upload',
            icon: <FaUpload aria-hidden="true" />,
        },
        {
            title: "Eagle division chat",
            description: "Message virtual Eagle teams and review the published Eagle problem.",
            to: "/admin/eagle-chat",
            className: "admin-menu-nav__item admin-menu-nav__item--eagle",
            icon: <FaComments aria-hidden="true" />,
        },
    ];

    return (
        <>
            <Helmet>
                <title>[Admin] Abacus</title>
            </Helmet>

            <MenuComponent />

            <div className="admin-menu-root">
                <DirectoryBreadcrumbs
                    items={[{ label: 'Admin Menu' }]}
                    trailingSeparator={true}
                />

                <div className="pageTitle">Admin Menu</div>

                <div className="admin-menu-content">
                    <CompetitionStageStatus />

                    <div className="admin-menu-intro">
                        <div className="admin-menu-intro__title">Navigation</div>
                        <div className="admin-menu-intro__text">
                            Choose an admin section below.
                        </div>
                    </div>

                    <nav
                        className="admin-menu-nav"
                        aria-label="Admin menu navigation"
                    >
                        {menuItems.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className={item.className}
                            >
                                <div className="admin-menu-nav__header">
                                    <div className="admin-menu-nav__icon">
                                        {item.icon}
                                    </div>
                                    <div className="admin-menu-nav__title">
                                        {item.title}
                                    </div>
                                </div>

                                <div className="admin-menu-nav__description">
                                    {item.description}
                                </div>
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>
        </>
    );
}