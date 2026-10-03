import { registerSchema, type RegisterData, type RegisterInput } from '@agenda/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getErrorMessage } from '@/lib/api-client';
import { withRedirect } from '@/lib/redirect';
import { applyApiErrors } from './apply-api-errors';
import { useRegister } from './use-session';

const FIELDS = ['name', 'email', 'phone', 'password'] as const;

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const registerUser = useRegister();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterInput, unknown, RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', phone: '', password: '' },
  });

  const onSubmit = handleSubmit((data) => {
    registerUser.mutate(data, {
      onError: (error) => {
        if (!applyApiErrors(error, setError, FIELDS)) toast.error(getErrorMessage(error));
      },
    });
  });

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Criar conta</CardTitle>
        <CardDescription>Cadastre-se para agendar seus horários.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4">
          <FormField
            id="name"
            label="Nome"
            autoComplete="name"
            error={errors.name?.message}
            {...register('name')}
          />
          <FormField
            id="email"
            label="E-mail"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <FormField
            id="phone"
            label="Telefone (opcional)"
            type="tel"
            autoComplete="tel"
            placeholder="(11) 98765-4321"
            error={errors.phone?.message}
            {...register('phone')}
          />
          <FormField
            id="password"
            label="Senha"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" disabled={registerUser.isPending}>
            {registerUser.isPending ? 'Criando conta…' : 'Criar conta'}
          </Button>
        </form>
        <p className="text-muted-foreground mt-4 text-center text-sm">
          Já tem conta?{' '}
          <Link
            to={withRedirect('/login', searchParams.get('redirect'))}
            className="text-foreground underline underline-offset-4"
          >
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
