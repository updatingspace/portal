# Information Architecture: Settings & Preferences

## Overview

This document defines the information architecture for the **Settings & Preferences** section of UpdSpace Portal, following principles of **progressive disclosure**, **cognitive load reduction**, and **Nielsen's Usability Heuristic #6: Recognition rather than recall**.

Based on user personas (Alex - Admin, Maria - User) and their journeys.

---

## IA Principles

### 1. Progressive Disclosure
- Show essential options first, advanced options on demand
- Group related settings to reduce cognitive load
- Use expandable sections for power users

### 2. Consistency (Jakob's Law)
- Settings structure follows industry standards (Slack, Discord, GitHub)
- Tab navigation: Appearance | Notifications | Privacy | Dashboard
- Common patterns: toggles for binary choices, dropdowns for lists, sliders for ranges

### 3. Feedback & Visibility
- Auto-save with visual feedback ("Saving..." → "Saved ✓")
- Preview changes in real-time (theme, font size)
- Clear labels and help text for each option

### 4. Error Prevention
- Inline validation (invalid timezone → immediate error message)
- Confirmation dialogs for destructive actions (Delete Account)
- Disable dependent options when master toggle is OFF

---

## Navigation Structure

```
Settings (Page)
│
├── Tabs (Primary Navigation)
│   ├── Appearance
│   ├── Notifications
│   ├── Privacy
│   └── Dashboard (Iteration 2)
│
└── Global Actions
    ├── Reset to Defaults
    └── Close (back to Dashboard)
```

**URL Structure:**
- `/settings` → defaults to Appearance tab
- `/settings?tab=appearance`
- `/settings?tab=notifications`
- `/settings?tab=privacy`
- `/settings?tab=dashboard` (Iteration 2)

**Breadcrumbs:**
`Home > Settings > Appearance`

---

## Tab 1: Appearance

**Goal:** Control visual theme, language, and accessibility options

### Content Hierarchy

```
Appearance
│
├── Theme Section
│   ├── Theme Mode (Light | Dark | Auto)
│   ├── Accent Color (Preset picker: Purple, Blue, Green, Red, Orange)
│   └── High Contrast Mode (Toggle)
│
├── Typography Section
│   ├── Font Size (Slider: Small | Medium | Large)
│   └── Reduce Motion (Toggle - for accessibility)
│
├── Localization Section
│   ├── Language (Dropdown: English | Русский)
│   └── Timezone (Dropdown with search: UTC, Europe/Moscow, America/New_York...)
│
└── Advanced Options (Expandable)
    ├── Custom CSS (Textarea - for power users)
    └── Reset Appearance to Defaults (Button)
```

### Field Details

| Field | Type | Default | Validation | Help Text |
|-------|------|---------|-----------|-----------|
| Theme Mode | Radio Group | Auto | Required | "Auto follows your system preference" |
| Accent Color | Color Picker | Purple (#8B5CF6) | Hex or preset | "Used for buttons, links, and highlights" |
| High Contrast Mode | Toggle | OFF | - | "Increases contrast for better readability" |
| Font Size | Slider | Medium | Small/Med/Large | "Scales all text. Affects readability." |
| Reduce Motion | Toggle | OFF | - | "Reduces animations for accessibility" |
| Language | Dropdown | EN | Required | "Changes interface language. Requires reload." |
| Timezone | Dropdown | Auto-detect | IANA timezone | "Used for event times and deadlines" |

**Auto-Save Logic:**
- Debounce 500ms after last change
- Save to backend + localStorage (fallback)
- Show "Saving..." indicator during API call
- Show "Saved ✓" for 2 seconds after success

**Accessibility:**
- Keyboard navigation: Tab to next field, Shift+Tab to previous
- Screen reader: "Theme mode, Dark selected, 1 of 3"
- Focus indicators: 2px solid outline on focused element

---

## Tab 2: Notifications

**Goal:** Granular control over notification types and delivery channels

### Content Hierarchy

```
Notifications
│
├── Delivery Channels Section
│   ├── Email Notifications (Master Toggle)
│   ├── In-App Notifications (Master Toggle)
│   └── Push Notifications (Master Toggle - disabled for MVP)
│
├── Notification Types (Grouped by Category)
│   │
│   ├── Polls
│   │   ├── New vote cast (Toggle + Channels)
│   │   ├── Poll closing soon (Toggle + Channels)
│   │   └── Results published (Toggle + Channels)
│   │
│   ├── Events
│   │   ├── New event created (Toggle + Channels)
│   │   ├── RSVP reminder (Toggle + Channels)
│   │   └── Event starting soon (Toggle + Channels)
│   │
│   ├── Community
│   │   ├── New member joined (Toggle + Channels)
│   │   ├── Post flagged for review (Toggle + Channels)
│   │   └── You were mentioned (Toggle + Channels)
│   │
│   └── System
│       ├── Security alerts (Toggle + Channels - always ON for email)
│       └── Product updates (Toggle + Channels)
│
├── Frequency Control Section
│   ├── Email Digest (Dropdown: Instant | Hourly | Daily | Weekly)
│   └── Quiet Hours (Time Range Picker: 22:00 - 08:00)
│
└── Actions
    ├── Apply Preset: Admin | User | Minimal
    ├── Send Test Notification (Button)
    └── Reset Notifications to Defaults (Button)
```

### Field Details

| Field | Type | Default | Validation | Help Text |
|-------|------|---------|-----------|-----------|
| Email Notifications | Toggle | ON | - | "Receive notifications via email" |
| In-App Notifications | Toggle | ON | - | "See notifications in the app" |
| New vote cast | Toggle + Checkboxes | ON (Email + In-App) | - | "When someone votes on your poll" |
| Poll closing soon | Toggle + Checkboxes | ON (Email + In-App) | - | "1 hour before poll closes" |
| Email Digest | Dropdown | Instant | Required | "Group non-critical emails into digest" |
| Quiet Hours | Time Range | OFF | Valid time range | "No notifications during these hours" |

**Presets:**

**Admin Preset:**
- Polls: All ON (Email + In-App)
- Events: All ON
- Community: Post flagged ON, New member OFF
- Email Digest: Instant

**User Preset:**
- Polls: New vote OFF, Closing soon ON, Results ON
- Events: All ON
- Community: Mention ON, others OFF
- Email Digest: Daily

**Minimal Preset:**
- Only critical: Security alerts, Event starting soon
- Email Digest: Weekly

**Dependency Logic:**
- If "Email Notifications" toggle is OFF → gray out all Email checkboxes
- If notification type toggle is OFF → gray out channel checkboxes

**Accessibility:**
- Grouped sections with clear headings (`<fieldset>` + `<legend>`)
- Toggle state announced: "Email notifications enabled"

---

## Tab 3: Privacy

**Goal:** Control data collection, profile visibility, and GDPR compliance

### Content Hierarchy

```
Privacy
│
├── Profile Visibility Section
│   ├── Profile Visibility (Radio Group: Public | Members Only | Private)
│   ├── Show Online Status (Toggle)
│   └── Show Vote History (Toggle)
│
├── Activity Sharing Section
│   ├── Share Activity in Feed (Toggle)
│   ├── Allow Mentions (Toggle)
│   └── Show Last Seen (Toggle)
│
├── Data Collection Section
│   ├── Analytics & Usage Data (Toggle - required for platform)
│   ├── Personalized Recommendations (Toggle)
│   └── Third-Party Integrations (Toggle)
│
├── GDPR Compliance Section
│   ├── Download My Data (Button → triggers export)
│   ├── Data Retention Policy (Link to policy page)
│   └── Delete Account (Button → confirmation modal)
│
└── Advanced Options (Expandable)
    ├── Session Timeout (Dropdown: 1h | 4h | 24h | Never)
    └── Two-Factor Authentication (Link to UpdSpaceID settings)
```

### Field Details

| Field | Type | Default | Validation | Help Text |
|-------|------|---------|-----------|-----------|
| Profile Visibility | Radio Group | Members Only | Required | "Who can see your profile page" |
| Show Online Status | Toggle | ON | - | "Let others see when you're active" |
| Show Vote History | Toggle | OFF | - | "Display your voting record on profile" |
| Analytics & Usage Data | Toggle | ON (locked) | Cannot disable | "Required for platform improvement" |
| Personalized Recommendations | Toggle | ON | - | "Use your activity to suggest content" |
| Download My Data | Button | - | - | "Export all your data as JSON" |
| Delete Account | Button | - | Requires confirmation | "Permanently delete your account" |

**Delete Account Flow:**
1. Click "Delete Account" button
2. Modal appears: "Are you sure? This action cannot be undone."
3. Enter password to confirm
4. Click "Delete Permanently" → account marked for deletion (7-day grace period)
5. Receive email with cancellation link

**Accessibility:**
- Clear warnings for destructive actions
- Modal focus trap: Tab cycles within modal
- Esc key closes modal without action

---

## Tab 4: Dashboard (Iteration 2)

**Goal:** Customize dashboard widgets and layout

### Content Hierarchy

```
Dashboard
│
├── Layout Section
│   ├── Layout Preset (Grid: Compact | Balanced | Spacious)
│   └── Widget Grid (Drag-and-drop interface)
│
├── Widget Library Section
│   ├── Available Widgets (Cards to drag)
│   │   ├── Active Polls
│   │   ├── Upcoming Events
│   │   ├── Recent Activity
│   │   ├── Member Stats (Admin only)
│   │   └── Quick Actions
│   │
│   └── My Widgets (Currently on dashboard)
│
├── Customization Section
│   ├── Default View (Dropdown: Grid | List | Calendar)
│   └── Auto-Refresh Interval (Dropdown: OFF | 30s | 1m | 5m)
│
└── Actions
    ├── Reset to Default Layout (Button)
    └── Preview Dashboard (Link)
```

**Note:** Full implementation in Iteration 2

---

## Global UI Patterns

### Auto-Save Indicator

```
┌─────────────────────────────────┐
│ [Icon] Saving...                │  ← During save
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ [✓] Saved                       │  ← After success (2s)
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ [!] Failed to save. Retry?      │  ← On error
└─────────────────────────────────┘
```

### Confirmation Modal Pattern

```
┌──────────────────────────────────┐
│  Delete Account?                 │
│  ─────────────────────────────── │
│  This action cannot be undone.   │
│  All your data will be deleted.  │
│                                  │
│  [Cancel]  [Delete Permanently]  │
└──────────────────────────────────┘
```

### Validation Pattern

```
Email Notifications
[Toggle ON]

Email Digest
[Dropdown: Daily ▼]
✓ Non-critical emails grouped daily  ← Success feedback

Invalid Timezone
[Dropdown: America/Invalid ▼]
⚠ Please select a valid timezone     ← Error feedback
```

---

## Responsive Behavior

### Desktop (>1024px)
- Tabs displayed horizontally
- Settings form in centered column (max-width: 800px)
- Two-column layout for some sections (e.g., toggles in grid)

### Tablet (768px - 1024px)
- Tabs remain horizontal
- Single-column form layout
- Slightly reduced padding

### Mobile (<768px)
- Tabs switch to vertical accordion OR dropdown selector
- Full-width form fields
- Sticky "Save" button at bottom (if manual save needed)
- Collapsible sections to reduce scrolling

---

## Search & Quick Access (Future Enhancement)

**Settings Search Bar:**
- Global search: "Type to find a setting..."
- Fuzzy search: "notif" → highlights Notifications tab
- Keyboard shortcut: Cmd/Ctrl + K to open search

**Quick Settings Menu:**
- Accessible from any page via keyboard shortcut
- Toggle theme (Light/Dark) without opening full Settings
- Toggle notifications ON/OFF

---

## State Management

### Frontend State

```typescript
interface UserPreferences {
  appearance: {
    theme: 'light' | 'dark' | 'auto';
    accentColor: string;
    fontSize: 'small' | 'medium' | 'large';
    highContrast: boolean;
    reduceMotion: boolean;
  };
  localization: {
    language: 'en' | 'ru';
    timezone: string; // IANA timezone
  };
  notifications: {
    email: {
      enabled: boolean;
      digest: 'instant' | 'hourly' | 'daily' | 'weekly';
    };
    inApp: {
      enabled: boolean;
    };
    types: {
      polls: {
        newVote: { enabled: boolean; channels: string[] };
        closingSoon: { enabled: boolean; channels: string[] };
        resultsPublished: { enabled: boolean; channels: string[] };
      };
      events: { /* ... */ };
      community: { /* ... */ };
    };
    quietHours: {
      enabled: boolean;
      start: string; // HH:mm
      end: string;
    };
  };
  privacy: {
    profileVisibility: 'public' | 'members' | 'private';
    showOnlineStatus: boolean;
    showVoteHistory: boolean;
    shareActivity: boolean;
    allowMentions: boolean;
    analytics: boolean;
    recommendations: boolean;
  };
}
```

### Backend API

**GET** `/api/personalization/preferences`
- Returns current user preferences for active tenant
- Includes default values for unset fields

**PUT** `/api/personalization/preferences`
- Updates preferences (partial update supported)
- Validates fields via Pydantic schema
- Returns updated preferences

**GET** `/api/personalization/preferences/defaults`
- Returns default preferences (new user or reset)
- Includes role-based defaults (admin vs user)

---

## Analytics & Metrics

### Track User Behavior
- Most changed settings (to prioritize in UI)
- Time to complete setup (UX metric)
- Error rates (validation failures)
- A/B test: Tab order (Appearance first vs Notifications first)

### Success Metrics
- % users who customize theme (target: >60%)
- % users who reduce notifications (target: >40%)
- Average time to find a setting (target: <30 seconds)

---

## Accessibility Checklist

### WCAG 2.1 AA Compliance

- [x] **Keyboard Navigation:** All interactive elements accessible via Tab
- [x] **Focus Indicators:** Visible 2px outline on focus
- [x] **Screen Reader:** Semantic HTML (`<nav>`, `<section>`, `<fieldset>`)
- [x] **ARIA Labels:** All toggles, buttons, inputs have labels
- [x] **Color Contrast:** Text 4.5:1, UI elements 3:1
- [x] **Error Messages:** Inline and screen-reader accessible
- [x] **Confirmation Modals:** Focus trap, Esc to close
- [x] **Form Validation:** Real-time feedback for errors

### Testing
- Lighthouse Accessibility Score: >95
- axe DevTools: 0 violations
- Manual keyboard test: Complete all journeys without mouse
- Screen reader test: NVDA on Windows, VoiceOver on macOS

---

## Next Steps

1. **wireframes-settings:** Create visual wireframes for each tab
2. **ui-kit-personalization:** Build reusable components (ThemeToggle, NotificationGroup, etc.)
3. **model-user-preference:** Implement backend Django model
4. **api-preferences:** Develop REST API endpoints
