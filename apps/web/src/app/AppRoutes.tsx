import { Role } from '@agenda/shared';
import { Navigate, Route, Routes } from 'react-router';
import { LoginPage } from '@/features/auth/LoginPage';
import { RedirectIfAuthenticated } from '@/features/auth/RedirectIfAuthenticated';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { RequireRole } from '@/features/auth/RequireRole';
import { AdminPage } from '@/pages/AdminPage';
import { AdminSettingsPage } from '@/pages/AdminSettingsPage';
import { BookingPage } from '@/pages/BookingPage';
import { MyAppointmentsPage } from '@/pages/MyAppointmentsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { Layout } from './Layout';

/** Routes of PRD 15.1. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/agendar" replace />} />
        <Route path="agendar" element={<BookingPage />} />
        <Route
          path="login"
          element={
            <RedirectIfAuthenticated>
              <LoginPage />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="cadastro"
          element={
            <RedirectIfAuthenticated>
              <RegisterPage />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="meus-agendamentos"
          element={
            <RequireRole role={Role.CLIENT}>
              <MyAppointmentsPage />
            </RequireRole>
          }
        />
        <Route
          path="admin"
          element={
            <RequireRole role={Role.ADMIN}>
              <AdminPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/configuracoes"
          element={
            <RequireRole role={Role.ADMIN}>
              <AdminSettingsPage />
            </RequireRole>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
