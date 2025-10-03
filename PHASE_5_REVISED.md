# Phase 5: Extract Reusable Components (REVISED)

## Analysis Summary

After cross-referencing PHASE_5_PLAN.md with existing @journey/components, GPT-5 identified:

**Already exists (needs wrapper):**
- ConfirmDialog → AlertDialog exists
- LoadingButton → Button exists
- InitialsAvatar → Avatar + AvatarFallback exists
- IconBadge → Badge exists
- SlideOver → Sheet/Drawer exists

**Truly missing:**
- MonthInput (new primitive)
- StepIndicator (new primitive)
- InfoSection (composition pattern)
- OptionTileGrid + OptionTile (composition pattern)
- WizardShell (composition pattern)

## Implementation Priority (ROI-based)

### High Priority - Wrappers (Quick Wins)

#### 1. ConfirmDialog
**Status:** Wrapper over AlertDialog
**ROI:** High - deduplicates 5+ delete dialogs
**Location:** `packages/components/src/overlays/confirm-dialog.tsx`

```typescript
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'destructive' | 'default';
  onConfirm: () => void | Promise<void>; // Supports async
  isDestructive?: boolean; // Shortcut for variant
}
```

**Key features:**
- Built-in async support with loading state
- Auto-focus on confirm button
- Prevents double-submit while awaiting

#### 2. SlideOver
**Status:** Wrapper over Sheet
**ROI:** High - standardizes 5 node panels
**Location:** `packages/components/src/panels/slide-over.tsx`

```typescript
interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  title?: string;
  description?: string;
  footer?: React.ReactNode;
  withCloseButton?: boolean;
  children: React.ReactNode;
}
```

**Key features:**
- Sticky header/footer with scrollable body
- Size presets for consistent widths
- Standardized padding and spacing

#### 3. LoadingButton
**Status:** Wrapper over Button
**ROI:** High - used in all forms
**Location:** `packages/components/src/buttons/loading-button.tsx`

```typescript
interface LoadingButtonProps extends ButtonProps {
  isLoading: boolean;
  loadingText?: string;
  spinnerPosition?: 'start' | 'end';
  disabledWhileLoading?: boolean;
}
```

**Key features:**
- Maintains width to prevent layout shift
- aria-busy and aria-live support
- Spinner integration

#### 4. InitialsAvatar
**Status:** Wrapper over Avatar + AvatarFallback
**ROI:** Medium - deduplicates 3 profile views
**Location:** `packages/components/src/avatar/initials-avatar.tsx`

```typescript
interface InitialsAvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  colorSeed?: string;
  showPresence?: boolean;
}

// Utility function
export function getInitials(name: string): string;
```

**Key features:**
- Deterministic background colors from name hash
- Handles non-Latin, single names, emoji
- Accessible alt text

#### 5. IconBadge
**Status:** Wrapper over Badge
**ROI:** Medium - consistency across headers
**Location:** `packages/components/src/misc/icon-badge.tsx`

```typescript
interface IconBadgeProps {
  icon: React.ReactNode;
  variant?: 'solid' | 'soft' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  emphasis?: 'default' | 'muted';
}
```

**Key features:**
- Consistent icon sizing and spacing
- Color mappings to design tokens

### Medium Priority - New Primitives

#### 6. MonthInput
**Status:** New primitive input
**ROI:** High - 10+ form inputs
**Location:** `packages/components/src/fields/month-input.tsx`

```typescript
interface MonthInputProps {
  id: string;
  label: string;
  value: string; // "YYYY-MM" format
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string; // "YYYY-MM"
  max?: string; // "YYYY-MM"
  picker?: 'native' | 'dropdown';
}
```

**Key features:**
- Timezone-less "YYYY-MM" handling
- Native `<input type="month">` when supported
- Optional react-day-picker fallback
- Min/max validation

**Edge cases:**
- Mobile keyboards
- Non-supported browsers
- i18n formatting

#### 7. StepIndicator
**Status:** New presentational primitive
**ROI:** Medium - wizard flows
**Location:** `packages/components/src/wizard/step-indicator.tsx`

```typescript
interface StepIndicatorProps {
  steps: Array<{ id: string; label: string }>;
  currentStep: number; // 0-based index
  onStepClick?: (index: number) => void;
  orientation?: 'horizontal' | 'vertical';
  compact?: boolean;
}
```

**Key features:**
- Visual states: complete/current/upcoming
- Keyboard navigation
- Responsive (overflow handling)

### Medium Priority - Composition Patterns

#### 8. InfoSection
**Status:** Composition over Card/Alert
**ROI:** High - 20+ section blocks
**Location:** `packages/components/src/sections/info-section.tsx`

```typescript
interface InfoSectionProps {
  variant?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  dense?: boolean;
  children?: React.ReactNode;
}
```

**Key features:**
- Semantic variants with colors
- Icon slot with consistent spacing
- Flexible for richer content than Alert

#### 9. OptionTileGrid + OptionTile
**Status:** Composition pattern
**ROI:** Medium - node type selector
**Location:** `packages/components/src/tiles/`

```typescript
interface OptionTileProps {
  value: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

interface OptionTileGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
}
```

**Key features:**
- Accessible, keyboard-navigable
- Integration with RadioGroup for forms
- Responsive grid layout

#### 10. WizardShell
**Status:** Composition wrapper
**ROI:** Medium - multi-step flows
**Location:** `packages/components/src/wizard/wizard-shell.tsx`

```typescript
interface WizardShellProps {
  currentStep: number;
  steps: Array<{ id: string; label: string }>;
  onStepChange: (step: number) => void;
  header?: React.ReactNode;
  content: React.ReactNode;
  footer?: React.ReactNode;
  showBackButton?: boolean;
  showNextButton?: boolean;
  onBack?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
}
```

**Key features:**
- Orchestrates header (StepIndicator), body, footer
- Controlled navigation
- No internal routing/validation coupling

## Implementation Order

### Week 1: High-ROI Wrappers
1. ConfirmDialog (2h)
2. LoadingButton (1h)
3. InitialsAvatar + getInitials (2h)
4. IconBadge (1h)
5. SlideOver (3h)

**Total: ~9 hours**

### Week 2: Primitives + Patterns
6. MonthInput (4h - native + fallback strategy)
7. StepIndicator (3h)
8. InfoSection (2h)
9. OptionTileGrid + OptionTile (3h)

**Total: ~12 hours**

### Week 3: Advanced + Integration
10. WizardShell (3h)
11. Storybook stories for all (6h)
12. Refactor packages/ui (8h)

**Total: ~17 hours**

## Refactoring Impact

**Code reduction (estimated):**
- Remove ~1,500 lines from packages/ui
- Consolidate 5+ delete dialog implementations
- Standardize 10+ date inputs
- Unify 5 node panel structures
- Consistent wizard flows

**Files to update in packages/ui:**
- Delete flows: JobNodePanel, EducationNodePanel, ProjectNodePanel, EventNodePanel, ActionNodePanel (5 files)
- Date inputs: JobModal, EducationModal, EventModal, ActionModal, ProjectModal (6 forms, 12+ inputs)
- Loading buttons: All node modal forms (5 files)
- Avatars: ProfileHeader, ProfileListItem, ProfileView (3 files)
- Info sections: All node panels (20+ blocks)
- Icon badges: All node panel headers (5 files)
- Panels: EventNodePanel → test first, then migrate remaining 4
- Wizard: MultiStepAddNodeModal, CareerUpdateWizard (2 flows)

## Success Criteria

- ✅ All 10 components created in @journey/components
- ✅ Storybook stories for all new components
- ✅ All duplicates in packages/ui replaced
- ✅ No regression in functionality
- ✅ Build passes
- ✅ Tests pass
- ✅ knip passes
- ✅ TypeScript passes with no new errors

## Trade-offs & Decisions

### ConfirmDialog
**Decision:** Wrapper over AlertDialog (not enhancement)
**Rationale:** Keeps AlertDialog unchanged, simpler API for common case

### LoadingButton
**Decision:** Wrapper over Button (not enhancement)
**Rationale:** Avoids breaking changes to Button, can merge later if widely adopted

### MonthInput
**Decision:** Native-first with optional picker fallback
**Rationale:** Best UX when supported, graceful degradation

### SlideOver
**Decision:** Wrapper over Sheet (not Drawer)
**Rationale:** Sheet provides better control for panel use cases

### Component organization
**Decision:** Keep in subdirectories by type (overlays/, buttons/, fields/, etc.)
**Rationale:** Easier to navigate as library grows

## Next Steps

1. Start with ConfirmDialog (highest ROI, clear API)
2. Add Storybook story to validate
3. Refactor 1 delete flow in packages/ui to test
4. Iterate through remaining components
5. Bulk refactor packages/ui once all components ready
