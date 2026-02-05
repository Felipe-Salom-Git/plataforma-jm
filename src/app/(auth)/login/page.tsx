'use client';

import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      router.push('/presupuestos'); // Redirect to dashboard
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-sm rounded-lg border p-6 shadow-md">
            <h1 className="mb-4 text-2xl font-bold">Iniciar Sesión</h1>
            {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
            
            <Button onClick={handleGoogleLogin} className="w-full">
                Acceder con Google
            </Button>
        </div>
    </div>
  );
}
