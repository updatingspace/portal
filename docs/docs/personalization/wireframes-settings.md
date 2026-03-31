# Wireframes: Settings & Preferences

## Overview

Visual wireframes for Settings & Preferences screens, based on IA document. These are **low-fidelity ASCII wireframes** for rapid prototyping and developer handoff.

Implementation target: Desktop-first (responsive design), React components, TailwindCSS styling.

---

## Wireframe 1: Settings - Appearance Tab

```
┌────────────────────────────────────────────────────────────────────────┐
│  UpdSpace Portal                    [Search] [@Alex Chen ▾] [🔔]       │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Home > Settings                                                        │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                          Settings                                 │ │
│  ├──────────────────────────────────────────────────────────────────┤ │
│  │  [Appearance] [Notifications] [Privacy] [Dashboard]              │ │
│  ├──────────────────────────────────────────────────────────────────┤ │
│  │                                                                   │ │
│  │  THEME                                                            │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  Theme Mode                                              │    │ │
│  │  │  ○ Light   ⦿ Dark   ○ Auto (follows system)             │    │ │
│  │  │                                                           │    │ │
│  │  │  ───────────────────────────────────────────────────────│    │ │
│  │  │  [Preview: Page background changes to dark immediately]  │    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  Accent Color                                            │    │ │
│  │  │  [●Purple] [○Blue] [○Green] [○Red] [○Orange]            │    │ │
│  │  │  Custom: [#8B5CF6] [Color Picker]                        │    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  [✓] High Contrast Mode                                  │    │ │
│  │  │  Increases contrast for better readability               │    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                                                                   │ │
│  │  TYPOGRAPHY                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  Font Size                                               │    │ │
│  │  │  Small ─────●────── Large                                │    │ │
│  │  │         (Medium)                                         │    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  [✓] Reduce Motion                                       │    │ │
│  │  │  Minimizes animations for accessibility                  │    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                                                                   │ │
│  │  LOCALIZATION                                                     │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  Language                                                │    │ │
│  │  │  [English ▾]                                             │    │ │
│  │  │  └─ English                                              │    │ │
│  │  │     Русский                                              │    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  Timezone                                                │    │ │
│  │  │  [Europe/Moscow (GMT+3) ▾]                               │    │ │
│  │  │  Auto-detected from your system                          │    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                                                                   │ │
│  │  ─────────────────────────────────────────────────────────────  │ │
│  │  ▾ Advanced Options                                              │ │
│  │                                                                   │ │
│  │  [Reset Appearance to Defaults]                                  │ │
│  │                                                                   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  [✓ Saved]                                               Auto-save ON  │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

**Component Breakdown:**
- `SettingsLayout`: Container with tabs
- `ThemeToggle`: Radio group for Light/Dark/Auto
- `AccentColorPicker`: Color preset selector + custom input
- `Checkbox`: High Contrast Mode, Reduce Motion
- `Slider`: Font Size
- `Dropdown`: Language, Timezone
- `SaveIndicator`: Bottom-right corner

**Interactions:**
1. Click "Dark" → Page theme switches immediately
2. Select accent color → Buttons/links change color in real-time
3. Move font size slider → Text scales on page
4. Change language → Confirmation modal: "Reload to apply?"

---

## Wireframe 2: Settings - Notifications Tab

```
┌────────────────────────────────────────────────────────────────────────┐
│  UpdSpace Portal                    [Search] [@Alex Chen ▾] [🔔]       │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Home > Settings > Notifications                                        │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                          Settings                                 │ │
│  ├──────────────────────────────────────────────────────────────────┤ │
│  │  [Appearance] [Notifications] [Privacy] [Dashboard]              │ │
│  ├──────────────────────────────────────────────────────────────────┤ │
│  │                                                                   │ │
│  │  DELIVERY CHANNELS                                                │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  [✓] Email Notifications                                 │    │ │
│  │  │  [✓] In-App Notifications                                │    │ │
│  │  │  [ ] Push Notifications (Coming soon)                    │    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                                                                   │ │
│  │  NOTIFICATION TYPES                                               │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  Polls                                                    │    │ │
│  │  │  ├─ [✓] New vote cast            [✓Email] [✓In-App]     │    │ │
│  │  │  ├─ [✓] Poll closing soon        [✓Email] [✓In-App]     │    │ │
│  │  │  └─ [ ] Results published        [ Email] [ In-App]     │    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  Events                                                   │    │ │
│  │  │  ├─ [✓] New event created        [✓Email] [✓In-App]     │    │ │
│  │  │  ├─ [✓] RSVP reminder            [✓Email] [✓In-App]     │    │ │
│  │  │  └─ [✓] Event starting soon      [✓Email] [✓In-App]     │    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  Community                                                │    │ │
│  │  │  ├─ [ ] New member joined        [ Email] [ In-App]     │    │ │
│  │  │  ├─ [✓] Post flagged             [✓Email] [✓In-App]     │    │ │
│  │  │  └─ [✓] You were mentioned       [✓Email] [✓In-App]     │    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  System                                                   │    │ │
│  │  │  ├─ [✓] Security alerts          [✓Email] [✓In-App]     │    │ │
│  │  │  │    (Always enabled for Email)                         │    │ │
│  │  │  └─ [✓] Product updates          [ Email] [✓In-App]     │    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                                                                   │ │
│  │  FREQUENCY CONTROL                                                │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  Email Digest                                            │    │ │
│  │  │  [Instant ▾]                                             │    │ │
│  │  │  └─ Instant                                              │    │ │
│  │  │     Hourly                                               │    │ │
│  │  │     Daily                                                │    │ │
│  │  │     Weekly                                               │    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  [ ] Quiet Hours                                         │    │ │
│  │  │  From [22:00] to [08:00]                                 │    │ │
│  │  │  No notifications during these hours                     │    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                                                                   │ │
│  │  PRESETS                                                          │ │
│  │  [Apply Admin Preset] [Apply User Preset] [Apply Minimal Preset] │ │
│  │                                                                   │ │
│  │  [Send Test Notification] [Reset to Defaults]                    │ │
│  │                                                                   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  [✓ Saved]                                               Auto-save ON  │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

**Component Breakdown:**
- `MasterToggle`: Email/In-App/Push toggles (disable dependent options)
- `NotificationGroup`: Expandable category (Polls, Events, Community, System)
- `NotificationRow`: Toggle + Channel checkboxes
- `DropdownButton`: Presets

**Interactions:**
1. Toggle "Email Notifications" OFF → All Email checkboxes grayed out
2. Click "Apply Admin Preset" → All settings update + "Preset applied ✓" toast
3. Click "Send Test Notification" → In-app notification appears: "This is a test"
4. Toggle notification type OFF → Channel checkboxes disabled

**Dependency Logic:**
```
Master Toggle (Email) = OFF
  └─> All [✓Email] checkboxes → disabled + grayed out

Notification Type (New vote cast) = OFF
  └─> [✓Email] [✓In-App] → disabled + grayed out
```

---

## Wireframe 3: Settings - Privacy Tab

```
┌────────────────────────────────────────────────────────────────────────┐
│  UpdSpace Portal                    [Search] [@Alex Chen ▾] [🔔]       │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Home > Settings > Privacy                                              │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                          Settings                                 │ │
│  ├──────────────────────────────────────────────────────────────────┤ │
│  │  [Appearance] [Notifications] [Privacy] [Dashboard]              │ │
│  ├──────────────────────────────────────────────────────────────────┤ │
│  │                                                                   │ │
│  │  PROFILE VISIBILITY                                               │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  Who can see your profile?                               │    │ │
│  │  │  ○ Public (Everyone, including search engines)           │    │ │
│  │  │  ⦿ Members Only (Logged-in community members)            │    │ │
│  │  │  ○ Private (Only you)                                    │    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                                                                   │ │
│  │  ACTIVITY SHARING                                                 │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  [✓] Show Online Status                                  │    │ │
│  │  │  Let others see when you're active                       │    │ │
│  │  │                                                           │    │ │
│  │  │  [ ] Show Vote History                                   │    │ │
│  │  │  Display your voting record on profile                   │    │ │
│  │  │                                                           │    │ │
│  │  │  [✓] Share Activity in Feed                              │    │ │
│  │  │  Your votes and RSVPs appear in community feed           │    │ │
│  │  │                                                           │    │ │
│  │  │  [✓] Allow Mentions                                      │    │ │
│  │  │  Others can @mention you in posts                        │    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                                                                   │ │
│  │  DATA COLLECTION                                                  │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  [✓] Analytics & Usage Data (Required) 🔒               │    │ │
│  │  │  Helps us improve the platform                           │    │ │
│  │  │                                                           │    │ │
│  │  │  [✓] Personalized Recommendations                        │    │ │
│  │  │  Use your activity to suggest relevant content           │    │ │
│  │  │                                                           │    │ │
│  │  │  [ ] Third-Party Integrations                            │    │ │
│  │  │  Share data with Steam, Discord, etc.                    │    │ │
│  │  │                                                           │    │ │
│  │  │  [Why we collect data] [Privacy Policy]                  │    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                                                                   │ │
│  │  GDPR COMPLIANCE                                                  │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  [Download My Data]                                      │    │ │
│  │  │  Export all your data as JSON (GDPR Article 20)          │    │ │
│  │  │                                                           │    │ │
│  │  │  [Data Retention Policy]                                 │    │ │
│  │  │  Learn how long we keep your data                        │    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                                                                   │ │
│  │  DANGER ZONE                                                      │ │
│  │  ┌─────────────────────────────────────────────────────────┐    │ │
│  │  │  [Delete Account]                                        │    │ │
│  │  │  ⚠️ This action cannot be undone                         │    │ │
│  │  └─────────────────────────────────────────────────────────┘    │ │
│  │                                                                   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  [✓ Saved]                                               Auto-save ON  │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

**Component Breakdown:**
- `RadioGroup`: Profile Visibility (Public/Members/Private)
- `Toggle`: Show Online Status, Vote History, etc.
- `LockedToggle`: Analytics (cannot be disabled, shows lock icon)
- `DangerButton`: Delete Account (red, requires confirmation)

**Interactions:**
1. Click "Delete Account" → Modal appears (see Wireframe 6)
2. Click "Download My Data" → Trigger backend export → Email sent with download link
3. Toggle "Analytics" → Disabled with tooltip: "Required for platform operation"

---

## Wireframe 4: Delete Account Confirmation Modal

```
┌────────────────────────────────────────────────────────────────────────┐
│  [Background dimmed]                                                    │
│                                                                         │
│         ┌──────────────────────────────────────────────┐              │
│         │  Delete Account?                             │              │
│         ├──────────────────────────────────────────────┤              │
│         │                                              │              │
│         │  ⚠️ This action cannot be undone.            │              │
│         │                                              │              │
│         │  All your data will be permanently deleted:  │              │
│         │  • Profile and settings                      │              │
│         │  • Votes and event RSVPs                     │              │
│         │  • Community posts and comments              │              │
│         │                                              │              │
│         │  You have a 7-day grace period to cancel     │              │
│         │  deletion. Check your email for details.     │              │
│         │                                              │              │
│         │  ──────────────────────────────────────────  │              │
│         │  Enter your password to confirm:             │              │
│         │  [                              ]            │              │
│         │                                              │              │
│         │  [Cancel]      [Delete Permanently]          │              │
│         │                      (disabled until password entered)      │
│         └──────────────────────────────────────────────┘              │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

**Component Breakdown:**
- `Modal`: Overlay with focus trap
- `PasswordInput`: Validates password before enabling Delete button
- `DangerButton`: "Delete Permanently" (enabled only when password valid)

**Interactions:**
1. Esc key → Close modal without action
2. Click "Cancel" → Close modal
3. Enter password → "Delete Permanently" button becomes enabled
4. Click "Delete Permanently" → API call → Success toast → Redirect to goodbye page

**Accessibility:**
- Modal traps focus (Tab cycles within modal)
- Esc to close
- Screen reader announces: "Delete account dialog. Warning: This action cannot be undone."

---

## Wireframe 5: Mobile - Appearance Tab (Responsive)

```
┌───────────────────────────────┐
│ ☰  Settings         [@Alex ▾] │
├───────────────────────────────┤
│                               │
│ [Appearance ▾]                │ ← Dropdown (mobile tabs)
│  Notifications                │
│  Privacy                      │
│  Dashboard                    │
│                               │
├───────────────────────────────┤
│ THEME                         │
│ ┌───────────────────────────┐ │
│ │ Theme Mode                 │ │
│ │ ○ Light                    │ │
│ │ ⦿ Dark                     │ │
│ │ ○ Auto                     │ │
│ └───────────────────────────┘ │
│                               │
│ ┌───────────────────────────┐ │
│ │ Accent Color               │ │
│ │ [●] [○] [○] [○] [○]       │ │
│ │ Purple Blue Green Red      │ │
│ └───────────────────────────┘ │
│                               │
│ ┌───────────────────────────┐ │
│ │ [✓] High Contrast Mode     │ │
│ └───────────────────────────┘ │
│                               │
│ TYPOGRAPHY                    │
│ ┌───────────────────────────┐ │
│ │ Font Size                  │ │
│ │ Small ──●── Large          │ │
│ └───────────────────────────┘ │
│                               │
│ [Scroll down for more...]     │
│                               │
└───────────────────────────────┘
```

**Responsive Adaptations:**
- Tabs → Dropdown selector
- Two-column layout → Single column
- Larger tap targets (minimum 44x44px)
- Full-width form fields
- Collapsible sections to reduce scrolling

---

## Wireframe 6: Toast Notifications (Feedback)

```
┌────────────────────────────────────────────────────────────────────────┐
│  [Top-right corner]                                                     │
│                                                                         │
│  ┌────────────────────────────────────┐                                │
│  │ ✓ Theme changed to Dark             │  ← Success toast              │
│  └────────────────────────────────────┘                                │
│                                         (Auto-dismiss after 3 seconds)  │
│                                                                         │
│  ┌────────────────────────────────────┐                                │
│  │ ⚠ Failed to save preferences       │  ← Error toast                 │
│  │   [Retry]                           │                                │
│  └────────────────────────────────────┘                                │
│                                         (Manual dismiss required)       │
│                                                                         │
│  ┌────────────────────────────────────┐                                │
│  │ ℹ Admin preset applied              │  ← Info toast                  │
│  └────────────────────────────────────┘                                │
│                                         (Auto-dismiss after 3 seconds)  │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

**Toast Types:**
- **Success:** Green background, checkmark icon
- **Error:** Red background, warning icon, manual dismiss
- **Info:** Blue background, info icon

---

## Wireframe 7: Auto-Save Indicator States

```
State 1: Idle (no changes)
┌──────────────────┐
│ Auto-save ON     │
└──────────────────┘

State 2: Saving (API call in progress)
┌──────────────────┐
│ [spinner] Saving...│
└──────────────────┘

State 3: Saved (success, 2 seconds)
┌──────────────────┐
│ [✓] Saved        │
└──────────────────┘

State 4: Error (API failed)
┌──────────────────┐
│ [!] Save failed  │
│ [Retry]          │
└──────────────────┘

State 5: Offline (no connection)
┌──────────────────┐
│ [⚠] Offline      │
│ Changes saved    │
│ locally          │
└──────────────────┘
```

---

## Design Tokens (Colors, Spacing, Typography)

### Colors (TailwindCSS)

**Light Theme:**
- Background: `bg-gray-50`
- Card: `bg-white` with `shadow-md`
- Text: `text-gray-900`
- Muted text: `text-gray-600`
- Border: `border-gray-200`
- Accent: `text-purple-600` (default accent)

**Dark Theme:**
- Background: `bg-gray-900`
- Card: `bg-gray-800` with `shadow-lg`
- Text: `text-gray-100`
- Muted text: `text-gray-400`
- Border: `border-gray-700`
- Accent: `text-purple-400`

**Accent Colors:**
- Purple: `#8B5CF6` (default)
- Blue: `#3B82F6`
- Green: `#10B981`
- Red: `#EF4444`
- Orange: `#F59E0B`

### Spacing
- Section margin: `mb-8` (32px)
- Card padding: `p-6` (24px)
- Input margin: `mb-4` (16px)
- Button padding: `px-4 py-2` (16px x 8px)

### Typography
- Section heading: `text-sm font-semibold uppercase tracking-wide text-gray-500`
- Label: `text-sm font-medium text-gray-700`
- Input: `text-base text-gray-900`
- Help text: `text-xs text-gray-500`

### Shadows
- Card: `shadow-md` (medium shadow)
- Modal: `shadow-2xl` (large shadow)
- Button hover: `shadow-sm`

---

## Component Specifications

### ThemeToggle (Radio Group)

```typescript
interface ThemeToggleProps {
  value: 'light' | 'dark' | 'auto';
  onChange: (value: 'light' | 'dark' | 'auto') => void;
}
```

**HTML Structure:**
```html
<fieldset>
  <legend class="sr-only">Theme Mode</legend>
  <div class="flex gap-4">
    <label>
      <input type="radio" name="theme" value="light" />
      <span>Light</span>
    </label>
    <label>
      <input type="radio" name="theme" value="dark" checked />
      <span>Dark</span>
    </label>
    <label>
      <input type="radio" name="theme" value="auto" />
      <span>Auto</span>
    </label>
  </div>
</fieldset>
```

**Accessibility:**
- Keyboard: Arrow keys navigate within group
- Screen reader: "Theme mode, Dark selected, 2 of 3"

---

### NotificationRow

```typescript
interface NotificationRowProps {
  label: string;
  helpText?: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  channels: {
    email: boolean;
    inApp: boolean;
  };
  onChannelChange: (channel: 'email' | 'inApp', enabled: boolean) => void;
  disabled?: boolean; // Master toggle off
}
```

**HTML Structure:**
```html
<div class="flex items-center justify-between">
  <div>
    <label>
      <input type="checkbox" checked />
      <span>New vote cast</span>
    </label>
    <p class="text-xs text-gray-500">When someone votes on your poll</p>
  </div>
  <div class="flex gap-2">
    <label>
      <input type="checkbox" checked />
      <span>Email</span>
    </label>
    <label>
      <input type="checkbox" checked />
      <span>In-App</span>
    </label>
  </div>
</div>
```

---

## Animation & Transitions

### Theme Switch
```css
html {
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

### Toast Enter/Exit
```css
.toast-enter {
  opacity: 0;
  transform: translateY(-16px);
}
.toast-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: all 0.3s ease;
}
.toast-exit {
  opacity: 1;
}
.toast-exit-active {
  opacity: 0;
  transition: opacity 0.3s ease;
}
```

### Auto-Save Indicator Fade
```css
.save-indicator {
  transition: opacity 0.3s ease;
}
.save-indicator.hidden {
  opacity: 0;
}
```

**Respect `prefers-reduced-motion`:**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}
```

---

## Next Steps

1. **ui-kit-personalization:** Build React components based on wireframes
2. **model-user-preference:** Implement backend model with validation
3. **feature-structure:** Create frontend feature directory structure
4. **appearance-settings:** Implement Appearance tab UI
