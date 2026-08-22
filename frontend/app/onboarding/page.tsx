'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError } from '@/lib/api';
import type { ProfileInput } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StepShell } from '@/components/onboarding/step-shell';
import { FaceScan } from '@/components/onboarding/face-scan';

/**
 * Onboarding.
 *
 * Four steps: who you are, your gender, a mocked face scan, and the result.
 *
 * The gender step and the verification step are deliberately separate even
 * though the mock infers one from the other. They answer different questions —
 * what the student declares, and whether Renki confirmed it — and the backend
 * tracks them in different columns (`users.gender` vs `trust_stage`). Collapsing
 * them here would make the real flow a rewrite rather than a swap.
 */

type Step = 'details' | 'gender' | 'scan' | 'result';

const TOTAL_STEPS = 4;
const STEP_INDEX: Record<Step, number> = {
  details: 1,
  gender: 2,
  scan: 3,
  result: 4,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('details');
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<'verified' | 'failed'>('verified');

  const [details, setDetails] = useState({
    name: '',
    dateOfBirth: '',
    phone: '',
    studentId: '',
  });
  const [gender, setGender] = useState<'male' | 'female' | null>(null);

  const handleScanComplete = useCallback(
    async (result: 'verified' | 'failed') => {
      setOutcome(result);

      if (result === 'verified' && gender) {
        const profile: ProfileInput = {
          ...details,
          university: 'North South University',
          gender,
        };
        try {
          await api.completeProfile(profile);
          await api.verifyIdentity('verified');
        } catch (err) {
          toast.error(
            err instanceof ApiError ? err.message : 'Could not save your details'
          );
        }
      }

      setStep('result');
    },
    [details, gender]
  );

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
            className="group h-14 w-full justify-between rounded-none text-base"
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

  if (step === 'gender') {
    return (
      <StepShell
        step={STEP_INDEX.gender}
        total={TOTAL_STEPS}
        title="Select your gender"
        subtitle="Renki only ever matches you with riders of the same gender. This cannot be changed after verification."
        onBack={() => setStep('details')}
        footer={
          <Button
            size="lg"
            disabled={gender === null}
            onClick={() => setStep('scan')}
            className="group h-14 w-full justify-between rounded-none text-base"
          >
            Continue
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
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

  if (step === 'scan') {
    return (
      <StepShell
        step={STEP_INDEX.scan}
        total={TOTAL_STEPS}
        title="Verify it's you"
        subtitle="We check your face against your student record. Nothing is shared with other riders."
      >
        <FaceScan outcome="verified" onComplete={handleScanComplete} />
      </StepShell>
    );
  }

  return (
    <StepShell
      step={STEP_INDEX.result}
      total={TOTAL_STEPS}
      title={outcome === 'verified' ? "You're verified" : 'We need a closer look'}
      subtitle={
        outcome === 'verified'
          ? 'You can now request rides. Your first ride must start from campus.'
          : 'This happens sometimes — poor lighting, an old photo. A person will review it, usually within a day.'
      }
    >
      {outcome === 'verified' ? (
        <div className="border-brand bg-brand-muted flex items-center gap-4 border-l-2 p-5">
          <div className="space-y-1">
            <p className="text-sm font-medium">Verified student</p>
            <p className="text-muted-foreground text-sm">North South University</p>
          </div>
        </div>
      ) : (
        <div className="border-border flex items-start gap-4 border-l-2 p-5">
          <ShieldAlert className="text-muted-foreground mt-0.5 size-5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Sent for review</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              You can still browse, but you won&rsquo;t be matched until this clears.
            </p>
          </div>
        </div>
      )}

      <div className="mt-8">
        <Button
          size="lg"
          disabled={pending}
          onClick={() => {
            setPending(true);
            router.push('/rides');
          }}
          className="group h-14 w-full justify-between rounded-none text-base"
        >
          {pending ? 'Opening…' : outcome === 'verified' ? 'Find a ride' : 'Continue'}
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          )}
        </Button>
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
        className="h-12 rounded-none border-0 border-b-2 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
        {...props}
      />
    </div>
  );
}
