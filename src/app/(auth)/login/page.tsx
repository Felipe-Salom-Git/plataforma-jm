'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password);
      }
      router.push('/'); // Redirect to main dashboard
    } catch (err: any) {
      console.error(err);
      let msg = "Ocurrió un error. Intenta nuevamente.";
      if (err.code === 'auth/invalid-credential') msg = "Credenciales inválidas.";
      if (err.code === 'auth/user-not-found') msg = "Usuario no encontrado.";
      if (err.code === 'auth/wrong-password') msg = "Contraseña incorrecta.";
      if (err.code === 'auth/email-already-in-use') msg = "El email ya está registrado.";
      if (err.code === 'auth/weak-password') msg = "La contraseña es muy débil (mínimo 6 caracteres).";

      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{isLogin ? "Iniciar Sesión" : "Crear Cuenta"}</CardTitle>
          <CardDescription>
            {isLogin ? "Ingresa a la Plataforma JM" : "Regístrate para comenzar"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nombre@ejemplo.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              {isLogin ? "Ingresar" : "Registrarse"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">
              {isLogin ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
            </span>
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? "Regístrate" : "Inicia Sesión"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
