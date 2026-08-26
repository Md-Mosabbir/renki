'use client';

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError, REPORT_REASON_LABELS } from '@/lib/api';
import type { ReportReason } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

/**
 * Reporting someone, inline.
 *
 * A panel rather than a modal because this app has no modals anywhere — the
 * cancel confirmation and the profile edit form both expand in place, and one
 * dialog would be the only one in the product.
 *
 * REPORTING AND BLOCKING ARE TWO ACTS. The server keeps them apart:
 * `POST /api/reports` never touches `friendships`. That means filing a report
 * does NOT stop the next match, which is why the success state below offers
 * blocking straight away. If that offer is ever removed, someone will report a
 * person and be matched with them the same evening.
 *
 * Blocking is offered, not assumed. A report is addressed to the university; a
 * block is addressed to the matcher. Most people want both and it is still two
 * decisions, so the student makes the second one themselves.
 */

const REASONS = Object.keys(REPORT_REASON_LABELS) as ReportReason[];

export interface ReportPanelProps {
  personId: string;
  personName: string;
  /** The ride it happened on, when there was one. */
  rideGroupId?: string | null;
  onClose: () => void;
}

export function ReportPanel({
  personId,
  personName,
  rideGroupId = null,
  onClose,
}: ReportPanelProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  /** Set once the report is filed. Switches the panel to the block offer. */
  const [filed, setFiled] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const firstName = personName.split(/\s+/)[0] ?? personName;

  // The server refuses 'other' with no words: every other reason names a
  // category and this one names nothing, so a moderator would have no report to
  // act on. Disabling the button says so before the request is made.
  const needsWords = reason === 'other' && description.trim() === '';

  if (filed) {
    return (
      <div className="border-border bg-muted/30 mt-4 space-y-4 border-l-2 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Reported</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Someone at the university will look at this. You will not hear back
            automatically.
          </p>
        </div>

        {blocked ? (
          <p className="text-sm font-medium">
            You will not be matched with {firstName} again.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm leading-relaxed">
              Reporting does not stop you being matched with {firstName} again. Blocking
              does, and it cannot be undone.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                className="rounded-full"
                onClick={() => {
                  setBusy(true);
                  api
                    .blockUser(personId)
                    .then(() => {
                      setBlocked(true);
                      toast.success(`${firstName} blocked`);
                    })
                    .catch((err: unknown) => {
                      toast.error(
                        err instanceof ApiError ? err.message : 'Could not block them'
                      );
                    })
                    .finally(() => {
                      setBusy(false);
                    });
                }}
              >
                Block {firstName}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="rounded-full"
              >
                No thanks
              </Button>
            </div>
          </div>
        )}

        {blocked && (
          <Button size="sm" variant="outline" onClick={onClose} className="rounded-full">
            Done
          </Button>
        )}
      </div>
    );
  }

  return (
    <form
      className="border-border bg-muted/30 mt-4 space-y-5 border-l-2 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (reason === null) return;

        setBusy(true);
        api
          .report({
            reportedUserId: personId,
            reason,
            description: description.trim() === '' ? null : description.trim(),
            rideGroupId,
          })
          .then(() => {
            setFiled(true);
          })
          .catch((err: unknown) => {
            // The server's message is more useful than anything invented here —
            // it names the duplicate, the bound, or the missing words.
            toast.error(
              err instanceof ApiError ? err.message : 'Could not file that report'
            );
          })
          .finally(() => {
            setBusy(false);
          });
      }}
    >
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-medium">Report {personName}</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            This goes to the university, not to {firstName}. They are not told.
          </p>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="sr-only">What happened?</legend>
        <RadioGroup
          value={reason ?? ''}
          onValueChange={(value) => {
            setReason(value as ReportReason);
          }}
          className="gap-2"
        >
          {REASONS.map((value) => (
            <div key={value} className="flex items-center gap-3">
              <RadioGroupItem value={value} id={`reason-${personId}-${value}`} />
              <Label
                htmlFor={`reason-${personId}-${value}`}
                className="cursor-pointer text-sm font-normal"
              >
                {REPORT_REASON_LABELS[value]}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor={`description-${personId}`} className="text-sm font-normal">
          What happened?{' '}
          <span className="text-muted-foreground">
            {reason === 'other' ? '(required)' : '(optional)'}
          </span>
        </Label>
        <textarea
          id={`description-${personId}`}
          value={description}
          maxLength={2000}
          rows={3}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
          className="border-input bg-background focus-visible:ring-ring w-full resize-y border p-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          variant="destructive"
          disabled={busy || reason === null || needsWords}
          className="rounded-full"
        >
          {busy ? 'Sending…' : 'Report'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="rounded-full"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
