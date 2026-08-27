const { StepShell, Button, Input, Label, RadioGroup } = window.RenkiDesignSystem_4a6e65;

/**
 * Onboarding: two steps. Who you are, then how you want to be matched. Then
 * you are in — no success screen, because the account is not verified yet and
 * "you're all set" would be a lie.
 */
function Onboarding({ onDone }) {
  const [step, setStep] = React.useState(1);
  const [form, setForm] = React.useState({ name: '', dob: '', phone: '', studentId: '' });
  const [gender, setGender] = React.useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const complete = Object.values(form).every((v) => v.trim() !== '');

  if (step === 1) {
    return (
      <StepShell step={1} total={2} title="Tell us who you are" subtitle="This has to match your student ID. You can change it later."
        footer={<Button size="xl" square block disabled={!complete} onClick={() => setStep(2)} style={{ justifyContent: 'space-between' }}>Continue <i data-lucide="arrow-right" style={{ width: 16, height: 16 }} /></Button>}>
        <div style={{ display: 'grid', gap: 20 }}>
          {[['name', 'Full name', 'Sadia Rahman'], ['dob', 'Date of birth', '2003-04-11'], ['phone', 'Phone', '01712 345 678'], ['studentId', 'Student ID', '2021-1-60-104']].map(([k, label, ph]) => (
            <div key={k} style={{ display: 'grid', gap: 6 }}>
              <Label htmlFor={k}>{label}</Label>
              <Input id={k} size="lg" placeholder={ph} value={form[k]} onChange={set(k)} />
            </div>
          ))}
        </div>
      </StepShell>
    );
  }

  return (
    <StepShell step={2} total={2} title="Who should we match you with?" subtitle="You can change this any time from your profile." onBack={() => setStep(1)}
      footer={<Button size="xl" square block disabled={!gender} onClick={onDone} style={{ justifyContent: 'space-between' }}>Finish <i data-lucide="arrow-right" style={{ width: 16, height: 16 }} /></Button>}>
      <RadioGroup value={gender} onChange={setGender} options={[
        { value: 'female', label: 'I am female', description: 'By default you are matched with female riders only.' },
        { value: 'male', label: 'I am male', description: 'By default you are matched with male riders only.' },
      ]} />
      <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 'var(--leading-relaxed)' }}>
        Changing this later means confirming it again, so it is locked to your student record rather than typed.
      </p>
    </StepShell>
  );
}

Object.assign(window, { Onboarding });
