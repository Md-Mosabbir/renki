'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck, UserRoundSearch } from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError, REPORT_REASON_LABELS, REPORT_STATUS_LABELS } from '@/lib/api';
import type { AdminReport, ReportStatus, ReviewAction } from '@/lib/api';
import { AppShell, Page } from '@/components/app-shell';
import { SkeletonList } from '@/components/motion/skeleton';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/brand/wordmark';

/**
 * The moderation queue.
 *
 * Moderators only. `GET /api/admin/reports` answers 404 rather than 403 for
 * everyone else — to a student who is not a moderator this surface does not
 * exist — so this page shows a plain "not found" on failure rather than
 * announcing that a queue exists and they are not allowed in.
 *
 * OLDEST FIRST, unlike every other list in the app. A queue is worked from the
 * bottom: newest-first would mean the report nobody has looked at in a week
 * sinks further every time a new one arrives.
 *
 * Nothing on this page suspends an account, and there is deliberately no button
 * that would. "Three reports and you are out" is a griefing vector — three
 * friends coordinating could kill an account. A human reads and decides; the
 * product's only automatic consequence is none.
 *
 * The one action with teeth is "Ask them to confirm", on a gender_mismatch
 * report. It blocks the reported student from riding until they send a photo,
 * so it is a deliberate second decision rather than something a report does by
 * itself — otherwise filing a report would be a way to compel somebody to
 * photograph themselves, which is a harassment tool wearing a safety badge.
 */

const FILTERS: { value: ReportStatus | ''; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'Being looked at' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: '', label: 'All' },
];

export default function AdminReportsPage() {
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [filter, setFilter] = useState<ReportStatus | ''>('open');
  const [denied, setDenied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback((status: ReportStatus | '') => {
    api
      .adminReports(status === '' ? undefined : status)
      .then((page) => {
        setReports(page.reports);
        setDenied(false);
      })
      .catch((err: unknown) => {
        // A 404 here means "you are not a moderator" OR "no such route". Both
        // read the same on purpose, so this says the same thing either way.
        if (err instanceof ApiError && err.status === 404) {
          setDenied(true);
          setReports([]);
          return;
        }
        toast.error(err instanceof ApiError ? err.message : 'Could not load reports');
      });
  }, []);

  useEffect(() => {
    load(filter);
  }, [load, filter]);

  const review = useCallback(
    (id: string, status: ReviewAction) => {
      setBusyId(id);
      api
        .reviewReport(id, status)
        .then(() => {
          toast.success(`Marked ${REPORT_STATUS_LABELS[status].toLowerCase()}`);
          load(filter);
        })
        .catch((err: unknown) => {
          toast.error(err instanceof ApiError ? err.message : 'Could not update it');
        })
        .finally(() => {
          setBusyId(null);
        });
    },
    [load, filter]
  );

  const challenge = useCallback(
    (report: AdminReport) => {
      setBusyId(report.id);
      api
        .issueChallenge(report.reportedUserId, report.id)
        .then(() => {
          toast.success(`${report.reportedUserName} has been asked to confirm`);
          // Into 'being looked at', not 'resolved': the question is now open and
          // the report stays live until the challenge is decided.
          return api.reviewReport(report.id, 'under_review');
        })
        .then(() => {
          load(filter);
        })
        .catch((err: unknown) => {
          toast.error(err instanceof ApiError ? err.message : 'Could not ask them');
        })
        .finally(() => {
          setBusyId(null);
        });
    },
    [load, filter]
  );

  if (denied) {
    return (
      <AppShell>
        <Page>
          <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            There is nothing at this address.
          </p>
        </Page>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Page>
        <header className="mb-10 md:hidden">
          <Wordmark />
        </header>

        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
              <ShieldCheck className="size-5 shrink-0" strokeWidth={2} aria-hidden />
              Reports
            </h1>
            <p className="text-muted-foreground text-sm">
              Oldest first — that is the order a queue is worked in.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setFilter(option.value);
                }}
                className={`cursor-pointer border px-3 py-1.5 text-xs tracking-wide uppercase ${
                  filter === option.value
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {reports === null && <SkeletonList rows={3} />}

          {reports !== null && reports.length === 0 && (
            <div className="border-border bg-muted/30 border-l-2 p-6">
              <p className="text-sm font-medium">Nothing here</p>
              <p className="text-muted-foreground mt-1 text-sm">
                No reports with that status.
              </p>
            </div>
          )}

          {reports !== null && reports.length > 0 && (
            <ul className="border-border space-y-px border-t border-b">
              {reports.map((report) => (
                <li key={report.id}>
                  <ReportRow
                    report={report}
                    busy={busyId === report.id}
                    onReview={review}
                    onChallenge={challenge}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Page>
    </AppShell>
  );
}

function ReportRow({
  report,
  busy,
  onReview,
  onChallenge,
}: {
  report: AdminReport;
  busy: boolean;
  onReview: (id: string, status: ReviewAction) => void;
  onChallenge: (report: AdminReport) => void;
}) {
  const closed = report.status === 'resolved' || report.status === 'dismissed';
  const canChallenge = report.reason === 'gender_mismatch' && !closed;

  return (
    <article className={`space-y-3 py-5 ${closed ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-medium">
          {REPORT_REASON_LABELS[report.reason] ?? report.reason}
        </p>
        <p className="text-muted-foreground text-xs tracking-widest uppercase">
          {REPORT_STATUS_LABELS[report.status] ?? report.status}
        </p>
      </div>

      <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        <span>{report.reporterName}</span>
        <ArrowRight className="size-3 shrink-0" strokeWidth={2} aria-hidden />
        <span className="text-foreground font-medium">{report.reportedUserName}</span>
        <span>·</span>
        <span>
          {new Date(report.createdAt).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      </p>

      {report.description !== null && (
        <p className="border-border border-l-2 pl-3 text-sm leading-relaxed">
          {report.description}
        </p>
      )}

      {/* Every target is reachable from every other, deliberately: a moderator
          who resolves something and then realises they were wrong must be able
          to reopen it. 'open' is not offered — reopening is 'being looked at',
          which records who did it. */}
      {canChallenge && (
        <div className="border-brand bg-brand-muted space-y-2 border-l-2 p-4">
          <p className="text-sm font-medium">Ask them to confirm?</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {report.reportedUserName} will be blocked from booking rides until they send
            one photo, which only you will see and which is deleted the moment you decide.
            Do not do this on a report you would otherwise dismiss — being asked is itself
            a cost.
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            <strong className="text-foreground font-medium">
              Presenting differently from a declared gender is not fraud.
            </strong>{' '}
            A trans or gender-nonconforming student may not look the way a reporter
            expected, and that is not what this is for. The only question is whether
            someone declared a gender they knew was false to be matched with people who
            had chosen not to ride with them.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              onChallenge(report);
            }}
            className="cursor-pointer rounded-none"
          >
            <UserRoundSearch className="size-4" />
            Ask them to confirm
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {report.status !== 'under_review' && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              onReview(report.id, 'under_review');
            }}
            className="rounded-none"
          >
            Look into it
          </Button>
        )}
        {report.status !== 'resolved' && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => {
              onReview(report.id, 'resolved');
            }}
            className="rounded-none"
          >
            Resolve
          </Button>
        )}
        {report.status !== 'dismissed' && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              onReview(report.id, 'dismissed');
            }}
            className="rounded-none"
          >
            Dismiss
          </Button>
        )}
      </div>
    </article>
  );
}
