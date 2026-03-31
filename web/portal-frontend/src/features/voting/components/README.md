# Voting Components Library

This document describes the voting components available in the UpdSpace Portal frontend.

## Overview

The voting components follow academic UX/UI standards:
- **Nielsen's 10 Usability Heuristics**
- **Shneiderman's 8 Golden Rules**
- **WCAG 2.1 AA Accessibility Guidelines**

All components support both **legacy** (nominations API) and **modern** (polls API) voting systems through the unified API layer.

---

## Components

### VotingCard

Displays a voting session summary in catalog/list views.

```tsx
import { VotingCard } from '@/features/voting/components';

<VotingCard
  voting={votingSession}
  variant="medium"
  showProgress={true}
  onClick={(id) => navigate(`/votings/${id}`)}
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `voting` | `VotingSession` | required | Voting session data |
| `variant` | `'large' \| 'medium' \| 'small'` | `'medium'` | Card size variant |
| `showProgress` | `boolean` | `true` | Show time remaining progress bar |
| `onClick` | `(id: string) => void` | - | Click handler |
| `className` | `string` | `''` | Additional CSS class |

#### Features

- ✅ Visual hierarchy (active > upcoming > finished)
- ✅ Countdown timer for active votings
- ✅ Progress indicator (time remaining)
- ✅ Gradient cover images
- ✅ Status badges
- ✅ Keyboard navigation (Enter/Space)
- ✅ ARIA labels

---

### VotingCardSkeleton

Loading placeholder for VotingCard with shimmer animation.

```tsx
import { VotingCardSkeleton } from '@/features/voting/components';

{isLoading && <VotingCardSkeleton variant="medium" />}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'large' \| 'medium' \| 'small'` | `'medium'` | Skeleton size |
| `className` | `string` | `''` | Additional CSS class |

---

### VotingList

Displays a list of voting sessions with filtering, sorting, and pagination.

```tsx
import { VotingList } from '@/features/voting/components';

<VotingList
  votings={votingSessions}
  isLoading={isLoading}
  showFilters={true}
  showSorting={true}
  onVotingClick={(id) => navigate(`/votings/${id}`)}
  emptyMessage="No votings available"
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `votings` | `VotingSession[]` | required | Array of voting sessions |
| `isLoading` | `boolean` | `false` | Loading state |
| `variant` | `'large' \| 'medium' \| 'small'` | `'medium'` | Card variant for items |
| `showFilters` | `boolean` | `true` | Show status filter dropdown |
| `showSorting` | `boolean` | `true` | Show sorting dropdown |
| `onVotingClick` | `(id: string) => void` | - | Click handler for items |
| `emptyMessage` | `string` | `'No votings'` | Empty state message |
| `className` | `string` | `''` | Additional CSS class |

#### Features

- ✅ Filters: Status (active/draft/closed)
- ✅ Sorting: Deadline, Created date, Title
- ✅ Grouped display (active > draft > closed)
- ✅ Responsive grid layout
- ✅ Empty state with action button
- ✅ Skeleton loading

---

### NominationCard

Displays a single nomination option with voting controls.

```tsx
import { NominationCard } from '@/features/voting/components';

<NominationCard
  nomination={nomination}
  mode="single"
  isSelected={selectedId === nomination.id}
  isVoted={userVote === nomination.id}
  isDisabled={isVotingClosed}
  showVoteCount={true}
  totalVotes={100}
  onSelect={(id) => setSelectedId(id)}
  onDeselect={(id) => setSelectedId(null)}
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `nomination` | `Nomination` | required | Nomination data |
| `mode` | `'single' \| 'multi' \| 'ranked'` | required | Voting mode |
| `isSelected` | `boolean` | `false` | Currently selected |
| `isVoted` | `boolean` | `false` | User has voted for this |
| `isDisabled` | `boolean` | `false` | Voting disabled |
| `showVoteCount` | `boolean` | `false` | Show vote count |
| `totalVotes` | `number` | `0` | Total votes for percentage |
| `rank` | `number` | - | Rank position (for ranked mode) |
| `onSelect` | `(id: string) => void` | - | Selection handler |
| `onDeselect` | `(id: string) => void` | - | Deselection handler |
| `onExpand` | `(id: string) => void` | - | Expand details handler |
| `className` | `string` | `''` | Additional CSS class |

#### Features

- ✅ Radio/Checkbox/Rank visual modes
- ✅ Vote count visualization (progress bar)
- ✅ Selected state with visual confirmation
- ✅ Disabled state for closed votings
- ✅ Progressive disclosure (expand description)
- ✅ Image support
- ✅ Keyboard navigation

---

### VoteButton

Action button for submitting votes with loading states and animations.

```tsx
import { VoteButton } from '@/features/voting/components';

<VoteButton
  optionId={selectedOption}
  nominationId={nominationId}
  pollId={pollId}
  isSelected={hasVoted}
  isLoading={isMutating}
  isSuccess={justVoted}
  disabledReason="Voting is closed"
  onVote={(action) => castVote(action)}
  onRevoke={(voteId) => revokeVote(voteId)}
>
  Vote
</VoteButton>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `optionId` | `string` | required | Selected option ID |
| `nominationId` | `string` | required | Nomination ID |
| `pollId` | `string` | required | Poll/Voting ID |
| `isSelected` | `boolean` | `false` | Already voted |
| `isDisabled` | `boolean` | `false` | Button disabled |
| `isLoading` | `boolean` | `false` | Loading state |
| `isSuccess` | `boolean` | `false` | Success animation |
| `isError` | `boolean` | `false` | Error state |
| `disabledReason` | `string` | - | Tooltip for disabled state |
| `onVote` | `(action: VoteAction) => void` | required | Vote handler |
| `onRevoke` | `(voteId: string) => void` | required | Revoke handler |
| `existingVoteId` | `string` | - | Existing vote ID for revoke |
| `children` | `ReactNode` | required | Button content |
| `size` | `'s' \| 'm' \| 'l' \| 'xl'` | `'m'` | Button size |
| `className` | `string` | `''` | Additional CSS class |

#### Features

- ✅ Loading spinner during mutation
- ✅ Success checkmark animation
- ✅ Disabled state with tooltip
- ✅ Error indicator
- ✅ Revoke capability

---

### ResultsVisualization

Displays voting results with interactive charts.

```tsx
import { ResultsVisualization } from '@/features/voting/components';

<ResultsVisualization
  nominations={nominations}
  totalVotes={totalVotes}
  title="Voting Results"
  showExport={true}
  maxDisplay={10}
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `nominations` | `Nomination[]` | required | Nominations with vote counts |
| `totalVotes` | `number` | required | Total vote count |
| `title` | `string` | `'Results'` | Section title |
| `showExport` | `boolean` | `true` | Show CSV export button |
| `maxDisplay` | `number` | `10` | Maximum items to show |
| `className` | `string` | `''` | Additional CSS class |

#### Features

- ✅ Horizontal bar chart (Recharts)
- ✅ Winner highlight with crown icon
- ✅ Vote percentage calculation
- ✅ Summary statistics
- ✅ CSV export
- ✅ Accessible data table
- ✅ Custom tooltip

---

### VotingAlerts

Contextual alerts for voting states with actionable buttons.

```tsx
import { VotingAlerts, createVotingAlerts } from '@/features/voting/components';

const alerts = [
  createVotingAlerts.votingClosed(() => navigate('/results')),
  createVotingAlerts.voteSuccess(),
];

<VotingAlerts
  alerts={alerts}
  onDismiss={(id) => removeAlert(id)}
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `alerts` | `VotingAlert[]` | required | Array of alerts |
| `onDismiss` | `(id: string) => void` | - | Dismiss handler |
| `className` | `string` | `''` | Additional CSS class |

#### Alert Types

```typescript
interface VotingAlert {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  dismissable?: boolean;
  autoDismiss?: boolean;
  autoDismissDelay?: number;
  actions?: AlertAction[];
}
```

#### Factory Functions

```typescript
import { createVotingAlerts } from '@/features/voting/components';

// Voting closed
createVotingAlerts.votingClosed(onViewResults?: () => void)

// Auth required
createVotingAlerts.authRequired(onLogin?: () => void)

// Telegram required
createVotingAlerts.telegramRequired(onLink?: () => void)

// Vote success (auto-dismiss)
createVotingAlerts.voteSuccess()

// Vote revoked (auto-dismiss)
createVotingAlerts.voteRevoked()

// Vote error with retry
createVotingAlerts.voteError(message?: string, onRetry?: () => void)

// Rate limit
createVotingAlerts.rateLimit(retryAfter: number)
```

---

## Styling

Import the component styles in your app entry point:

```tsx
// In main.tsx or App.tsx
import '@/features/voting/components/styles.css';
```

### CSS Variables

Components use Gravity UI CSS variables:

```css
--g-color-base-brand          /* Primary brand color */
--g-color-base-success        /* Success state */
--g-color-base-danger         /* Error state */
--g-color-text-primary        /* Primary text */
--g-color-text-secondary      /* Secondary text */
--g-color-line-generic        /* Borders */
--g-color-base-generic-*      /* Background shades */
```

### Responsive Breakpoints

```css
/* Mobile: < 768px */
@media (max-width: 768px) { ... }

/* Tablet: 768px - 1024px */
@media (min-width: 768px) and (max-width: 1024px) { ... }

/* Desktop: > 1024px */
@media (min-width: 1024px) { ... }
```

---

## Accessibility

All components follow WCAG 2.1 AA guidelines:

### Keyboard Navigation

- **Tab**: Move between interactive elements
- **Enter/Space**: Activate buttons, select options
- **Arrow keys**: Navigate within option lists
- **Escape**: Close modals, dismiss alerts

### ARIA Attributes

```tsx
// VotingCard
<article
  role="button"
  tabIndex={0}
  aria-labelledby="voting-123-title"
  aria-describedby="voting-123-meta"
>

// NominationCard
<div
  role="radio"  // or "checkbox" for multi-select
  aria-checked={isSelected}
  aria-disabled={isDisabled}
>

// VotingAlerts
<div role="alert" aria-live="polite">
```

### Screen Reader Support

- Status badges announce voting state
- Progress bars include percentage labels
- Empty states have descriptive messages
- Error states are announced immediately

---

## Best Practices

### 1. Use Skeleton Loading

Always show skeleton placeholders instead of spinners:

```tsx
{isLoading ? (
  <VotingCardSkeleton variant="medium" />
) : (
  <VotingCard voting={data} />
)}
```

### 2. Provide Empty States

Include meaningful empty state messages:

```tsx
<VotingList
  votings={[]}
  emptyMessage="No active votings. Check back later!"
/>
```

### 3. Handle Errors Gracefully

Use VotingAlerts for contextual error feedback:

```tsx
if (error) {
  alerts.push(createVotingAlerts.voteError(error.message, retry));
}
```

### 4. Optimistic Updates

Use the unified hooks with optimistic updates:

```tsx
const { mutateAsync } = useCastVoteUnified();
// UI updates immediately, rollback on error
```

### 5. Progressive Disclosure

Start compact, expand on demand:

```tsx
<NominationCard
  onExpand={(id) => setExpandedId(id)}
/>
```

---

## Migration Guide

### From Legacy Components

1. Replace `VotingCard` imports:
   ```tsx
   // Before
   import { VotingCard } from '@/pages/HomePage/components/VotingCard';
   
   // After
   import { VotingCard } from '@/features/voting/components';
   ```

2. Update props to use `VotingSession` type:
   ```tsx
   // Before
   <VotingCard item={decoratedVoting} nowTs={Date.now()} onOpen={fn} />
   
   // After
   <VotingCard voting={votingSession} onClick={fn} />
   ```

3. Use VotingList for catalog views:
   ```tsx
   // Before (manual filtering/sorting)
   {activeItems.map(item => <VotingCard key={item.id} ... />)}
   
   // After (built-in filtering/sorting)
   <VotingList votings={votingSessions} showFilters showSorting />
   ```
