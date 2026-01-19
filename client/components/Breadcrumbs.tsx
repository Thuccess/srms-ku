import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  const getBreadcrumbName = (path: string): string => {
    const nameMap: Record<string, string> = {
      'students': 'Students',
      'settings': 'Settings',
    };
    return nameMap[path] || path.charAt(0).toUpperCase() + path.slice(1);
  };

  if (pathnames.length === 0) {
    return null; // Don't show breadcrumbs on home page
  }

  return (
    <nav 
      className="px-8 pt-8 pb-4 max-w-[1600px] mx-auto" 
      aria-label="Breadcrumb navigation"
    >
      <ol className="flex items-center gap-2 text-sm font-medium text-slate-600" itemScope itemType="https://schema.org/BreadcrumbList">
        <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
          <Link
            to="/"
            className="flex items-center gap-1.5 hover:text-ku-600 transition-colors focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-2 rounded"
            aria-label="Home"
            itemProp="item"
          >
            <Home size={16} className="text-slate-400" aria-hidden="true" />
            <span itemProp="name">Dashboard</span>
          </Link>
          <meta itemProp="position" content="1" />
        </li>
        
        {pathnames.map((value, index) => {
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathnames.length - 1;
          const name = getBreadcrumbName(value);

          return (
            <li 
              key={to} 
              className="flex items-center gap-2"
              itemProp="itemListElement" 
              itemScope 
              itemType="https://schema.org/ListItem"
            >
              <ChevronRight size={16} className="text-slate-300" aria-hidden="true" />
              {isLast ? (
                <span 
                  className="text-slate-900 font-semibold"
                  itemProp="name"
                  aria-current="page"
                >
                  {name}
                </span>
              ) : (
                <Link
                  to={to}
                  className="hover:text-ku-600 transition-colors focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-2 rounded"
                  itemProp="item"
                >
                  <span itemProp="name">{name}</span>
                </Link>
              )}
              <meta itemProp="position" content={String(index + 2)} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;

