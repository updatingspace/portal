# UpdSpace Portal - Voting System UX Specification

**Version**: 1.0  
**Last Updated**: 2026-03-31  
**Status**: Implementation Ready

---

## Executive Summary

This document defines the complete UX redesign of the UpdSpace Portal voting system, applying academic HCI principles (Nielsen's Heuristics, Shneiderman's Golden Rules) to create an intuitive, accessible, and efficient voting experience for all user types.

**Goals:**
- Unify Legacy (Nominations) and Modern (Polls) systems into consistent UX
- Implement optimistic updates for immediate feedback
- Achieve WCAG 2.1 AA accessibility compliance
- Apply progressive disclosure for complex information
- Ensure mobile-first responsive design

---

## 1. User Flows & Scenarios

### 1.1 Primary User Flows

#### Flow 1: Browse & Discover Votings
**Actor**: All users (authenticated & anonymous)

```
1. User lands on Home Page
   ├─ Sees active votings (sorted by nearest deadline)
   ├─ Sees upcoming votings
   └─ Sees finished/archived votings (collapsed by default)

2. User browses votings
   ├─ Visual hierarchy: Active (green accent) > Upcoming (blue) > Finished (gray)
   ├─ Each card shows: Title, deadline countdown, progress (X/Y nominations), status badge
   └─ Skeleton screens during loading (Nielsen: Visibility of System Status)

3. User filters/sorts
   ├─ Filter by: Status (active/upcoming/finished), Type (nominations/polls)
   ├─ Sort by: Deadline (nearest first - default), Created date, Popularity
   └─ Empty state if no results: "No active votings" with CTA to view archived

4. User clicks voting card → Navigate to Voting Detail Page
```

**Success Criteria:**
- User can find active voting within 5 seconds
- Visual hierarchy clearly distinguishes voting states
- Loading states don't block user (skeleton screens)

---

#### Flow 2: View Voting Details & Cast Vote
**Actor**: Authenticated users with permissions

```
1. User arrives at Voting Detail Page
   ├─ Breadcrumbs: Home > [Voting Title]
   ├─ Sees voting metadata: Description, deadline, total nominations, rules
   └─ Sees list of nominations (cards or list view)

2. User selects nomination → Navigate to Nomination Detail Page
   ├─ Breadcrumbs: Home > [Voting Title] > [Nomination Title]
   ├─ Sees nomination header: Title, description, deadline, vote count toggle
   └─ Sees options grid (paginated if >6 options)

3. User reviews options
   ├─ Compact view by default: Image, title, vote count (if enabled), vote button
   ├─ Progressive disclosure: Hover/click to expand for description
   ├─ Modal for full details (lazy loaded)
   └─ Keyboard navigation: Arrow keys, Enter to expand, Escape to close

4. User casts vote
   ├─ Clicks vote button on option
   ├─ IMMEDIATE optimistic update (Shneiderman: Informative Feedback)
   │  ├─ Button shows loading spinner
   │  ├─ Vote count increments locally
   │  └─ Visual confirmation (checkmark animation)
   ├─ If success: Toast "Голос учтён" (auto-dismiss 3s)
   ├─ If error: Rollback optimistic update, show error toast with retry option
   └─ If rate limited: Show countdown timer "Подождите {X}s"

5. User views updated results
   ├─ Vote counts update (if showVoteCounts=true)
   ├─ User's vote highlighted with checkmark
   └─ Option to revoke vote (if allow_revoting=true)
```

**Success Criteria:**
- Vote registers with <500ms perceived latency (optimistic update)
- User receives clear feedback for every action (toast, visual state change)
- Errors are recoverable with one-click retry

**Edge Cases:**
- **Voting closed**: Alert banner "Голосование завершено" with link to results
- **Auth required**: Alert "Требуется вход" with Login button
- **Telegram link required**: Alert "Нужна привязка Telegram" with Link button
- **Already voted**: Show current vote with revoke option (if allowed)
- **Rate limit exceeded**: Disable vote button, show countdown timer
- **Network failure**: Queue vote for retry, notify user "Отправляем голос..."

---

#### Flow 3: View Results
**Actor**: All users (permissions vary by results_visibility setting)

```
1. User navigates to Results Page
   ├─ From voting card "View Results" link (if voting closed)
   ├─ From nomination page "Results" tab
   └─ From admin dashboard

2. User views results visualization
   ├─ Bar chart for top nominations (Recharts)
   ├─ Percentage rings for each option
   ├─ Winner highlight (gold badge, largest bar)
   ├─ Total vote count summary
   └─ Export options: CSV, PNG (admin only)

3. User filters/sorts results
   ├─ Sort by: Votes (desc - default), Alphabetical, Recent
   ├─ Filter by: Nomination (if multi-nomination voting)
   └─ Historical comparison (if available)

4. User shares results
   ├─ Copy shareable link (public if results_visibility=always)
   ├─ Social share buttons (Twitter, Telegram)
   └─ Embed code (admin only)
```

**Success Criteria:**
- Results load within 2 seconds
- Visualization is clear and accessible (color-blind safe palette)
- Export works reliably

---

#### Flow 4: Admin - Create Voting
**Actor**: Admins with `voting.votings.admin` capability

```
1. Admin navigates to "Create Voting" (from admin dashboard or home page + button)

2. Admin fills multi-step wizard
   ├─ Step 1: Basic Info
   │  ├─ Title (required)
   │  ├─ Description (rich text editor)
   │  └─ Voting type: Nominations / Poll
   ├─ Step 2: Settings
   │  ├─ Deadline (datetime picker)
   │  ├─ Visibility: Public / Community / Team / Private
   │  ├─ Results visibility: Always / After closed / Admins only
   │  ├─ Allow revoting: Yes / No
   │  ├─ Show vote counts: Yes / No
   │  └─ Require Telegram link: Yes / No
   ├─ Step 3: Template Selection (Quick Setup)
   │  ├─ Single choice (radio buttons)
   │  ├─ Multi choice (checkboxes)
   │  └─ Ranked choice (drag-n-drop)
   └─ Step 4: Preview & Confirm
      ├─ Shows preview of voting card
      └─ "Create Draft" or "Publish Immediately"

3. Admin adds nominations
   ├─ Navigate to "Manage Nominations" from voting detail
   ├─ Add nomination: Title, description, options
   ├─ Drag-to-reorder nominations
   └─ Live preview of voting page

4. Admin publishes voting
   ├─ Change status: Draft → Active
   ├─ Confirmation dialog with checklist
   └─ Success notification + link to live voting
```

**Success Criteria:**
- Wizard can be completed in <3 minutes
- Real-time validation prevents errors
- Preview matches actual voting page

---

#### Flow 5: Admin - Manage & Monitor
**Actor**: Admins with `voting.votings.admin` capability

```
1. Admin views voting dashboard
   ├─ All votings list (draft/active/closed/archived)
   ├─ Quick actions: Edit, View, Results, Close, Delete
   └─ Live stats: Total votes, participation rate, time remaining

2. Admin monitors active voting
   ├─ Live vote count updates (polling every 30s)
   ├─ Analytics: Vote distribution, participation timeline
   ├─ Nomination leaderboard
   └─ Alert if deadline approaching (<24h remaining)

3. Admin closes voting
   ├─ Manual close button (before deadline)
   ├─ Confirmation dialog: "This will stop all voting. Continue?"
   ├─ Auto-close at deadline
   └─ Notification to all participants (optional)

4. Admin exports results
   ├─ CSV: Raw vote data with timestamps
   ├─ JSON: Structured data for external tools
   ├─ PDF: Formatted report with charts
   └─ PNG: Chart image for sharing
```

**Success Criteria:**
- Real-time stats update without manual refresh
- Export completes within 10 seconds
- Closing voting is reversible (admin can reopen)

---

### 1.2 Edge Case Scenarios

#### Scenario 1: Late Participation
```
User arrives after voting deadline
├─ Alert banner: "Голосование завершено [deadline]"
├─ Vote buttons disabled with tooltip: "Voting ended"
├─ Results visible (based on results_visibility setting)
└─ Option to view similar active votings (recommendations)
```

#### Scenario 2: Revoting
```
User changes mind (if allow_revoting=true)
├─ Current vote highlighted with "✓ Voted" badge
├─ Revoke button visible: "Change Vote"
├─ Click → Vote cleared optimistically
├─ User can vote for different option
├─ Toast: "Голос изменён"
└─ If allow_revoting=false: Revoke button hidden, tooltip "Revoting not allowed"
```

#### Scenario 3: Network Interruption During Vote
```
User votes, but network fails before response
├─ Optimistic update shows vote registered
├─ Background: Queue retry with exponential backoff
├─ Toast: "Отправляем голос..." (persistent until resolved)
├─ On success: Toast updates to "Голос учтён" (auto-dismiss)
├─ On failure after retries: Rollback + Error toast with "Retry" button
└─ User can retry manually or continue browsing (vote queued)
```

#### Scenario 4: Simultaneous Voting (Race Condition)
```
User votes for Option A, server already recorded different vote
├─ Server returns 409 Conflict or ALREADY_VOTED error
├─ Client rolls back optimistic update
├─ Toast: "Вы уже голосовали за другой вариант"
├─ Show actual server state (refresh vote)
└─ User can revoke and vote again (if allow_revoting=true)
```

#### Scenario 5: Pagination with Many Options
```
Nomination has 100+ options (e.g., game nominations)
├─ Display 6 options per page (configurable via ?limit=N)
├─ Pagination controls: Prev / Next buttons + Page indicator "Page 2 of 17"
├─ Keyboard navigation: Arrow left/right for pages
├─ "Jump to page" input for quick navigation
├─ Virtual scrolling if user prefers single-page view (toggle)
└─ Search/filter bar for finding specific options
```

---

## 2. Information Architecture

### 2.1 Navigation Structure

```
┌─ Home Page (/)
│  ├─ Active Votings Section (default expanded)
│  ├─ Upcoming Votings Section (default expanded if <3 active)
│  ├─ Finished Votings Section (default collapsed)
│  └─ Archived Votings Section (default collapsed)
│
├─ Voting Detail Page (/votings/:votingId)
│  ├─ Voting metadata (description, deadline, rules)
│  ├─ Nominations list (cards with preview)
│  └─ Admin controls (if permissions: Edit, Manage, Close)
│
├─ Nomination Detail Page (/votings/:votingId/nominations/:nominationId)
│  ├─ Nomination header (title, description, deadline)
│  ├─ Voting alerts (closed, auth required, telegram link)
│  ├─ Vote counts toggle (if showVoteCounts=true)
│  ├─ Options grid (paginated, 6 per page default)
│  │  ├─ Option cards (compact view)
│  │  ├─ Option modal (full details, lazy loaded)
│  │  └─ Pagination controls (prev/next + page indicator)
│  └─ Back to voting / Home breadcrumbs
│
├─ Results Page (/votings/:votingId/results)
│  ├─ Results visualization (charts)
│  ├─ Filter/sort controls
│  ├─ Export options (admin)
│  └─ Share link
│
└─ Admin Pages (/admin/voting)
   ├─ Voting Dashboard (/admin/voting/dashboard)
   ├─ Create Voting (/admin/voting/create)
   ├─ Manage Voting (/admin/voting/:votingId/manage)
   └─ Results Analytics (/admin/voting/:votingId/analytics)
```

### 2.2 Breadcrumb Navigation

**Pattern**: Always show breadcrumbs for deep navigation

```
Home                                    → "/"
Home > [Voting Title]                   → "/votings/:votingId"
Home > [Voting Title] > [Nomination]    → "/votings/:votingId/nominations/:nominationId"
Home > [Voting Title] > Results         → "/votings/:votingId/results"
Admin > Voting Dashboard                → "/admin/voting/dashboard"
Admin > Create Voting                   → "/admin/voting/create"
```

**Implementation:**
- Each breadcrumb is clickable link (except current page)
- Current page in breadcrumb is bold, not clickable
- Mobile: Collapse to "< Back" button for space efficiency

---

### 2.3 URL Routing Strategy

**Current State (Legacy vs Modern):**
```
Legacy:
  /nominations/:id              → NominationPage (single nomination voting)
  /votings/:votingId            → VotingPage (list nominations)

Modern:
  /app/voting/:id               → PollPage (modern poll interface)
```

**Target State (Unified):**
```
/                               → HomePage (catalog of all votings)
/votings/:votingId              → VotingDetailPage (nominations list)
/votings/:votingId/nominations/:nominationId → NominationDetailPage (vote interface)
/votings/:votingId/results      → ResultsPage
/admin/voting/*                 → Admin pages
```

**Migration Strategy:**
1. Keep legacy routes as redirects during transition
2. Add canonical URL meta tags for SEO
3. Update all internal links to new structure
4. Remove redirects after 1 month

---

### 2.4 Hierarchy & Priority

**Visual Hierarchy (Nielsen: Recognition Rather than Recall):**

1. **Active Votings** (highest priority)
   - Large cards with accent color gradient
   - Countdown timer prominent
   - Progress indicator visible
   - CTA button: "Голосовать" (primary button)

2. **Upcoming Votings** (medium priority)
   - Medium cards with neutral color
   - Start date/time shown
   - "Coming soon" badge
   - CTA button: "Напомнить" (secondary button)

3. **Finished Votings** (low priority)
   - Small cards, grayscale
   - End date shown
   - "View Results" link (text link, not button)

4. **Archived Votings** (lowest priority)
   - Collapsed by default (expand on click)
   - List view (no images)
   - "Archived" badge

**Information Scent (Jakob Nielsen's concept):**
- Card titles clearly describe voting topic
- Metadata gives context without click: "5 nominations, 234 votes, ends in 2 days"
- Progress bars show participation level
- Badges communicate state: "Active", "Ending Soon (<24h)", "Closed", "Archived"

---

## 3. UI Component Design Principles

### 3.1 Academic Foundations

#### Nielsen's 10 Usability Heuristics - Applied to Voting

1. **Visibility of System Status**
   - ✅ Skeleton screens during loading (not blank page)
   - ✅ Optimistic updates (vote shows immediately)
   - ✅ Loading spinners on buttons during mutation
   - ✅ Toast notifications for all user actions
   - ✅ Countdown timers for rate limits and deadlines

2. **Match Between System and Real World**
   - ✅ Natural language: "Голосовать", "Изменить голос", not technical jargon
   - ✅ Familiar voting patterns: Radio buttons (single choice), checkboxes (multi-choice)
   - ✅ Real-world metaphors: Ballot box icon, checkmark for voted

3. **User Control and Freedom**
   - ✅ Revoke vote option (if allow_revoting=true)
   - ✅ Breadcrumbs for easy navigation back
   - ✅ Undo for accidental actions (vote rollback on error)
   - ✅ Cancel button in all dialogs

4. **Consistency and Standards**
   - ✅ Unified component library (VotingCard, NominationCard, VoteButton)
   - ✅ Consistent color coding: Green (active), Blue (upcoming), Gray (finished)
   - ✅ Same interaction patterns across all voting types
   - ✅ @gravity-ui/uikit for platform consistency

5. **Error Prevention**
   - ✅ Confirmation dialogs for irreversible actions (admin: close voting, delete)
   - ✅ Disabled states with explanatory tooltips (vote button when not allowed)
   - ✅ Real-time validation in forms (Zod schemas)
   - ✅ Rate limiting prevents spam (with countdown timer)

6. **Recognition Rather than Recall**
   - ✅ Current vote always visible with checkmark
   - ✅ Voting metadata visible without clicking (deadline, rules on card)
   - ✅ Breadcrumbs show where you are
   - ✅ Recent votings in navigation (optional)

7. **Flexibility and Efficiency**
   - ✅ Keyboard shortcuts: Arrow keys for navigation, Enter to vote, Escape to close
   - ✅ Prefetch on hover (predictive loading)
   - ✅ Bulk actions for admins (select multiple, batch operations)
   - ✅ Power user features: URL params (?limit=20, ?sort=votes)

8. **Aesthetic and Minimalist Design**
   - ✅ Progressive disclosure: Compact view → Expanded → Modal
   - ✅ Hide complexity until needed (vote counts toggle, advanced filters)
   - ✅ Clean card design: Essential info only
   - ✅ Whitespace for visual breathing room

9. **Help Users Recognize, Diagnose, and Recover from Errors**
   - ✅ Error messages in plain language: "Голосование завершено", not "Error 403"
   - ✅ Actionable error toasts: "Retry" button on network failure
   - ✅ Contextual help: Tooltip "Revoting not allowed for this voting"
   - ✅ Inline validation feedback in forms

10. **Help and Documentation**
    - ✅ Tooltips on interactive elements
    - ✅ Help text for complex features (ranked choice voting)
    - ✅ Onboarding for first-time voters (optional tour)
    - ✅ FAQ link in footer

---

#### Shneiderman's 8 Golden Rules - Applied to Voting

1. **Strive for Consistency**
   - ✅ Uniform component library
   - ✅ Same voting interaction across all types
   - ✅ Consistent terminology throughout

2. **Cater to Universal Usability**
   - ✅ WCAG 2.1 AA compliance (keyboard, ARIA, contrast)
   - ✅ Mobile-first responsive design
   - ✅ Multi-language support (i18n)
   - ✅ Graceful degradation for older browsers

3. **Offer Informative Feedback**
   - ✅ Optimistic updates (immediate visual confirmation)
   - ✅ Toast notifications for all actions
   - ✅ Loading states for async operations
   - ✅ Success animations (checkmark, color change)

4. **Design Dialogs to Yield Closure**
   - ✅ Clear completion states: "Vote cast successfully" → auto-dismiss
   - ✅ Modal flows: Create voting wizard has clear "Done" step
   - ✅ Progress indicators in multi-step processes
   - ✅ No ambiguous states (always clear what happens next)

5. **Prevent Errors**
   - ✅ Validation before submission (client + server)
   - ✅ Disable vote button with tooltip when not allowed
   - ✅ Confirmation for destructive admin actions
   - ✅ Rate limiting prevents abuse

6. **Permit Easy Reversal of Actions**
   - ✅ Revoke vote (if allowed)
   - ✅ Rollback on optimistic update failure
   - ✅ Admin can reopen closed voting (reversible)
   - ✅ Undo for accidental navigation (browser back works)

7. **Support Internal Locus of Control**
   - ✅ User initiates all actions (no auto-voting)
   - ✅ Transparent system behavior (no hidden magic)
   - ✅ User can always see current state (voted/not voted)
   - ✅ Manual refresh option (in addition to auto-refresh)

8. **Reduce Short-Term Memory Load**
   - ✅ Persistent voting state (voted options highlighted)
   - ✅ Breadcrumbs show navigation path
   - ✅ No pagination memory needed (page state in URL)
   - ✅ Auto-save in admin forms (draft mode)

---

### 3.2 Voting UI Patterns

#### Single-Choice Voting (Radio Button Pattern)

**Visual Design:**
```
┌─────────────────────────────────────┐
│ ◯ Option A                          │
│   Brief description...              │
│   👥 123 votes (if enabled)         │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ ◉ Option B  ✓ You voted            │
│   Brief description...              │
│   👥 456 votes (if enabled)         │
│   [Revoke Vote] (if allowed)        │
└─────────────────────────────────────┘
```

**Interaction:**
- Click anywhere on card to vote (large hit area)
- Radio button visual feedback (filled circle)
- Checkmark badge on voted option
- Revoke button appears only on voted option
- Optimistic update: Radio switches immediately

**Accessibility:**
- ARIA role="radiogroup" on container
- ARIA aria-checked="true" on voted option
- Keyboard: Tab to navigate, Space/Enter to vote
- Screen reader: "Option B, radio button, selected, 456 votes"

---

#### Multi-Choice Voting (Checkbox Pattern)

**Visual Design:**
```
┌─────────────────────────────────────┐
│ ☐ Option A                          │
│   Brief description...              │
│   👥 89 votes (if enabled)          │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ ☑ Option B  ✓                       │
│   Brief description...              │
│   👥 156 votes (if enabled)         │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ ☑ Option C  ✓                       │
│   Brief description...              │
│   👥 134 votes (if enabled)         │
└─────────────────────────────────────┘
  ────────────────────────────────────
  You selected 2 options  [Submit Votes]
```

**Interaction:**
- Click anywhere on card to toggle
- Checkbox visual feedback (checked/unchecked)
- Selection counter at bottom
- Submit button to commit all votes at once
- Max limit indicator (if configured, e.g., "Select up to 3")

**Accessibility:**
- ARIA role="group" with aria-labelledby="voting-title"
- ARIA aria-checked on each checkbox
- Keyboard: Tab to navigate, Space to toggle
- Screen reader: "Option B, checkbox, checked, 156 votes"

---

#### Ranked-Choice Voting (Drag-n-Drop Pattern)

**Visual Design:**
```
Your Rankings:
┌─────────────────────────────────────┐
│ ≡ 1. Option B      [Remove]         │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ ≡ 2. Option A      [Remove]         │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ ≡ 3. Option C      [Remove]         │
└─────────────────────────────────────┘
  ────────────────────────────────────
  Available Options:
  [Option D] [Option E] [Option F]
  
  [Submit Rankings]
```

**Interaction:**
- Drag handle (≡) for reordering
- Click "Add" button to add option to rankings
- Click "Remove" to remove from rankings
- Live preview of ranking order
- Submit button to commit rankings

**Accessibility:**
- ARIA role="listbox" with aria-orientation="vertical"
- ARIA aria-grabbed and aria-dropeffect for drag states
- Keyboard: Arrow up/down to reorder, Space to grab/drop
- Alternative: Up/Down buttons for users who can't drag

---

### 3.3 Component Specifications

#### VotingCard Component

**Purpose**: Display voting summary on catalog pages (Home, Admin dashboard)

**Anatomy:**
```
┌───────────────────────────────────────────┐
│ [Image/Gradient Background]               │
│                                           │
│ Active  ⏱ 2 days 5h remaining            │
│                                           │
│ Best Game of 2025                        │
│ Vote for your favorite game released     │
│ this year across 5 categories.           │
│                                           │
│ 📊 Progress: 234/500 nominations         │
│ 🗳 5 nominations  👥 1,234 votes total    │
│                                           │
│ [Голосовать →]                            │
└───────────────────────────────────────────┘
```

**Props:**
```typescript
interface VotingCardProps {
  voting: {
    id: string;
    title: string;
    description?: string;
    imageUrl?: string;
    status: 'active' | 'upcoming' | 'finished' | 'archived';
    deadline?: Date;
    nominationCount: number;
    totalVotes?: number;
    palette: AccentPalette; // Gradient colors
  };
  variant?: 'large' | 'medium' | 'small'; // Size variants
  showProgress?: boolean; // Show vote progress bar
  onClick?: () => void; // Card click handler
}
```

**States:**
- Default: Clean card with hover elevation
- Hover: Slight scale-up (1.02), shadow increase
- Loading (skeleton): Pulsing gray blocks
- Active status: Green accent gradient
- Upcoming status: Blue accent gradient
- Finished status: Gray gradient

**Accessibility:**
- role="article" with aria-labelledby pointing to title
- Keyboard: Tab to focus, Enter to navigate
- Screen reader announces: "Best Game of 2025, active, 2 days remaining, 5 nominations, 1234 votes"

---

#### NominationCard Component

**Purpose**: Display individual option within a nomination for voting

**Anatomy:**
```
┌─────────────────────────────────────┐
│ [Option Image]                      │
│                                     │
│ ◯ The Legend of Zelda              │  ← Radio button (single-choice)
│    Epic adventure game...           │  ← Brief description
│                                     │
│    👥 456 votes  45.6%              │  ← Vote count & percentage
│                                     │
│    [Vote] or [✓ Voted]             │  ← Vote button / status
└─────────────────────────────────────┘
```

**Props:**
```typescript
interface NominationCardProps {
  option: {
    id: string;
    title: string;
    description?: string;
    imageUrl?: string;
    voteCount?: number;
    votePercentage?: number;
  };
  votingMode: 'single' | 'multi' | 'ranked';
  isVoted: boolean; // Current user voted for this
  showVoteCounts: boolean; // Show vote numbers
  canVote: boolean; // User has permission to vote
  isVotingClosed: boolean; // Voting period ended
  onVote: (optionId: string) => Promise<void>;
  onRevoke?: (optionId: string) => Promise<void>; // If revoting allowed
  onExpand?: (optionId: string) => void; // Open modal for full details
}
```

**States:**
- Default: White background, subtle border
- Hover: Border color change, cursor pointer (if can vote)
- Voted: Green border, checkmark badge, highlight background
- Disabled: Gray overlay, tooltip explanation (voting closed / no permission)
- Loading (voting): Button spinner, card dimmed slightly
- Error: Red border flash, error tooltip

**Progressive Disclosure:**
- Compact view (default): Image + title + votes + button
- Expanded view (hover/click): + full description + metadata
- Modal view (click "Details"): Full-screen with all info + related options

**Accessibility:**
- role="radio" or "checkbox" based on voting mode
- aria-checked="true" if voted
- aria-disabled="true" if can't vote
- Keyboard: Tab to focus, Space/Enter to vote
- Screen reader: "The Legend of Zelda, radio button, not selected, 456 votes, 45.6 percent"

---

#### VoteButton Component

**Purpose**: Primary action button for casting/revoking votes

**Anatomy:**
```
[Vote]              → Default state
[⏳ Voting...]      → Loading state (optimistic update in progress)
[✓ Voted]           → Voted state
[Change Vote]       → Voted state (if revoting allowed)
[Retry]             → Error state
```

**Props:**
```typescript
interface VoteButtonProps {
  state: 'idle' | 'loading' | 'voted' | 'error';
  canVote: boolean;
  canRevoke: boolean; // allow_revoting setting
  disabled: boolean;
  disabledReason?: string; // Tooltip text
  onVote: () => Promise<void>;
  onRevoke?: () => Promise<void>;
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
}
```

**Micro-interactions:**
1. Click → Button shows spinner immediately (optimistic)
2. Spinner spins for 300-500ms (perceived latency)
3. On success: Checkmark animation (fade in, scale pulse)
4. On error: Shake animation, button turns red

**Accessibility:**
- aria-label="Vote for [Option Name]"
- aria-busy="true" when loading
- Disabled state has aria-describedby pointing to tooltip
- Keyboard: Tab to focus, Enter/Space to trigger

---

#### ResultsVisualization Component

**Purpose**: Display voting results with charts and statistics

**Anatomy:**
```
┌───────────────────────────────────────┐
│ Results: Best Game of 2025            │
│ Total Votes: 1,234  •  Closed: Jan 1  │
├───────────────────────────────────────┤
│                                       │
│ 🏆 The Legend of Zelda    456  37.0% │
│ ████████████████████████              │
│                                       │
│    God of War              389  31.5% │
│ ████████████████████                  │
│                                       │
│    Elden Ring              234  19.0% │
│ ████████████                          │
│                                       │
│    Other options...        155  12.6% │
│ ████████                              │
├───────────────────────────────────────┤
│ [Export CSV] [Export PNG] [Share]     │
└───────────────────────────────────────┘
```

**Props:**
```typescript
interface ResultsVisualizationProps {
  results: Array<{
    optionId: string;
    optionTitle: string;
    voteCount: number;
    percentage: number;
    isWinner?: boolean;
  }>;
  totalVotes: number;
  votingTitle: string;
  closedAt?: Date;
  canExport: boolean; // Admin permission
  onExport?: (format: 'csv' | 'json' | 'png' | 'pdf') => void;
  onShare?: () => void;
}
```

**Chart Types:**
1. **Bar Chart** (default): Horizontal bars sorted by votes desc
2. **Percentage Rings**: Circular progress for each option
3. **Comparison Table**: Tabular view with sortable columns

**Accessibility:**
- Charts rendered as SVG with ARIA labels
- Alternative: Data table view for screen readers
- Keyboard: Tab to navigate, arrow keys to explore chart data points
- Color-blind safe palette (avoid red/green only)

---

## 4. Feedback & Error Handling System

### 4.1 Optimistic Updates Strategy

**Principle**: Update UI immediately, rollback on error (Shneiderman: Informative Feedback)

**Implementation Pattern:**
```typescript
// TanStack Query mutation with optimistic update
const castVoteMutation = useMutation({
  mutationFn: castVote,
  onMutate: async (payload) => {
    // Cancel outgoing queries (prevent race condition)
    await queryClient.cancelQueries({ queryKey: votingKeys.myVotes(pollId) });
    
    // Snapshot previous state for rollback
    const previousVotes = queryClient.getQueryData(votingKeys.myVotes(pollId));
    
    // Optimistically update UI
    queryClient.setQueryData(votingKeys.myVotes(pollId), (old) => [
      ...old,
      { optionId: payload.optionId, castAt: new Date().toISOString() }
    ]);
    
    // Also update vote counts
    queryClient.setQueryData(votingKeys.pollResults(pollId), (old) => ({
      ...old,
      options: old.options.map(opt => 
        opt.id === payload.optionId 
          ? { ...opt, voteCount: opt.voteCount + 1 }
          : opt
      )
    }));
    
    return { previousVotes }; // Return context for rollback
  },
  onError: (error, payload, context) => {
    // Rollback on error
    queryClient.setQueryData(votingKeys.myVotes(pollId), context.previousVotes);
    
    // Show error toast
    notifyApiError(error, 'Не удалось отправить голос');
  },
  onSuccess: () => {
    // Invalidate to fetch fresh server data
    queryClient.invalidateQueries({ queryKey: votingKeys.pollVotes(pollId) });
    queryClient.invalidateQueries({ queryKey: votingKeys.pollResults(pollId) });
    
    // Success toast
    toaster.add({ title: 'Голос учтён', theme: 'success' });
  }
});
```

**What Gets Optimistic Updates:**
- ✅ Cast vote (vote count increments immediately)
- ✅ Revoke vote (vote count decrements immediately)
- ✅ Admin: Close voting (status changes immediately)
- ✅ Admin: Add nomination (appears in list immediately)
- ❌ Load voting catalog (no optimistic, use skeleton)
- ❌ Load results (no optimistic, show spinner)

---

### 4.2 Loading States (Nielsen: Visibility of System Status)

**Skeleton Screens vs Spinners:**

**Use Skeleton Screens for:**
- ✅ Initial page load (voting catalog, nomination list)
- ✅ Navigation (voting detail page, results page)
- ✅ Pagination (next page of options)

**Use Spinners for:**
- ✅ Button actions (voting, form submission)
- ✅ Short mutations (<2s expected)
- ✅ Background refreshes

**Skeleton Screen Design:**
```
VotingCardSkeleton:
┌───────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░              │ ← Gray gradient pulse
│ ░░░░░░░░░░░░░░░░                      │ ← Shimmer animation
│ ░░░░░░░░                              │
│ ░░░░░░░░░░░░░░░░░                     │
│ ░░░░░░░░░░░░                          │
└───────────────────────────────────────┘
```

**Shimmer Animation:**
```css
@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    #f0f0f0 0%,
    #f8f8f8 50%,
    #f0f0f0 100%
  );
  background-size: 1000px 100%;
  animation: shimmer 2s infinite;
}
```

---

### 4.3 Toast Notifications

**Use Cases:**
1. **Success**: Vote cast, vote revoked, voting created, settings saved
2. **Error**: API error, network failure, validation error
3. **Warning**: Rate limit, voting closing soon, permission issue
4. **Info**: Background refresh completed, new voting available

**Toast Anatomy:**
```
┌─────────────────────────────────────┐
│ ✓ Голос учтён                       │  ← Icon + Title
│   Your vote for "Zelda" was saved   │  ← Optional description
│   [Undo] [Close]                    │  ← Optional actions
└─────────────────────────────────────┘
```

**Auto-dismiss Rules:**
- Success: 3 seconds
- Info: 5 seconds
- Warning: 10 seconds (user should read)
- Error: Manual dismiss (user must acknowledge)

**Accessibility:**
- role="alert" for errors/warnings (interrupts screen reader)
- role="status" for success/info (polite announcement)
- aria-live="assertive" for critical errors
- Keyboard: Tab to focus actions, Escape to dismiss

---

### 4.4 Error Messages (Plain Language)

**Bad Error Messages:**
- ❌ "Error 403: Forbidden"
- ❌ "VOTE_ALREADY_CAST"
- ❌ "Unhandled exception in voting.service.ts:142"

**Good Error Messages:**
- ✅ "Голосование завершено. Вы можете посмотреть результаты."
- ✅ "Вы уже голосовали за этот вариант. Хотите изменить голос?"
- ✅ "Не получилось отправить голос. Проверьте интернет и попробуйте снова."

**Error Message Components:**
```typescript
interface ErrorMessage {
  title: string;        // Short, user-friendly title
  description?: string; // Detailed explanation (optional)
  action?: {            // Recovery action
    label: string;      // e.g., "Retry", "Login", "Contact Support"
    onClick: () => void;
  };
  severity: 'error' | 'warning' | 'info';
}
```

**Common Error Scenarios:**

| Error Code | User-Friendly Message | Recovery Action |
|------------|----------------------|-----------------|
| 401 Unauthorized | Требуется вход в систему | [Войти] button |
| 403 Forbidden | У вас нет прав для этого действия | [Запросить доступ] (optional) |
| 404 Not Found | Голосование не найдено или удалено | [Вернуться к списку] |
| 409 Conflict (ALREADY_VOTED) | Вы уже голосовали за другой вариант | [Изменить голос] (if allowed) |
| 429 Rate Limit | Слишком часто. Подождите {X} секунд | Countdown timer, auto-retry |
| 500 Server Error | Сервис временно недоступен | [Попробовать снова] |
| Network Error | Нет связи с сервером. Проверьте интернет | [Повторить] + offline queue |

---

### 4.5 Rate Limit Handling

**Current Implementation** (from votingApi.ts):
```typescript
export class RateLimitError extends Error {
  public retryAfter: number;  // seconds
  public limit: number;       // max requests
  public window: number;      // time window (seconds)
}
```

**UI Behavior:**
1. User exceeds rate limit (e.g., votes too quickly)
2. Server returns 429 with retry_after
3. Client catches RateLimitError
4. Vote button disabled + countdown timer shown
5. Toast: "Слишком часто. Подождите {countdown}s"
6. Countdown decrements every second
7. At 0, button re-enables + auto-retry queued vote

**Visual Design:**
```
┌─────────────────────────────────────┐
│ ⏱ Подождите 45s                     │  ← Countdown toast
│   Too many requests. Rate limit.    │
└─────────────────────────────────────┘

[Vote] → [⏱ 45s]  → [⏱ 44s] → ... → [Vote] (re-enabled)
```

**Accessibility:**
- aria-live="polite" for countdown updates (don't interrupt user)
- Disabled button has aria-label="Vote disabled, rate limit exceeded, retry in {X} seconds"

---

### 4.6 Inline Validation (Forms)

**Principle**: Validate on blur, show errors immediately (Shneiderman: Prevent Errors)

**Pattern** (using Zod + react-hook-form):
```typescript
const votingSchema = z.object({
  title: z.string().min(5, "Заголовок должен быть минимум 5 символов"),
  deadline: z.date().min(new Date(), "Дедлайн не может быть в прошлом"),
  visibility: z.enum(['public', 'community', 'team', 'private']),
});

const { register, formState: { errors } } = useForm({
  resolver: zodResolver(votingSchema),
  mode: 'onBlur', // Validate when user leaves field
});
```

**Visual Feedback:**
```
Title: [_____________________]  ✓ Valid
       5 characters minimum

Deadline: [Jan 32, 2025______]  ✗ Invalid date
          ⚠ Please enter a valid date

Visibility: ⦿ Public  ◯ Community  ◯ Team  ◯ Private
```

**Error Display:**
- ✓ Green checkmark for valid fields
- ✗ Red X for invalid fields
- ⚠ Yellow warning icon for warnings
- Error text below field (red color, small font)
- Input border turns red on error

**Accessibility:**
- aria-invalid="true" on invalid inputs
- aria-describedby pointing to error message ID
- Error message has role="alert" (announced immediately)

---

## 5. Accessibility (WCAG 2.1 AA Compliance)

### 5.1 Keyboard Navigation

**Global Shortcuts:**
- Tab: Navigate forward through interactive elements
- Shift+Tab: Navigate backward
- Enter/Space: Activate buttons, links, checkboxes
- Escape: Close modals, dismiss toasts
- Arrow keys: Navigate lists, pagination, radio groups

**Page-Specific Shortcuts:**

**Home Page:**
- Tab: Move between voting cards
- Enter: Navigate to voting detail
- Arrow Down/Up: Scroll voting list (optional)

**Nomination Page:**
- Tab: Move between option cards
- Space/Enter: Vote for focused option
- Arrow Left/Right: Navigate pagination (prev/next page)
- V: Quick vote for focused option (optional power user shortcut)
- R: Revoke vote (if on voted option)
- Escape: Close option modal

**Admin Pages:**
- Ctrl+S / Cmd+S: Save draft (create/edit voting)
- Ctrl+Enter / Cmd+Enter: Submit form

**Implementation:**
```typescript
// Keyboard event handler
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignore if user is typing in input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    
    switch (e.key) {
      case 'ArrowLeft':
        if (currentPage > 0) goToPreviousPage();
        break;
      case 'ArrowRight':
        if (currentPage < pageCount - 1) goToNextPage();
        break;
      case 'Escape':
        if (isModalOpen) closeModal();
        break;
      // ... other shortcuts
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [currentPage, pageCount, isModalOpen]);
```

---

### 5.2 ARIA Labels & Roles

**Semantic HTML First:**
```html
<!-- Prefer semantic HTML over ARIA -->
<nav>...</nav>           <!-- Better than <div role="navigation"> -->
<button>...</button>     <!-- Better than <div role="button"> -->
<main>...</main>         <!-- Better than <div role="main"> -->
```

**ARIA When Necessary:**

**VotingCard:**
```html
<article 
  role="article" 
  aria-labelledby="voting-title-123"
  aria-describedby="voting-meta-123">
  
  <h2 id="voting-title-123">Best Game of 2025</h2>
  <p id="voting-meta-123">Active, 2 days remaining, 5 nominations</p>
  
  <button aria-label="Vote in Best Game of 2025">
    Голосовать →
  </button>
</article>
```

**NominationCard (Radio):**
```html
<div role="radiogroup" aria-labelledby="nomination-title">
  <h3 id="nomination-title">Choose your favorite game</h3>
  
  <div 
    role="radio" 
    aria-checked="false"
    aria-labelledby="option-1-title"
    aria-describedby="option-1-votes"
    tabindex="0">
    
    <h4 id="option-1-title">The Legend of Zelda</h4>
    <span id="option-1-votes">456 votes, 45.6%</span>
    <button aria-label="Vote for The Legend of Zelda">Vote</button>
  </div>
</div>
```

**Loading States:**
```html
<button aria-busy="true" aria-label="Voting in progress">
  <span class="spinner" role="status">
    <span class="sr-only">Loading...</span>
  </span>
  Voting...
</button>
```

**Error States:**
```html
<input 
  type="text"
  aria-invalid="true"
  aria-describedby="title-error">
<p id="title-error" role="alert">
  Заголовок должен быть минимум 5 символов
</p>
```

---

### 5.3 Focus Management

**Principle**: Visible focus indicator + logical focus flow

**Focus Styles:**
```css
/* Default browser outline (don't remove!) */
:focus {
  outline: 2px solid var(--focus-color, #005fcc);
  outline-offset: 2px;
}

/* Enhanced focus for buttons */
button:focus-visible {
  outline: 3px solid var(--focus-color);
  outline-offset: 3px;
  box-shadow: 0 0 0 5px rgba(0, 95, 204, 0.1);
}

/* Never remove focus outline */
/* BAD: */
*:focus { outline: none; } /* ❌ Never do this */
```

**Focus Trapping (Modals):**
```typescript
// When modal opens, trap focus inside
const useFocusTrap = (isOpen: boolean, modalRef: RefObject<HTMLElement>) => {
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    
    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    // Focus first element on open
    firstElement?.focus();
    
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        // Shift+Tab: If on first, go to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab: If on last, go to first
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };
    
    modal.addEventListener('keydown', handleTab);
    return () => modal.removeEventListener('keydown', handleTab);
  }, [isOpen, modalRef]);
};
```

**Restore Focus After Modal:**
```typescript
// Save focus before opening modal
const previouslyFocusedElement = document.activeElement as HTMLElement;

// Open modal...

// On close, restore focus
const closeModal = () => {
  setIsModalOpen(false);
  previouslyFocusedElement?.focus();
};
```

---

### 5.4 Color Contrast (WCAG AA: 4.5:1 for text)

**Color Palette** (color-blind safe):
```css
:root {
  /* Status colors (distinguishable by brightness, not just hue) */
  --active-color: #16a34a;      /* Green (high contrast) */
  --upcoming-color: #2563eb;    /* Blue (high contrast) */
  --finished-color: #64748b;    /* Gray (medium contrast) */
  --error-color: #dc2626;       /* Red (high contrast) */
  --warning-color: #f59e0b;     /* Amber (high contrast on white) */
  
  /* Text colors */
  --text-primary: #1e293b;      /* Near-black, ratio 15:1 on white */
  --text-secondary: #475569;    /* Dark gray, ratio 7:1 on white */
  --text-tertiary: #94a3b8;     /* Light gray, ratio 4.5:1 on white */
  
  /* Background colors */
  --bg-white: #ffffff;
  --bg-gray-50: #f8fafc;
  --bg-gray-100: #f1f5f9;
}
```

**Contrast Checker Tool:**
```typescript
// Use in development to validate colors
const getContrastRatio = (fg: string, bg: string): number => {
  // Calculate relative luminance
  const getLuminance = (color: string) => {
    const rgb = parseInt(color.slice(1), 16);
    const r = ((rgb >> 16) & 0xff) / 255;
    const g = ((rgb >> 8) & 0xff) / 255;
    const b = ((rgb >> 0) & 0xff) / 255;
    
    const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  };
  
  const l1 = getLuminance(fg);
  const l2 = getLuminance(bg);
  
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

// Validate during build
if (process.env.NODE_ENV === 'development') {
  const textPrimaryRatio = getContrastRatio('#1e293b', '#ffffff');
  if (textPrimaryRatio < 4.5) {
    console.warn(`Text contrast too low: ${textPrimaryRatio.toFixed(2)}:1`);
  }
}
```

**Never Rely on Color Alone:**
```
❌ BAD:
  Active votings: Green background
  Finished votings: Gray background
  (Color-blind users can't distinguish)

✅ GOOD:
  Active votings: Green background + "Active" badge + countdown timer
  Finished votings: Gray background + "Finished" badge + end date
  (Multiple visual cues)
```

---

### 5.5 Skip Links

**Purpose**: Allow keyboard users to skip repetitive navigation

**Implementation:**
```html
<body>
  <a href="#main-content" class="skip-link">
    Skip to main content
  </a>
  
  <header>
    <nav>...</nav>
  </header>
  
  <main id="main-content" tabindex="-1">
    <!-- Main content here -->
  </main>
</body>
```

```css
.skip-link {
  position: absolute;
  top: -100px;
  left: 0;
  padding: 0.5rem 1rem;
  background: var(--active-color);
  color: white;
  text-decoration: none;
  z-index: 9999;
}

.skip-link:focus {
  top: 0;
  /* Visible when focused via Tab */
}
```

**Additional Skip Links:**
- Skip to voting list
- Skip to filters
- Skip to results chart
- Skip to pagination (if many options)

---

## 6. Mobile-First Design

### 6.1 Responsive Breakpoints

**Strategy**: Mobile-first CSS (default styles for mobile, enhance for larger screens)

```css
/* Mobile (default): 320px - 767px */
.voting-card {
  width: 100%;
  padding: 1rem;
  font-size: 14px;
}

/* Tablet: 768px - 1023px */
@media (min-width: 768px) {
  .voting-card {
    width: 48%;
    padding: 1.25rem;
    font-size: 16px;
  }
}

/* Desktop: 1024px+ */
@media (min-width: 1024px) {
  .voting-card {
    width: 32%;
    padding: 1.5rem;
    font-size: 16px;
  }
}
```

**Grid Layout:**
```css
.voting-grid {
  display: grid;
  gap: 1rem;
  
  /* Mobile: 1 column */
  grid-template-columns: 1fr;
  
  /* Tablet: 2 columns */
  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  /* Desktop: 3 columns */
  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

---

### 6.2 Touch-Friendly Design

**Tap Target Size** (WCAG: minimum 44×44px):
```css
button, a, .clickable {
  min-width: 44px;
  min-height: 44px;
  padding: 0.75rem 1rem; /* Ensures tap target */
}

/* Card hit area */
.voting-card {
  cursor: pointer;
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
}
```

**Swipe Gestures** (optional):
```typescript
// Swipe for pagination (mobile)
const useSwipeGesture = (onSwipeLeft: () => void, onSwipeRight: () => void) => {
  const [touchStart, setTouchStart] = useState(0);
  
  const handleTouchStart = (e: TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };
  
  const handleTouchEnd = (e: TouchEvent) => {
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    
    if (Math.abs(diff) > 50) { // Minimum swipe distance
      if (diff > 0) onSwipeLeft();  // Swipe left
      else onSwipeRight();          // Swipe right
    }
  };
  
  return { handleTouchStart, handleTouchEnd };
};
```

---

### 6.3 Mobile Navigation Patterns

**Breadcrumbs on Mobile:**
```
Desktop: Home > Best Game of 2025 > Action Games

Mobile:  < Back
         (Single back button, saves space)
```

**Filters/Sorts on Mobile:**
```
Desktop: [Status ▼] [Type ▼] [Sort by ▼]
         (Inline dropdowns)

Mobile:  [Filters & Sort]
         (Button opens bottom sheet with all options)
```

**Pagination on Mobile:**
```
Desktop: [< Prev]  Page 2 of 17  [Next >]

Mobile:  [< 2/17 >]
         (Compact pagination, swipe for next/prev)
```

---

## 7. Performance Optimization

### 7.1 Prefetch Strategy

**Predictive Loading** (load likely next pages):
```typescript
// Prefetch voting detail on card hover
const VotingCard: React.FC<VotingCardProps> = ({ voting }) => {
  const queryClient = useQueryClient();
  
  const handleMouseEnter = () => {
    // Prefetch voting detail
    queryClient.prefetchQuery({
      queryKey: votingKeys.votingDetail(voting.id),
      queryFn: () => fetchVotingDetail(voting.id),
      staleTime: 60_000, // Cache for 1 minute
    });
  };
  
  return (
    <div onMouseEnter={handleMouseEnter}>
      {/* Card content */}
    </div>
  );
};
```

**Link Prefetch:**
```typescript
// Prefetch on link hover (using Vite's prefetch)
<Link 
  to={`/votings/${voting.id}`}
  onMouseEnter={() => queryClient.prefetchQuery(...)}
>
  {voting.title}
</Link>
```

---

### 7.2 Lazy Loading

**Images:**
```tsx
<img 
  src={voting.imageUrl} 
  loading="lazy" 
  decoding="async"
  alt={voting.title}
/>
```

**Components (Code Splitting):**
```typescript
// Lazy load heavy components
const ResultsVisualization = lazy(() => import('./ResultsVisualization'));
const OptionModal = lazy(() => import('./OptionModal'));

// Use with Suspense
<Suspense fallback={<Spinner />}>
  <ResultsVisualization results={results} />
</Suspense>
```

**Route-based Code Splitting:**
```typescript
// routes.tsx
const HomePage = lazy(() => import('./pages/HomePage'));
const VotingPage = lazy(() => import('./pages/VotingPage'));
const NominationPage = lazy(() => import('./pages/NominationPage'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));

// Separate bundles for each route
```

---

### 7.3 Virtual Scrolling (for large lists)

**Use Case**: Nomination with 500+ options

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const OptionList: React.FC<{ options: Option[] }> = ({ options }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: options.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Estimated option card height
    overscan: 5, // Render 5 extra items above/below viewport
  });
  
  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <OptionCard option={options[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
};
```

**When to Use:**
- ✅ Lists with 100+ items
- ✅ Fixed-height items (or estimateSize)
- ❌ Lists with <50 items (pagination is simpler)

---

### 7.4 Bundle Size Optimization

**Tree Shaking:**
```typescript
// ❌ BAD: Imports entire library
import _ from 'lodash';

// ✅ GOOD: Import only what you need
import debounce from 'lodash/debounce';
```

**Dynamic Imports:**
```typescript
// Load chart library only when showing results
const loadChartLibrary = async () => {
  const { BarChart } = await import('recharts');
  return BarChart;
};
```

**Target Bundle Sizes:**
- Main bundle: <300 KB (gzipped)
- Voting module: <100 KB (gzipped)
- Admin module: <150 KB (gzipped, lazy loaded)

**Verification:**
```bash
npm run build
npm run analyze  # Visualize bundle size
```

---

## 8. Implementation Checklist

### Phase 1: UX Foundation ✅
- [x] User flows documented
- [x] Information architecture defined
- [x] Design principles established
- [x] Feedback system specified

### Phase 2-8: To Be Completed During Implementation
(Checklist will be updated as implementation progresses)

---

## 9. References & Resources

**Academic Papers:**
- Nielsen, J. (1994). "10 Usability Heuristics for User Interface Design"
- Shneiderman, B. (1987). "Designing the User Interface"
- WCAG 2.1 Guidelines (W3C)

**Voting UI Patterns:**
- GOV.UK Design System - Voting and Elections
- Material Design - Selection Controls
- Apple Human Interface Guidelines - Pickers

**Code References:**
- TanStack Query Docs - Optimistic Updates
- React Accessibility Guide
- Recharts Documentation

---

**Document Status**: Implementation Ready  
**Next Steps**: Begin Phase 2 (API Layer Implementation)
