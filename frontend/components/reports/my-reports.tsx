'use client';

import { useEffect, useState } from 'react';

import { api, ApiError, REPORT_REASON_LABELS, REPORT_STATUS_LABELS } from '@/lib/api';
import type { Report } from '@/lib/api';

/**
 * The reports I have filed.
 *
 * Without this a report is a thing that happens once and then vanishes: the
 * panel says "Reported" and on the next visit there is no trace of it. Knowing
 * a report is still open — or has been looked at — is the only feedback the
 * product gives, since nobody is notified of an outcome.
 *
 * Reports ABOUT me are deliberately not here and have no endpoint at all. The
 * queue is not a channel between the two parties, and telling someone they have
 * been reported is how a report becomes a reprisal.
 *
 * Renders nothing at all when there are none, rather than an empty state. Most
 * students will never file one, and "You have not reported anyone" is a strange
 * thing to put on a profile.
 */
export function MyReports() {
  const [reports, setReports] = useState<Report[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    api
      .myReports()
      .then((rows) => {
        if (!cancelled) setReports(rows);
      })
      .catch((err: unknown) => {
        // Silent. This is a secondary section on a page whose primary job is
        // the profile itself, and a red banner here would suggest the profile
        // failed to load.
        if (!cancelled) {
          setReports([]);
          if (!(err instanceof ApiError)) return;
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (reports === null || reports.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-widest uppercase">Your reports</h2>
      <ul className="border-border divide-border divide-y border">
        {reports.map((report) => (
          <li key={report.id} className="flex items-baseline justify-between gap-4 p-4">
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-sm font-medium">
                {REPORT_REASON_LABELS[report.reason] ?? report.reason}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {report.reportedUserName} ·{' '}
                {new Date(report.createdAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <p className="text-muted-foreground shrink-0 text-xs tracking-widest uppercase">
              {REPORT_STATUS_LABELS[report.status] ?? report.status}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Only you can see these. The person you reported is not told.
      </p>
    </section>
  );
}
