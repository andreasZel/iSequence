import { NavLink } from 'react-router-dom';

const LINKS = [
    { to: '/', label: 'Create' },
    { to: '/videos', label: 'Videos' },
    { to: '/images', label: 'Images' }
];

export const NavBar = () => {
    return (
        <header className="nav">
            <span className="nav__brand">iSequence</span>
            <nav className="nav__links">
                {LINKS.map((link) => (
                    <NavLink key={link.to} to={link.to} end className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`}>
                        {link.label}
                    </NavLink>
                ))}
            </nav>
        </header>
    );
};
