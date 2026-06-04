'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { createUserWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthBackground } from '@/components/shared/AuthBackground';
import type { Language } from '@/types';

export default function RegisterPage({ params }: { params: { locale: string } }) {
  const t = useTranslations();
  const router = useRouter();
  const locale = params.locale as Language;

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    school: '',
    grade: '',
    subject: '',
    gameCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function saveUserProfile(uid: string, email: string, name: string) {
    await setDoc(doc(db, 'users', uid), {
      uid,
      email,
      displayName: name,
      role: 'student',
      school: form.school,
      grade: form.grade,
      subject: form.subject,
      language: locale,
      createdAt: new Date(),
    });
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await updateProfile(cred.user, { displayName: form.name });
      await saveUserProfile(cred.user.uid, form.email, form.name);
      router.push(`/${locale}/onboarding`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('email-already-in-use')) {
        setError('Este correo ya está registrado.');
      } else if (msg.includes('weak-password')) {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else {
        setError(t('errors.auth_failed'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleRegister() {
    setError('');
    setGoogleLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const { user } = cred;
      // Only create profile if it's a new user
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email ?? '',
        displayName: user.displayName ?? '',
        photoURL: user.photoURL ?? '',
        role: 'student',
        school: form.school || '',
        grade: form.grade || '',
        subject: form.subject || '',
        language: locale,
        createdAt: new Date(),
      }, { merge: true });
      router.push(`/${locale}/onboarding`);
    } catch {
      setError(t('errors.auth_failed'));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <AuthBackground>
      <div className="w-full animate-slide-up">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🏢</div>
          <h1 className="text-3xl font-bold gradient-text">EduFin</h1>
          <p className="text-white/50 mt-1 text-sm">{t('auth.register_subtitle')}</p>
        </div>

        <div className="glass-card rounded-3xl p-8">
          <h2 className="text-xl font-bold text-white mb-5">{t('auth.create_account')}</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="flex flex-col gap-3">
            <Input label={t('auth.name')} value={form.name} onChange={e => update('name', e.target.value)} placeholder="Juan Pérez" required />
            <Input label={t('auth.email')} type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="juan@email.com" required />
            <Input label={t('auth.password')} type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="••••••••" required />

            <div className="grid grid-cols-2 gap-3">
              <Input label={t('auth.school')} value={form.school} onChange={e => update('school', e.target.value)} placeholder="Colegio San Juan" required />
              <Input label={t('auth.grade')} value={form.grade} onChange={e => update('grade', e.target.value)} placeholder="5to año" required />
            </div>
            <Input label={t('auth.subject')} value={form.subject} onChange={e => update('subject', e.target.value)} placeholder="Economía" required />
            <Input label={`${t('auth.game_code')} (${t('common.optional')})`} value={form.gameCode} onChange={e => update('gameCode', e.target.value.toUpperCase())} placeholder="ABC123" maxLength={6} className="tracking-widest font-mono" />

            <Button type="submit" variant="gradient" size="lg" loading={loading} className="w-full mt-2">
              {t('auth.register')}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs text-white/40 uppercase tracking-wider">
              <span className="bg-transparent px-3">{t('common.or')}</span>
            </div>
          </div>

          <Button type="button" variant="secondary" size="lg" className="w-full" loading={googleLoading} onClick={handleGoogleRegister}>
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {t('auth.google')}
          </Button>

          <p className="text-center text-sm text-white/50 mt-5">
            {t('auth.already_account')}{' '}
            <Link href={`/${locale}/login`} className="text-violet-400 hover:text-violet-300 font-medium">
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </div>
    </AuthBackground>
  );
}
