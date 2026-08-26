'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError } from '@/lib/api';
import type { ProfileInput } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { HexSpinner } from '@/components/motion/hex';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StepShell } from '@/components/onboarding/step-shell';

/**
 * Onboarding.
 *
 * Two steps: who you are, and your gender. Then you are in.
 *
 * Verification is deliberately NOT here. It used to be a third step running a
 * mocked scan that always passed, which made every account verified on signup
 * and left the unverified state — the one most of the app branches on — with no
 * way to reach it. Now signing up gets you an account, and verifying is a
 * separate act you take from the dashboard when you are ready.
 *
 * That also matches the columns: `users.profile_completed_at` is what this
 * screen writes, and `users.trust_stage` is what verification writes. Two
 * questions, two columns, two moments.
 */

type Step = 'details' | 'gender';

const TOTAL_STEPS = 2;
const STEP_INDEX: Record<Step, number> = {
  details: 1,
  gender: 2,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('details');
  const [pending, setPending] = useState(false);

  const [details, setDetails] = useState({
    name: '',
    dateOfBirth: '',
    phone: '',
    studentId: '',
  });
  const [gender, setGender] = useState<'male' | 'female' | null>(null);

  const submit = useCallback(async () => {
    if (!gender) return;

    setPending(true);
    const profile: ProfileInput = {
      ...details,
      university: 'North South University',
      gender,
    };

    try {
      await api.completeProfile(profile);
      // Straight to the dashboard, not to a success screen. The account is not
      // verified yet, so a page saying "you're all set" would be a lie — the
      // dashboard's own unverified banner is the honest version of that message.
      router.push('/rides');
    } catch (err) {
      // Stay on the form. Bouncing to a result screen on a 409 (duplicate phone
      // or student ID) would strand the student with no field to correct.
      toast.error(err instanceof ApiError ? err.message : 'Could not save your details');
      setPending(false);
    }
  }, [details, gender, router]);

  if (step === 'details') {
    const complete =
      details.name.trim() !== '' &&
      details.dateOfBirth !== '' &&
      details.phone.trim() !== '' &&
      details.studentId.trim() !== '';

    return (
      <StepShell
        step={STEP_INDEX.details}
        total={TOTAL_STEPS}
        title="Tell us who you are"
        subtitle="This has to match your student ID. You can change it later."
        footer={
          <Button
            size="lg"
            disabled={!complete}
            onClick={() => setStep('gender')}
            className="group h-14 w-full justify-between rounded-full text-base"
          >
            Continue
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Button>
        }
      >
        <div className="space-y-6">
          <Field
            id="name"
            label="Full name"
            value={details.name}
            onChange={(v) => setDetails((d) => ({ ...d, name: v }))}
            autoComplete="name"
            placeholder="Nusrat Jahan"
          />
          <Field
            id="studentId"
            label="Student ID"
            value={details.studentId}
            onChange={(v) => setDetails((d) => ({ ...d, studentId: v }))}
            inputMode="numeric"
            placeholder="2211545642"
          />
          <Field
            id="phone"
            label="Phone"
            value={details.phone}
            onChange={(v) => setDetails((d) => ({ ...d, phone: v }))}
            inputMode="tel"
            autoComplete="tel"
            placeholder="01712345678"
          />
          <Field
            id="dateOfBirth"
            label="Date of birth"
            type="date"
            value={details.dateOfBirth}
            onChange={(v) => setDetails((d) => ({ ...d, dateOfBirth: v }))}
          />
        </div>
      </StepShell>
    );
  }

  // The last step, so no condition: `details` returned above.
  return (
    <StepShell
      step={STEP_INDEX.gender}
      total={TOTAL_STEPS}
      title="Select your gender"
      subtitle="Checked against your student ID, so it cannot be changed later. By default you are matched only with riders of the same gender — you can change that in your profile any time."
      onBack={() => setStep('details')}
      footer={
        <Button
          size="lg"
          disabled={gender === null || pending}
          onClick={() => void submit()}
          className="group h-14 w-full justify-between rounded-full text-base"
        >
          {pending ? 'Setting up…' : 'Finish'}
          {pending ? (
            <HexSpinner className="size-4" />
          ) : (
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          )}
        </Button>
      }
    >
      {/* Two large targets rather than a radio list: this is the single most
            consequential answer in the flow and it is tapped one-handed. */}
      <div className="grid grid-cols-2 gap-3">
        {(['female', 'male'] as const).map((value) => {
          const selected = gender === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setGender(value)}
              aria-pressed={selected}
              className={`flex aspect-square flex-col items-center justify-center gap-3 border-2 transition-all ${
                selected
                  ? 'border-brand bg-brand-muted'
                  : 'border-border hover:border-foreground/30'
              }`}
            >
              <span
                className={`size-3 transition-colors ${
                  selected ? 'bg-brand' : 'bg-muted-foreground/30'
                }`}
              />
              <span className="text-lg font-medium capitalize">{value}</span>
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  ...props
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.ComponentProps<typeof Input>, 'onChange' | 'value' | 'id'>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-medium tracking-widest uppercase">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 rounded-full border-0 border-b-2 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
        {...props}
      />
    </div>
  );
}
