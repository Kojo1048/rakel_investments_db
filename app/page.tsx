'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Lock, User, AlertCircle, Mail, UserPlus, ArrowLeft, CheckCircle, Phone, Check, X } from 'lucide-react';
import { PASSWORD_RULES } from '@/lib/validations/auth.schema';
import { PasswordInput } from '@/components/ui/password-input';
import type { Company } from '@/lib/types';

function PasswordStrength({ password }: { password: string }) {
  const rules = useMemo(() => [
    { label: `At least ${PASSWORD_RULES.minLength} characters`, pass: password.length >= PASSWORD_RULES.minLength },
    { label: 'Uppercase letter', pass: PASSWORD_RULES.hasUppercase.test(password) },
    { label: 'Lowercase letter', pass: PASSWORD_RULES.hasLowercase.test(password) },
    { label: 'Number', pass: PASSWORD_RULES.hasNumber.test(password) },
    { label: 'Special character', pass: PASSWORD_RULES.hasSpecial.test(password) },
  ], [password]);

  if (!password) return null;

  return (
    <ul className="mt-2 space-y-1">
      {rules.map(rule => (
        <li key={rule.label} className={`flex items-center gap-1.5 text-xs ${rule.pass ? 'text-green-500' : 'text-muted-foreground'}`}>
          {rule.pass ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {rule.label}
        </li>
      ))}
    </ul>
  );
}

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const redirected = useRef(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  // Registration fields
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCompanyId, setRegCompanyId] = useState('');
  const [regRole, setRegRole] = useState('');
  const [regReason, setRegReason] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  useEffect(() => {
    if (!isLoading && user && !redirected.current) {
      redirected.current = true;
      redirectUser(user.role);
    }
  }, [user, isLoading]);

  useEffect(() => {
    if (!isRegistering || companies.length > 0) return;
    setCompaniesLoading(true);
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch('/api/v1/companies/public', { signal: ctrl.signal })
      .then(res => res.ok ? res.json() : { companies: [] })
      .then(data => setCompanies(data.companies ?? []))
      .catch(() => setCompanies([]))         // network error or timeout → empty list
      .finally(() => { clearTimeout(timer); setCompaniesLoading(false); });
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, [isRegistering]);

  if (!mounted) return null;
  const redirectUser = (role: string) => {
    if (role === 'SUPER_ADMIN' || role === 'RAKEL_ADMIN') router.push('/admin');
    else if (role === 'CEO') router.push('/ceo');
    else if (role === 'COMPANY_ADMIN' || role === 'STAFF') router.push('/company');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    const success = await login(username, password);
    if (!success) {
      setError('Invalid username or password, or account is not active');
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!regUsername || !regPassword || !regConfirmPassword || !regEmail || !regFullName || !regRole) {
      setError('All required fields must be filled in');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Company is only required for Company Admin
    if (regRole === 'COMPANY_ADMIN' && !regCompanyId) {
      setError('Please select a company for Company Admin registration');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/v1/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername,
          password: regPassword,
          confirmPassword: regConfirmPassword,
          email: regEmail,
          fullName: regFullName,
          // companyId only sent for COMPANY_ADMIN
          ...(regRole === 'COMPANY_ADMIN' && regCompanyId ? { companyId: regCompanyId } : {}),
          requestedRole: regRole,
          reason: regPhone ? `${regReason}\nPhone: ${regPhone}`.trim() : regReason || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.issues) {
          const allErrors = Object.values(data.issues as Record<string, string[]>).flat();
          setError(allErrors[0] || 'Validation failed');
        } else {
          setError(data.error || 'Registration failed. Please try again.');
        }
        setIsSubmitting(false);
        return;
      }

      setRegistrationSuccess(true);
    } catch {
      setError('Network error. Please try again.');
    }

    setIsSubmitting(false);
  };

  const resetRegistrationForm = () => {
    setIsRegistering(false);
    setRegistrationSuccess(false);
    setRegUsername('');
    setRegPassword('');
    setRegConfirmPassword('');
    setRegEmail('');
    setRegFullName('');
    setRegPhone('');
    setRegCompanyId('');
    setRegRole('');
    setRegReason('');
    setError('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (registrationSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        <Card className="w-full max-w-md relative z-10 border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <CheckCircle className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">Registration Submitted</CardTitle>
            <CardDescription className="text-muted-foreground">
              Your account request has been submitted for approval. An administrator will review your request and notify you by email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={resetRegistrationForm} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />

      <Card className="w-full max-w-md relative z-10 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">Rakel Investments</CardTitle>
          <CardDescription className="text-muted-foreground">
            {isRegistering ? 'Register for Access' : 'Internal Database Management System'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isRegistering ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="regFullName">Full Name <span className="text-destructive">*</span></FieldLabel>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="regFullName" type="text" placeholder="Enter your full name" value={regFullName} onChange={(e) => setRegFullName(e.target.value)} className="pl-10 bg-input border-border" required />
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="regEmail">Email <span className="text-destructive">*</span></FieldLabel>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="regEmail" type="email" placeholder="Enter your email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className="pl-10 bg-input border-border" required />
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="regPhone">Phone Number</FieldLabel>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="regPhone" type="tel" placeholder="Enter your phone number (optional)" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} className="pl-10 bg-input border-border" />
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="regUsername">Username <span className="text-destructive">*</span></FieldLabel>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="regUsername" type="text" placeholder="Choose a username" value={regUsername} onChange={(e) => setRegUsername(e.target.value)} className="pl-10 bg-input border-border" required />
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="regPassword">Password <span className="text-destructive">*</span></FieldLabel>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <PasswordInput id="regPassword" placeholder="Choose a password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className="pl-10 bg-input border-border" required />
                  </div>
                  <PasswordStrength password={regPassword} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="regConfirmPassword">Confirm Password <span className="text-destructive">*</span></FieldLabel>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <PasswordInput id="regConfirmPassword" placeholder="Re-enter your password" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} className="pl-10 bg-input border-border" required />
                  </div>
                  {regConfirmPassword && regPassword !== regConfirmPassword && (
                    <p className="text-xs text-destructive mt-1">Passwords do not match</p>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="regRole">Requested Role <span className="text-destructive">*</span></FieldLabel>
                  <Select value={regRole} onValueChange={setRegRole}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="STAFF">Staff</SelectItem>
                      <SelectItem value="COMPANY_ADMIN">Company Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {/* Company selector — ONLY for Company Admin */}
                {regRole === 'COMPANY_ADMIN' && (
                  <Field>
                    <FieldLabel htmlFor="regCompany">Company <span className="text-destructive">*</span></FieldLabel>
                    {companiesLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <Spinner className="h-4 w-4" /> Loading companies...
                      </div>
                    ) : (
                      <Select value={regCompanyId} onValueChange={setRegCompanyId}>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue placeholder="Select your company" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {companies.map(company => (
                            <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="regReason">Reason for Access</FieldLabel>
                  <Textarea id="regReason" placeholder="Briefly describe why you need access..." value={regReason} onChange={(e) => setRegReason(e.target.value)} className="bg-input border-border min-h-[80px]" />
                </Field>
              </FieldGroup>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting ? <><Spinner className="mr-2 h-4 w-4" />Submitting...</> : 'Submit Registration'}
              </Button>

              <Button type="button" variant="ghost" className="w-full text-muted-foreground hover:text-foreground" onClick={resetRegistrationForm}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="username">Username</FieldLabel>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="username" type="text" placeholder="Enter your username" value={username} onChange={(e) => setUsername(e.target.value)} className="pl-10 bg-input border-border" required />
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <PasswordInput id="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-input border-border" required />
                    </div>
                  </Field>
                </FieldGroup>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
                  {isSubmitting ? <><Spinner className="mr-2 h-4 w-4" />Signing in...</> : 'Sign In'}
                </Button>
              </form>

              <div className="mt-4 pt-4 border-t border-border">
                <Button variant="outline" className="w-full border-border text-foreground hover:bg-muted" onClick={() => { setIsRegistering(true); setError(''); }}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Register
                </Button>
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground text-center">
                  This is an internal system. Unauthorized access is prohibited.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
