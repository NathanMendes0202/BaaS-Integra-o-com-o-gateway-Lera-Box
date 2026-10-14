import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';

const groups: { title: string; items: [string, string][] }[] = [
  { title: 'Vendas', items: [['/', 'Painel'], ['/links', 'Links de pagamento'], ['/transacoes', 'Transações']] },
  { title: 'Dinheiro', items: [['/carteira', 'Carteira e saques']] },
  { title: 'Configurações', items: [['/webhooks', 'Webhooks'], ['/gateway', 'Conta no gateway']] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="shell">
      <div className="mobilebar">
        <strong className="brand">BaaS</strong>
        <button type="button" aria-expanded={open} aria-controls="menu" onClick={() => setOpen(!open)}>
          {open ? 'Fechar' : 'Menu'}
        </button>
      </div>

      <aside id="menu" className={`sidebar${open ? ' open' : ''}`}>
        <strong className="brand">BaaS</strong>
        <nav aria-label="Principal">
          {groups.map((g) => (
            <div key={g.title} className="nav-group">
              <span>{g.title}</span>
              {g.items.map(([to, label]) => (
                <NavLink key={to} to={to} end={to === '/'}>
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-user">
          <span>{user?.name}</span>
          <small>{user?.email}</small>
          <button type="button" onClick={logout}>Sair</button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
