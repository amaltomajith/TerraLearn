import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { UserPlus, ArrowRight } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import NavAuthControl from '@/components/saath/NavAuthControl';
import { useIdentity } from '@/lib/identity/identity';
import { redeemInvite } from '@/lib/farm/queries';
import { createFarmerProfileOnly } from '@/lib/saath/queries';

const LANGUAGES = [
  { code: 'kn', label: 'ಕನ್ನಡ Kannada' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी Hindi' },
  { code: 'ta', label: 'தமிழ் Tamil' },
  { code: 'te', label: 'తెలుగు Telugu' },
];

const field =
  'mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';

export default function JoinFarm() {
  const navigate = useNavigate();
  const { ownFarmer, refresh } = useIdentity();

  // Profile fields (only needed when ownFarmer doesn't exist yet)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [language, setLanguage] = useState('kn');

  // Invite code
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const needsProfile = !ownFarmer;

  async function handleJoin() {
    const trimCode = code.trim().toUpperCase();
    if (!trimCode) {
      toast.error('Enter your invite code.');
      return;
    }
    if (needsProfile) {
      if (!name.trim()) { toast.error('Your name is required.'); return; }
      if (!phone.trim()) { toast.error('A phone number is required.'); return; }
    }

    setBusy(true);
    try {
      if (needsProfile) {
        await createFarmerProfileOnly({
          name: name.trim(),
          phone: phone.trim(),
          village: village.trim() || null,
          language,
        });
      }
      await redeemInvite(trimCode);
      toast.success("You've joined the farm!");
      await refresh();
      navigate('/', { replace: true });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation authSlot={<NavAuthControl />} />

      <div className="flex items-center justify-center min-h-screen px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm bg-card rounded-2xl border border-border/60 p-8 shadow-lg"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Join a farm</h1>
              <p className="text-xs text-muted-foreground">Enter the invite code your manager shared</p>
            </div>
          </div>

          <div className="space-y-4">
            {needsProfile && (
              <>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Your name *
                  <input
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={field}
                  />
                </label>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Phone *
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={field}
                  />
                </label>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Village
                  <input
                    placeholder="Village name"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    className={field}
                  />
                </label>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Language
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className={field}
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                </label>
                <hr className="border-border/40" />
              </>
            )}

            <label className="block text-xs font-semibold text-muted-foreground">
              Invite code *
              <input
                placeholder="e.g. AB12CD"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                className={`${field} font-mono text-base tracking-widest uppercase`}
              />
            </label>

            <button
              onClick={handleJoin}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {busy ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  Join farm
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
