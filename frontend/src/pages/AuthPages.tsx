import { FormEvent, ReactNode, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Field } from '../components/inputs';
import { ErrorMessage, errorText } from '../components/ui';

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="auth">
      <main className="auth-main">
        <div className="auth-form">
          <strong className="brand">BaaS</strong>
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
          {children}
          <p className="center-text">{footer}</p>
        </div>
      </main>
    </div>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Entrar" subtitle="Acesse o painel do lojista." footer={<>Não tem conta? <Link to="/cadastro">Cadastre-se</Link></>}>
      <form className="card" onSubmit={submit}>
        <ErrorMessage error={error} />
        <Field label="E-mail"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></Field>
        <Field label="Senha"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></Field>
        <button className="primary block" disabled={busy}>{busy ? 'Entrando...' : 'Entrar'}</button>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await register(name, email, password);
      navigate('/gateway');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Criar conta" subtitle="Leva menos de um minuto." footer={<>Já tem conta? <Link to="/login">Entrar</Link></>}>
      <form className="card" onSubmit={submit}>
        <ErrorMessage error={error} />
        <Field label="Nome"><input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" /></Field>
        <Field label="E-mail"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></Field>
        <Field label="Senha" hint="Mínimo de 8 caracteres."><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" /></Field>
        <button className="primary block" disabled={busy}>{busy ? 'Criando...' : 'Criar conta'}</button>
      </form>
    </AuthShell>
  );
}
