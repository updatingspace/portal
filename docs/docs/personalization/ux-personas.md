# UX Personas & User Journeys - Personalization

## Overview

This document defines user personas and key user journeys for the UpdSpace Portal personalization features, focusing on **Settings & Preferences**, **Theme Customization**, and **Dashboard Personalization**.

Methodology: Based on **Nielsen's 10 Usability Heuristics**, **Jakob's Law** (users prefer familiar patterns), and **WCAG 2.1 AA** accessibility standards.

---

## Personas

### Persona 1: Alex Chen - Community Admin

**Demographics:**
- Age: 28
- Role: Community Administrator at "Alliance of Eternal Fighters" (AEF) gaming clan
- Technical Skills: Intermediate (comfortable with web apps, not a developer)
- Gaming Background: 10+ years, competitive MOBA player
- Time on Platform: 3-4 hours/day

**Goals:**
- Manage community announcements and polls efficiently
- Monitor member engagement through analytics
- Customize community appearance to match clan branding (dark theme, AEF colors)
- Receive instant notifications for critical events (new poll votes, urgent messages)

**Pain Points:**
- Too many notifications overwhelming inbox
- Default light theme causes eye strain during late-night admin sessions
- Important analytics buried in generic dashboards
- No quick way to switch between different communities (multi-tenant context)

**Context:**
- Uses platform on desktop (primary) and mobile (for urgent checks)
- Often works in low-light environments (evening gaming sessions)
- Needs quick access to moderation tools and member activity

**Persona Quote:**
> "I need my dashboard to show what matters RIGHT NOW - active polls, new signups, flagged content. And please, a dark theme that doesn't burn my eyes at 2 AM."

---

### Persona 2: Maria Santos - Regular User

**Demographics:**
- Age: 22
- Role: Active community member in 2 gaming communities
- Technical Skills: Basic (uses web apps, prefers simple UIs)
- Gaming Background: 4 years, casual RPG and strategy games
- Time on Platform: 1-2 hours/day

**Goals:**
- Stay updated on community events and polls
- Participate in votes without missing deadlines
- Customize theme to match personal preferences (prefers light theme, larger fonts)
- Control notification frequency (doesn't want spam)

**Pain Points:**
- Gets too many email notifications, misses important ones
- Small font sizes hard to read on mobile
- Confused by complex settings with technical jargon
- Doesn't know how to change language from English to Russian

**Context:**
- Uses platform 60% mobile, 40% desktop
- Prefers simple, clear interfaces (Jakob's Law: familiar patterns)
- Needs accessibility: larger fonts, high contrast

**Persona Quote:**
> "I just want to vote on polls and see when events happen. Keep it simple - I don't need a million settings, just the essentials."

---

## User Journeys

### Journey A1: Alex (Admin) - First-Time Theme Setup

**Goal:** Configure dark theme and custom accent color for late-night admin work

**Steps:**
1. **Entry:** Alex logs in at 11 PM, default light theme is too bright
2. **Discovery:** Notices profile icon → clicks → sees "Settings" option
3. **Navigation:** Opens Settings → lands on "Appearance" tab (default)
4. **Theme Selection:** 
   - Sees theme toggle: Light | **Dark** | Auto
   - Clicks "Dark" → page instantly switches to dark theme
   - Visual feedback: smooth transition, no jarring flash
5. **Accent Color:** 
   - Sees accent color picker with preset options
   - Selects AEF brand color (#8B5CF6 - purple)
   - Previews immediately on page elements
6. **Font Size:**
   - Notices font size slider (Small | Medium | Large)
   - Keeps default Medium
7. **Auto-Save:**
   - Sees subtle "Saving..." indicator → "Saved ✓"
   - No manual "Save" button needed (Heuristic: User control with automation)
8. **Verification:**
   - Navigates to Dashboard → dark theme persists
   - Refreshes page → settings remain (localStorage + backend sync)

**Success Metrics:**
- Time to complete: < 2 minutes
- No errors or confusion
- Settings persist across sessions

**Accessibility Considerations:**
- Keyboard navigation: Tab through options, Enter to select
- Screen reader: "Theme selector, Dark mode selected"
- Color contrast: Dark theme meets WCAG AA (4.5:1 ratio)

---

### Journey A2: Alex (Admin) - Notification Preferences Tuning

**Goal:** Reduce notification noise while keeping critical alerts

**Steps:**
1. **Entry:** Alex overwhelmed by 50+ daily notifications
2. **Navigation:** Settings → "Notifications" tab
3. **Granular Controls:**
   - Sees grouped toggles:
     - **Polls:** New vote ✓ | Poll closing soon ✓ | Results published ✗
     - **Events:** New event ✓ | RSVP reminder ✓ | Event starting ✓
     - **Community:** New member ✗ | Post flagged ✓ | Mention ✓
   - Delivery Channels: Email ✓ | In-App ✓ | Push ✗
4. **Smart Defaults:**
   - Admin preset: Critical notifications ON, non-critical OFF
   - "Apply Admin Preset" button for quick setup
5. **Frequency Control:**
   - Email digest: Instant | Hourly | Daily | Weekly
   - Selects "Hourly" for non-critical
6. **Preview:**
   - "Send Test Notification" button → receives sample
   - Confirms settings work as expected
7. **Auto-Save:** Changes saved automatically with debounce

**Success Metrics:**
- Notification volume reduced by 60%
- Zero missed critical alerts
- Setup time: < 3 minutes

---

### Journey A3: Alex (Admin) - Dashboard Customization (Iteration 2 preview)

**Goal:** Create custom dashboard with most-used widgets

**Steps:**
1. Settings → "Dashboard" tab
2. Sees widget library: Active Polls | Recent Events | Member Activity | Analytics
3. Drag-and-drop widgets to grid layout
4. Resize and reorder based on priority
5. Save custom layout → applies to all sessions

**Note:** Full implementation in Iteration 2

---

### Journey A4: Alex (Admin) - Multi-Tenant Context Switch

**Goal:** Quickly switch between managing different communities

**Steps:**
1. Dashboard shows community selector dropdown (top nav)
2. Click selector → sees list of communities Alex manages
3. Select "Eternal Champions" → context switches
4. Personalization settings **per-tenant:** AEF uses dark theme, EC uses light
5. Dashboard widgets specific to current tenant

**Technical:** `tenant_id` in UserPreference model enables per-tenant settings

---

### Journey A5: Alex (Admin) - Accessibility Features Discovery

**Goal:** Enable high-contrast mode for better readability

**Steps:**
1. Settings → "Appearance" → "Accessibility Options"
2. Toggle "High Contrast Mode" ✓
3. Increase font size to "Large"
4. Enable "Reduce Motion" (for users with vestibular disorders)
5. Changes apply immediately across all pages

**WCAG 2.1 AA Compliance:**
- Contrast ratios: 7:1 (AAA level for high contrast)
- Font size: Minimum 16px, scalable to 200%
- Motion: respects `prefers-reduced-motion` media query

---

### Journey M1: Maria (User) - Quick Language Switch

**Goal:** Change interface from English to Russian

**Steps:**
1. **Entry:** Maria joins Russian-speaking community
2. **Discovery:** Settings → "Appearance" tab
3. **Language Selector:**
   - Dropdown: English | Русский
   - Selects "Русский"
   - Entire UI re-renders in Russian (i18n)
4. **Persistence:** Language saved to UserPreference
5. **Timezone Auto-Detect:**
   - Sees timezone: "Europe/Moscow (GMT+3)"
   - Option to change if traveling

**Success Metrics:**
- Language switch: < 10 seconds
- No broken translations (i18n coverage: 100%)

---

### Journey M2: Maria (User) - Notification Overload Fix

**Goal:** Stop receiving email spam, keep in-app notifications only

**Steps:**
1. **Entry:** Maria receives 20+ emails/day, inbox cluttered
2. **Navigation:** Settings → "Notifications" tab
3. **Simple Toggle:**
   - Sees "Email Notifications" master toggle → OFF
   - Individual toggles grayed out (Heuristic: Prevent errors)
   - "In-App Notifications" → ON
4. **Confirmation:**
   - Modal: "You won't receive emails. Continue?" → Yes
   - Success message: "Email notifications disabled"
5. **Result:** Maria now sees notifications only when logged in

**Accessibility:**
- Modal has clear "Yes" / "Cancel" buttons
- Keyboard: Esc to cancel, Enter to confirm

---

### Journey M3: Maria (User) - Mobile Theme Preference

**Goal:** Use light theme on mobile (outdoor use), dark on desktop

**Steps:**
1. **Context:** Maria uses mobile during day (bright sun), desktop at night
2. **Auto Theme:**
   - Settings → Appearance → Theme: "Auto (follows system)"
   - Mobile OS set to Light (daytime) → UpdSpace uses Light
   - Desktop OS set to Dark (evening) → UpdSpace uses Dark
3. **Override:**
   - Option to override: "Force Light on Mobile"
   - UserPreference stores device-specific settings (future enhancement)

**Technical:** CSS `prefers-color-scheme` media query + localStorage

---

### Journey M4: Maria (User) - Privacy Settings

**Goal:** Control profile visibility and data collection

**Steps:**
1. Settings → "Privacy" tab
2. Toggles:
   - **Profile Visibility:** Public | Members Only | Private
   - Selects "Members Only" (visible to community members, not search engines)
   - **Activity Sharing:** Show online status ✗ | Show vote history ✗
   - **Data Collection:** Analytics ✓ | Personalized Recommendations ✓
3. **Clear Explanations:**
   - Tooltips explain what each setting does
   - "Why we collect data" link to privacy policy
4. **GDPR Compliance:**
   - "Download My Data" button
   - "Delete Account" option (with confirmation)

---

### Journey M5: Maria (User) - Accessibility: Font Size Increase

**Goal:** Make text easier to read on mobile

**Steps:**
1. Settings → Appearance
2. Font Size slider: **Small | Medium | Large**
3. Drags to "Large" → all text scales up 125%
4. Previews on Settings page immediately
5. Navigates to Dashboard → larger fonts throughout app

**WCAG Success Criterion 1.4.4:**
- Text resizable to 200% without loss of functionality

---

## Cross-Journey Patterns

### Consistency (Jakob's Law)
- Settings always accessible via Profile → Settings
- Tab structure: Appearance | Notifications | Privacy | Dashboard
- Auto-save with visual feedback (no manual Save button confusion)

### Error Prevention (Heuristic #5)
- Dangerous actions (Delete Account) require confirmation
- Invalid inputs show inline validation before submission
- Master toggles disable dependent options

### User Control & Freedom (Heuristic #3)
- All changes reversible (Edit → Revert)
- "Reset to Defaults" button in each tab
- Preview mode before applying changes

### Accessibility (WCAG 2.1 AA)
- Keyboard navigation: Tab, Enter, Esc
- Screen reader: semantic HTML, ARIA labels
- Color contrast: 4.5:1 minimum (text), 3:1 (UI elements)
- Focus indicators: visible outlines

---

## Key Insights for Implementation

### Backend (Access Service)
- **UserPreference model:** Store user_id, tenant_id, theme, language, timezone, notification_settings (JSON)
- **Per-tenant settings:** Dark theme for AEF, Light for EC (Alex's use case)
- **Defaults API:** GET /api/personalization/preferences/defaults for new users

### Frontend (Portal Frontend)
- **Feature structure:** `src/features/personalization/`
- **Tab navigation:** React Router with query params (?tab=appearance)
- **Auto-save:** Debounce (500ms) after input change
- **Theme switching:** CSS custom properties + `<html data-theme="dark">`
- **i18n:** react-i18next with EN/RU translations

### Testing
- **E2E Journey:** Automate Journey A1 (theme setup) with Playwright
- **Accessibility:** axe-core automated checks + manual keyboard testing
- **Responsive:** Test on mobile viewport (360x640) and desktop (1920x1080)

---

## Next Steps

1. **ia-settings:** Design information architecture for Settings tabs
2. **wireframes-settings:** Create wireframes for Appearance, Notifications, Privacy screens
3. **ui-kit-personalization:** Build reusable UI components (ThemeToggle, ColorPicker, ToggleGroup)
