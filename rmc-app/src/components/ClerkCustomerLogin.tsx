import { useState } from 'react';
import { useLocation } from 'wouter';
import { useSignIn, useSignUp, useAuth as useClerkAuth, useClerk } from '@clerk/clerk-react';
import { Phone, Building2, Lock, MessageCircle, ArrowLeft } from 'lucide-react';
import { api, ApiError, type User } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { inputStyle } from '@/components/loginStyles';
import { ErrorBox, SubmitButton } from '@/components/loginUi';

/**
 * Customer phone sign-in powered by Clerk (replaces the Twilio WhatsApp OTP
 * flow). Clerk sends an SMS one-time code to the number and verifies it in the
 * browser; we then exchange the resulting Clerk session for the app's own JWT
 * via POST /api/auth/clerk/customer, which maps the verified phone to a 'client'
 * account (creating one on first sign-in). Rendered only when Clerk is
 * configured — otherwise the login screen falls back to the legacy OTP form.
 *
 * A brand-new number has no Clerk identity yet, so we try a sign-IN first and,
 * when the number is unknown, transparently fall back to a sign-UP. Either way
 * the same SMS-code UX is presented.
 */

// Normalize loosely-typed input to E.164 for Clerk, defaulting a bare 10-digit
// number to India (+91) to mirror the server's normalizePhone.
function toE164(input: string): string | null {
  const s = input.trim().replace(/[\s\-()]/g, '');
  if (!s) return null;
  if (s.startsWith('+')) {
    const digits = s.slice(1).replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

type ClerkApiError = { errors?: Array<{ code?: string; longMessage?: string; message?: string }> };

function clerkErrorMessage(err: unknown, fallback: string): string {
  const e = err as ClerkApiError;
  if (e && Array.isArray(e.errors) && e.errors.length > 0) {
    return e.errors[0]?.longMessage || e.errors[0]?.message || fallback;
  }
  if (err instanceof ApiError || err instanceof Error) return err.message;
  return fallback;
}

function isIdentifierNotFound(err: unknown): boolean {
  const e = err as ClerkApiError;
  return Array.isArray(e?.errors) && e.errors.some((x) => x.code === 'form_identifier_not_found');
}

export default function ClerkCustomerLogin({ onError }: { onError?: (msg: string) => void }) {
  const { isLoaded: signInLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();
  const { getToken } = useClerkAuth();
  const { signOut } = useClerk();
  const { updateUser } = useAuth();
  const [, navigate] = useLocation();

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [flow, setFlow] = useState<'signIn' | 'signUp'>('signIn');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function fail(msg: string) {
    setError(msg);
    onError?.(msg);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!signInLoaded || !signUpLoaded) {
      fail('Sign-in is still loading. Please try again in a moment.');
      return;
    }
    const e164 = toE164(phone);
    if (!e164) {
      fail('Please enter a valid mobile number.');
      return;
    }
    setLoading(true);
    try {
      try {
        // Existing customer: start a sign-in and send the SMS code.
        const res = await signIn.create({ identifier: e164 });
        const factor = res.supportedFirstFactors?.find((f) => f.strategy === 'phone_code');
        if (!factor || !('phoneNumberId' in factor)) {
          throw new Error('Phone sign-in is not enabled. Please contact support.');
        }
        await signIn.prepareFirstFactor({ strategy: 'phone_code', phoneNumberId: factor.phoneNumberId });
        setFlow('signIn');
      } catch (err) {
        // Unknown number → first-time customer: create the Clerk identity and
        // send the SMS code via the sign-up flow instead.
        if (isIdentifierNotFound(err)) {
          await signUp.create({ phoneNumber: e164 });
          await signUp.preparePhoneNumberVerification({ strategy: 'phone_code' });
          setFlow('signUp');
        } else {
          throw err;
        }
      }
      setStep('code');
    } catch (err) {
      fail(clerkErrorMessage(err, 'Could not send the code. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!signInLoaded || !signUpLoaded) return;
    setLoading(true);
    try {
      let createdSessionId: string | null = null;
      if (flow === 'signIn') {
        const res = await signIn.attemptFirstFactor({ strategy: 'phone_code', code });
        if (res.status !== 'complete') throw new Error('That code is incorrect or has expired.');
        createdSessionId = res.createdSessionId;
      } else {
        const res = await signUp.attemptPhoneNumberVerification({ code });
        if (res.status !== 'complete') throw new Error('That code is incorrect or has expired.');
        createdSessionId = res.createdSessionId;
      }
      if (!createdSessionId) throw new Error('Could not complete sign-in. Please try again.');
      await setActive({ session: createdSessionId });

      const clerkToken = await getToken();
      if (!clerkToken) throw new Error('Could not retrieve your sign-in session.');
      const data = await api.post<{ token: string; user: User }>(
        '/auth/clerk/customer', { token: clerkToken, name: name || undefined },
      );
      updateUser(data.user, data.token);
      navigate('/');
    } catch (err) {
      // Drop the Clerk session so a retry starts clean and the user isn't left
      // half-authenticated if the server-side exchange rejected them.
      try { await signOut(); } catch { /* ignore */ }
      fail(clerkErrorMessage(err, 'Verification failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep('phone');
    setFlow('signIn');
    setCode('');
    setError('');
  }

  return (
    <>
      <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>Sign in with your phone</h2>
      <p style={{ margin: '0 0 28px', color: 'var(--muted)', fontSize: 13 }}>
        {step === 'phone'
          ? 'We\u2019ll text a one-time code to your mobile number.'
          : `Enter the code sent to ${phone || 'your number'}.`}
      </p>

      {step === 'phone' ? (
        <form onSubmit={handleSend}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
              Mobile Number
            </label>
            <div style={{ position: 'relative' }}>
              <Phone size={15} style={{ color: 'var(--muted)', position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="98765 43210" required autoFocus
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
              Your Name <span style={{ fontWeight: 500, textTransform: 'none' }}>(new customers only)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Building2 size={15} style={{ color: 'var(--muted)', position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Optional"
                style={inputStyle}
              />
            </div>
          </div>

          {error && <ErrorBox message={error} />}

          {/* Clerk bot-protection widget mount point (smart/invisible CAPTCHA). */}
          <div id="clerk-captcha" />

          <SubmitButton loading={loading} label={loading ? 'Sending code…' : 'Send code via SMS'} icon={<MessageCircle size={16} />} />
        </form>
      ) : (
        <form onSubmit={handleVerify}>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
              Verification Code
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ color: 'var(--muted)', position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text" inputMode="numeric" value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456" required autoFocus
                style={{ ...inputStyle, letterSpacing: 4, fontFamily: 'monospace' }}
              />
            </div>
          </div>

          {error && <ErrorBox message={error} />}

          <SubmitButton loading={loading} label={loading ? 'Verifying…' : 'Verify & continue →'} />

          <button type="button" onClick={reset} style={{
            marginTop: 14, display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: 'var(--muted)', fontSize: 13, fontWeight: 600,
          }}>
            <ArrowLeft size={14} /> Use a different number
          </button>
        </form>
      )}
    </>
  );
}
