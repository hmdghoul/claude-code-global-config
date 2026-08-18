# Repository Rules — Architecture, Logging, Jobs

Applies when working inside an application repository, whatever the language. Language-bound rules live in `lang-kotlin.md` and `lang-sql.md`. Defaults yield per the precedence ladder in `CLAUDE.md`.

## Established patterns come first
- Always match the app's established standard over your own defaults. Before writing or changing code, check how the codebase already does it (nearest sibling component, shared idiom) and follow that — serving/endpoint style (e.g. Elide resource vs custom controller), pagination base, naming, error handling, framework patterns. Never introduce a divergent pattern when an established one exists; when several conventions coexist, match the closest sibling.
- When you change one member of a parallel set, change every member in the same edit — the create/update pair, the sibling DTOs, the per-status handlers, the locale message bundles. Adding a field to one half only makes a consumer see it appear and then vanish, and no build step compares siblings to each other.

## Architecture
- A new route carries the same authorization guard its siblings in that file carry, matched to its verb — a write guarded by the read permission is an open door. Check by counting: the guard annotations and the route mappings in a controller must come out equal.
- Identity and scope come from the authenticated principal, never from a request field. A route that accepts a user id or a store id as a parameter lets any caller that can reach the service act as anyone.
- A controller binds the request, calls one service method, and wraps the response. Every `if`, lookup, permission check and scope check belongs in the service, where it can be reused and tested.
- Model a new distinction inside the one component that consumes it — do not push it into a shared type because that is where it "naturally" belongs.
- Durable idempotency needs a persisted marker, not a cache that can evict.
- Set a stored field from the event's full payload, not by adding a delta to what is already there — a redelivered event must not move the number.
- A force, override, or skip path persists the acting user id, not just the outcome. Logging who did it is not enough — an override with no stored actor is indistinguishable from a system bug the first time someone abuses it.
- Branch on a derived predicate, not on one member of a set — a capability check or a count, never `type == THAT_ONE`. Naming one member means the next member needs a code change nobody remembers to make; before calling the branch done, say what happens for every other member.
- Never overwrite a stored amount to record a derived one; keep the original and put the discount, fee or markup in its own field, because the reports reconcile the two.
- Format money by the currency's minor-unit digits, never a fixed two decimals — several currencies in the region have three (BHD, KWD, OMR, JOD), so read the digits from the currency rather than checking against a list.

## Configuration
- No tunable as a literal: ids, country codes, timeouts, sleeps, lock durations and thresholds are read from config, because a literal makes the next change a code change and a release.
- A config key added in code ships in the same commit as its entry in the example env file, and the PR names every environment that must have it set. A key that exists only in code falls through to its default in production, so the feature ships looking enabled and does nothing.

## Transactions and locks
- Draw the transaction around the writes that must commit together — a status change and its audit row are one transaction, not two. Anything that must survive the rollback goes outside it.
- No network call inside an open transaction. A blocking call to another service holds a pooled connection for its whole duration, and the pool is the thing that fails first under load.
- Nothing irreversible inside a transaction that can still roll back — a job deletion, a message publish, a remote mutation. Move it after commit.
- A lock's key must name the exact subject it guards, and the guarded work must sit inside the lock's block. A lock whose critical section is empty, or whose key omits the subject, protects nothing while still costing a round trip. The transaction must also commit inside the lock — releasing on the way out of an outer transactional method hands the lock over before the write is visible — and the release belongs in a `finally`, or a thrown exception leaks the key for its full TTL.

## Jobs and events
- If a condition is already known at enqueue time, check it there and skip the enqueue — never schedule a job, event, or retry that a downstream guard will only discard. Keep the downstream guard as a safety net, not as the decision point.
- An event payload carries the entity's own id and its own timestamps from the start, even when today's only consumer needs neither. A consumer cannot order or deduplicate events that arrive out of order without them, and adding them later fixes nothing for the events already published.
- A job already in the queue was serialized against the old signature. Changing a job's parameters, their order, or what an enqueued lambda captures fails those jobs one at a time in the background, after the deploy looks green — add an overload and keep the old signature until the queue has drained.

## Logging
- An action with consequences — a state transition, a money movement, a permission change, a bulk or destructive write, anything a force or override path does — is logged on both outcomes. On success log what changed, how much, and who did it. On failure or rejection log why it was refused, including a validation bail that aborts the mutation before it happens. Log at a level the service actually emits. A routine high-volume write can skip the success line; the failure line still earns its place.
