import { Link, useLocation } from 'react-router-dom';
import './pages.css';

export default function NotFound() {
  const { pathname } = useLocation();
  return (
    <main className="notfound ruled-paper page-fade" id="main">
      <div className="notfound__inner">
        <p className="eyebrow">404 · 0 rows returned</p>
        <h1 className="notfound__title">Nothing is filed under this page.</h1>
        <p className="mono small faint">SELECT * FROM Page WHERE path = '{pathname}';</p>
        <Link to="/browse" className="notfound__link">
          Go to Browse →
        </Link>
      </div>
    </main>
  );
}
