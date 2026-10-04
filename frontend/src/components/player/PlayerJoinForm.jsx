import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { apiRequest } from '../../utils/api';

const PHONE_RE = /^\+?[0-9][0-9\s-]{5,19}$/;

const FIELD_FOR_ERROR = {
  INVALID_PIN: 'pin',
  ROOM_NOT_FOUND: 'pin',
  ROOM_CLOSED: 'pin',
  ROOM_FULL: 'pin',
  LATE_JOIN_DISABLED: 'pin',
  INVALID_TEAMNAME: 'teamName',
  TEAM_NAME_TAKEN: 'teamName',
  INVALID_INSTITUTION: 'institution',
  INVALID_CAPTAINNAME: 'captainName',
  INVALID_PHONE: 'contactPhone',
};

function validate(form) {
  const errors = {};
  if (!/^\d{6}$/.test(form.pin)) errors.pin = 'Enter the 6-digit PIN shown on stage.';
  if (form.teamName.trim().length < 2 || form.teamName.trim().length > 40) errors.teamName = 'Team name must be 2–40 characters.';
  if (form.institution.trim().length < 2) errors.institution = 'Enter your institution or college.';
  if (form.captainName.trim().length < 2) errors.captainName = 'Enter the team captain’s name.';
  if (!PHONE_RE.test(form.contactPhone.trim())) errors.contactPhone = 'Enter a valid mobile number.';
  return errors;
}

/** Room lookup as the PIN is typed (or pre-filled from the QR code). */
function useRoomLookup(pin) {
  const [lookup, setLookup] = useState({ status: 'idle', room: null });
  useEffect(() => {
    if (!/^\d{6}$/.test(pin)) {
      setLookup({ status: 'idle', room: null });
      return undefined;
    }
    let cancelled = false;
    setLookup({ status: 'loading', room: null });
    const id = setTimeout(async () => {
      try {
        const res = await apiRequest(`/rooms/${pin}`);
        if (!cancelled) setLookup({ status: 'found', room: res.data });
      } catch {
        if (!cancelled) setLookup({ status: 'missing', room: null });
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [pin]);
  return lookup;
}

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-300 mb-1">{label}</span>
      {children}
      {error && (
        <span className="mt-1 flex items-center gap-1 text-[11px] text-red-400 font-medium">
          <AlertCircle className="w-3 h-3 shrink-0" /> {error}
        </span>
      )}
    </label>
  );
}

const inputClass = (hasError) =>
  `w-full px-4 py-3 bg-arena-dark border rounded-xl text-white text-base focus:outline-none transition ${
    hasError ? 'border-red-500/70 focus:border-red-400' : 'border-arena-border focus:border-arena-gold'
  }`;

export default function PlayerJoinForm({ initialPin, onJoin, joining, joinError, connected }) {
  const [form, setForm] = useState({
    pin: initialPin || '',
    teamName: '',
    institution: '',
    captainName: '',
    contactPhone: '',
  });
  const [errors, setErrors] = useState({});
  const lookup = useRoomLookup(form.pin);

  // Map server-side errors onto the field that caused them
  useEffect(() => {
    if (!joinError) return;
    const field = FIELD_FOR_ERROR[joinError.code];
    if (field) setErrors(prev => ({ ...prev, [field]: joinError.message }));
  }, [joinError]);

  const set = (key) => (e) => {
    const value = key === 'pin' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value;
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const found = validate(form);
    if (lookup.status === 'missing') found.pin = 'No live room with this PIN.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onJoin({
      pin: form.pin,
      teamName: form.teamName.trim(),
      institution: form.institution.trim(),
      captainName: form.captainName.trim(),
      contactPhone: form.contactPhone.trim(),
    });
  };

  const generalError = joinError && !FIELD_FOR_ERROR[joinError.code] ? joinError.message : null;

  return (
    <div className="glass-panel rounded-3xl p-6 shadow-2xl animate-fadeIn">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-yellow-500 to-amber-300 mx-auto flex items-center justify-center font-black text-slate-950 text-xl mb-3 shadow-lg shadow-yellow-500/20 font-heading">
          LA
        </div>
        <h2 className="text-2xl font-black text-white font-heading">Enter the Arena</h2>
        <p className="text-xs text-slate-400 mt-1">Register your team to compete live</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="6-Digit Room PIN" error={errors.pin}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="784920"
            value={form.pin}
            onChange={set('pin')}
            className={`${inputClass(errors.pin)} text-arena-gold font-heading font-black text-2xl text-center tracking-[0.4em]`}
          />
          <div className="mt-1.5 min-h-[18px] text-[11px] font-semibold text-center">
            {lookup.status === 'loading' && (
              <span className="text-slate-400 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Finding room…</span>
            )}
            {lookup.status === 'found' && (
              <span className="text-emerald-400 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {lookup.room.quizTitle} · {lookup.room.participantCount} teams in
              </span>
            )}
            {lookup.status === 'missing' && <span className="text-red-400">No live room with this PIN</span>}
          </div>
        </Field>

        <Field label="Official Team Name" error={errors.teamName}>
          <input type="text" autoComplete="organization-title" maxLength={40} placeholder="e.g. BUFT Falcons" value={form.teamName} onChange={set('teamName')} className={inputClass(errors.teamName)} />
        </Field>

        <Field label="Institution / College" error={errors.institution}>
          <input type="text" autoComplete="organization" maxLength={80} placeholder="e.g. BUFT CSE" value={form.institution} onChange={set('institution')} className={inputClass(errors.institution)} />
        </Field>

        <Field label="Team Captain Name" error={errors.captainName}>
          <input type="text" autoComplete="name" maxLength={60} placeholder="e.g. Sheikh Sakib" value={form.captainName} onChange={set('captainName')} className={inputClass(errors.captainName)} />
        </Field>

        <Field label="Captain Mobile Number" error={errors.contactPhone}>
          <input type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="+8801XXXXXXXXX" value={form.contactPhone} onChange={set('contactPhone')} className={inputClass(errors.contactPhone)} />
        </Field>

        {generalError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/40 text-xs text-red-300 font-medium animate-shake">
            {generalError}
          </div>
        )}

        <button
          type="submit"
          disabled={joining || !connected}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-400 text-slate-950 font-black text-base shadow-lg shadow-yellow-500/20 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-60 font-heading"
        >
          {joining ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Joining…</>
          ) : !connected ? (
            'Connecting to server…'
          ) : (
            <>Join Live Lobby <ArrowRight className="w-5 h-5" /></>
          )}
        </button>
      </form>
    </div>
  );
}
