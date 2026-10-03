import { loginSchema, type LoginData, type LoginInput } from '@agenda/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getErrorMessage } from '@/lib/api-client';
import { applyApiErrors } from '@/lib/apply-api-errors';
import { withRedirect } from '@/lib/redirect';
import { useLogin } from './use-session';

const FIELDS = ['email', 'password'] as const;

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput, unknown, LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit((data) => {
    login.mutate(data, {
      onError: (error) => {
        if (!applyApiErrors(error, setError, FIELDS)) toast.error(getErrorMessage(error));
      },
    });
  });

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Entrar</CardTitle>
        <CardDescription>Acesse com seu e-mail e senha.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4">
          <FormField
            id="email"
            label="E-mail"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <FormField
            id="password"
            label="Senha"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          {errors.root?.server && (
            <p role="alert" className="text-destructive text-sm">
              {errors.root.server.message}
            </p>
          )}
          <Button type="submit" disabled={login.isPending}>
            {login.isPending ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
        <p className="text-muted-foreground mt-4 text-center text-sm">
          Não tem conta?{' '}
          <Link
            to={withRedirect('/cadastro', searchParams.get('redirect'))}
            className="text-foreground underline underline-offset-4"
          >
            Criar conta
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
