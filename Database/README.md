Renki — PostgreSQL Schema

## Layout
```
src/
  schema/   -- 00-10, CREATE TABLE only, run in numeric order (FK-safe)
  seed/     -- 01-10, sample INSERT data, mirrors schema numbering
  verify.sql -- structural + row-count + referential-integrity + constraint checks
```

## Run it
```bash
createdb renki

for f in src/schema/*.sql; do psql -d renki -f "$f"; done
for f in src/seed/*.sql;   do psql -d renki -f "$f"; done

psql -d nsu_rideshare -f src/verify.sql
```

## Entities
users, locations, gender_verifications, friendships, ride_histories,
ride_groups, ride_requests, qr_verifications, uber_integrations, reports.

`ride_requests.ride_group_id` doubles as the membership link — a rider
joins a group simply by having that column set, so no separate
junction table is needed between users and ride_groups.
