import { Role } from '@agenda/shared';
import { NavLink, Outlet } from 'react-router';
import { Button } from '@/components/ui/button';
import { useLogout, useSession } from '@/features/auth/use-session';
import { cn } from '@/lib/utils';

type NavItem = { to: string; label: string; end?: boolean };

const VISITOR_LINKS: NavItem[] = [
  { to: '/agendar', label: 'Agendar' },
  { to: '/login', label: 'Entrar' },
  { to: '/cadastro', label: 'Criar conta' },
];
const CLIENT_LINKS: NavItem[] = [
  { to: '/agendar', label: 'Agendar' },
  { to: '/meus-agendamentos', label: 'Meus agendamentos' },
];
const ADMIN_LINKS: NavItem[] = [
  { to: '/admin', label: 'Painel', end: true },
  { to: '/admin/configuracoes', label: 'Configurações' },
];

function Header() {
  const { data: user, isPending } = useSession();
  const logout = useLogout();

  const links = !user ? VISITOR_LINKS : user.role === Role.ADMIN ? ADMIN_LINKS : CLIENT_LINKS;

  return (
    <header className="bg-background border-b">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <NavLink to="/" className="font-semibold">
          Agendamentos
        </NavLink>
        {!isPending && (
          <>
            <nav className="flex flex-1 flex-wrap gap-4 text-sm">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    cn(
                      'text-muted-foreground hover:text-foreground',
                      isActive && 'text-foreground font-medium',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
            {user && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">{user.name}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                >
                  Sair
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
}

export function Layout() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
