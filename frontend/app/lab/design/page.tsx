'use client';

import Link from 'next/link';
import {
  Car,
  Check,
  Clock,
  Flag,
  History,
  MapPin,
  Navigation,
  Search,
  ShieldCheck,
  User,
  Users,
  UsersRound,
} from 'lucide-react';

import { FriendRow } from '@/components/friends/friend-row';
import { GroupCard } from '@/components/groups/group-card';
import type { Destination, RideGroup } from '@/lib/api';
import { RideOption, StatusBanner, SwipeCard } from '@/components/patterns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * Design lab — static compositions mirroring Design/patterns.card.html.
 * Not linked from production nav; for visual QA of tokens and patterns.
 */
export default function DesignLabPage() {
  return (
    <div className="bg-paper text-foreground min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-12">
        <header className="space-y-2">
          <h1 className="font-display text-3xl tracking-tight">Design lab</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Buttons wipe an amber rule on hover; badges are stamps with a leading rule.
            See also <code className="text-xs">tools/index.html</code>.
          </p>
        </header>

        <section className="space-y-4">
          <p className="renki-eyebrow">Buttons · hover to wipe the amber rule, the mark turns 45°</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Continue</Button>
            <Button variant="outline">Decline</Button>
            <Button variant="secondary">Skip</Button>
            <Button variant="ghost">Cancel ride</Button>
            <Button variant="destructive">Tap again to cancel</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="max-w-sm">
            <Button size="xl" block>
              Continue →
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          <p className="renki-eyebrow">Badges · stamps, mono, leading rule in the tone colour</p>
          <div className="flex flex-wrap gap-2">
            <Badge live>Everyone is in</Badge>
            <Badge variant="brand" live>
              Wants to ride with you
            </Badge>
            <Badge variant="secondary">Waiting on replies</Badge>
            <Badge variant="destructive">Suspended</Badge>
            <Badge variant="outline">placeholder</Badge>
          </div>
        </section>

        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <StatusBanner
              tone="brand"
              icon={<ShieldCheck className="size-5" strokeWidth={2} />}
              title="Sadia"
              body="North South University · matched only with female riders"
              action={
                <Link
                  href="/profile"
                  className="text-brand text-xs font-medium underline-offset-4 hover:underline"
                >
                  Change who you are matched with
                </Link>
              }
            />

            <RideOption
              href="/rides/search"
              icon={Search}
              title="Match with a stranger"
              body="One other rider leaving campus around the same time. You both swipe; a ride happens only if you both say yes."
            />

            <GroupCard
              group={DEMO_GROUP}
              viewerId="viewer"
              origin={DEMO_ORIGIN}
              destination={DEMO_DEST}
              onRespond={() => undefined}
              onComplete={() => undefined}
              onCancel={() => undefined}
              pending={false}
              highlighted
            />

            <div>
              <p className="renki-eyebrow mb-2">People</p>
              <ul className="border-border border-t">
                <FriendRow
                  friend={{
                    id: '1',
                    name: 'Sadia Rahman',
                    university: 'NSU',
                    gender: 'female',
                    trustStage: 'new',
                    profilePictureUrl: null,
                  }}
                  note="Met 3 Mar"
                />
                <FriendRow
                  friend={{
                    id: '2',
                    name: 'Imran Kabir',
                    university: 'NSU',
                    gender: 'male',
                    trustStage: 'new',
                    profilePictureUrl: null,
                  }}
                  note="Wants to be friends"
                >
                  <Button size="sm">Accept</Button>
                </FriendRow>
              </ul>
            </div>

            <nav aria-label="Demo nav" className="border-border flex gap-4 border-t pt-4 text-xs">
              {[
                { href: '/rides', label: 'Rides', icon: Car },
                { href: '/friends', label: 'Friends', icon: Users },
                { href: '/groups', label: 'Groups', icon: UsersRound },
                { href: '/history', label: 'History', icon: History },
                { href: '/profile', label: 'Profile', icon: User },
              ].map(({ href, label, icon: Icon }) => (
                <span key={href} className="text-muted-foreground flex items-center gap-1">
                  <Icon className="size-3.5" />
                  {label}
                </span>
              ))}
            </nav>
          </div>

          <div className="space-y-3">
            <p className="renki-eyebrow">Match deck</p>
            <div className="h-[360px]">
              <SwipeCard
                name="Imran Kabir"
                badgeLabel="Wants to ride with you"
                badgeAccepted
                intent="yes"
                offset={26}
                facts={[
                  { icon: Flag, label: 'Waiting at', value: 'NSU gate 1' },
                  { icon: MapPin, label: 'Going to', value: 'Dhanmondi 27' },
                  { icon: Navigation, label: 'From your drop-off', value: '0.8 km away' },
                  {
                    icon: Clock,
                    label: 'Leaving',
                    value: '6:30 PM · 5 min from yours',
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const DEMO_ORIGIN: Destination = {
  id: 'o1',
  label: 'NSU',
  area: 'Dhaka',
  latitude: 23.815,
  longitude: 90.425,
  kind: 'campus',
};

const DEMO_DEST: Destination = {
  id: 'd1',
  label: 'Dhanmondi 27',
  area: 'Dhaka',
  latitude: 23.746,
  longitude: 90.374,
  kind: 'other',
};

const DEMO_GROUP: RideGroup = {
  id: 'g-demo',
  status: 'matched',
  departureTime: '2026-03-14T12:30:00.000Z',
  originLocationId: 'o1',
  destinationLocationId: 'd1',
  gender: 'female',
  formation: 'friends',
  capacity: 6,
  pendingCount: 0,
  startsAtCampus: true,
  createdById: 'viewer',
  startedAt: null,
  completedAt: null,
  members: [
    {
      id: 'viewer',
      name: 'Sadia Rahman',
      profilePictureUrl: null,
      inviteStatus: 'accepted',
      isCreator: true,
      dropoffLocationId: null,
      dropoffLabel: null,
    },
    {
      id: '2',
      name: 'Imran Kabir',
      profilePictureUrl: null,
      inviteStatus: 'accepted',
      isCreator: false,
      dropoffLocationId: null,
      dropoffLabel: null,
    },
    {
      id: '3',
      name: 'Tanvir Hossain',
      profilePictureUrl: null,
      inviteStatus: 'accepted',
      isCreator: false,
      dropoffLocationId: null,
      dropoffLabel: null,
    },
  ],
};
