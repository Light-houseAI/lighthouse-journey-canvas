# Phase 5: Extract Reusable Components from packages/ui

## Overview
Based on gpt-5 analysis, we identified 60+ duplicate component files and numerous UI patterns that can be extracted into reusable components in @journey/components.

## Priority-Based Implementation Plan

### 5.1: High Priority - High Impact / Low Effort ✅

#### A. ConfirmDialog Component
**Impact:** Used in 5+ delete flows
**Location:** packages/components/src/overlays/confirm-dialog.tsx

```typescript
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  confirmVariant?: 'destructive' | 'default';
  onConfirm: () => void;
  confirmDisabled?: boolean;
}
```

**Current duplicates:**
- nodes/job/JobNodePanel.tsx:148-177
- nodes/education/EducationNodePanel.tsx:163-189
- nodes/project/ProjectNodePanel.tsx:142-168
- nodes/event/EventNodePanel.tsx:142-168
- nodes/action/ActionNodePanel.tsx:145-172

#### B. MonthInput Component
**Impact:** Used in 10+ form inputs
**Location:** packages/components/src/fields/month-input.tsx

```typescript
interface MonthInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}
```

**Current duplicates:**
- nodes/job/JobModal.tsx:336-347
- nodes/education/EducationModal.tsx:353-364
- nodes/event/EventModal.tsx:253-263
- nodes/action/ActionModal.tsx:252-263
- nodes/project/ProjectModal.tsx:323-341, 344-364

#### C. LoadingButton Component
**Impact:** Used in all node forms
**Location:** packages/components/src/buttons/loading-button.tsx

```typescript
interface LoadingButtonProps extends ButtonProps {
  isLoading: boolean;
  loadingText?: string;
}
```

**Current duplicates:**
- nodes/project/ProjectModal.tsx:369-386
- All other node forms (Job, Education, Event, Action)

#### D. InitialsAvatar Component + Utility
**Impact:** Used in 3+ profile views
**Location:** packages/components/src/avatar/initials-avatar.tsx

```typescript
interface InitialsAvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}
```

**Current duplicates:**
- profile/ProfileHeader.tsx:46-52
- search/page/ProfileListItem.tsx:28-34
- search/page/ProfileView.tsx:22-28

### 5.2: Medium Priority - Medium Impact / Moderate Effort

#### E. InfoSection Component
**Impact:** Used in 20+ section blocks
**Location:** packages/components/src/sections/info-section.tsx

```typescript
interface InfoSectionProps {
  title: string;
  tone?: 'emerald' | 'violet' | 'orange' | 'slate' | 'purple' | 'pink' | 'cyan';
  className?: string;
  children: React.ReactNode;
}
```

**Current duplicates:**
- nodes/event/EventNodePanel.tsx:73-83 (Duration), 97-107 (Description)
- Similar in Job, Education, Project, Action node panels

#### F. IconBadge Component
**Impact:** Used in all node panel headers
**Location:** packages/components/src/misc/icon-badge.tsx

```typescript
interface IconBadgeProps {
  icon: React.ReactNode;
  tone?: 'emerald' | 'violet' | 'orange' | 'cyan' | 'purple' | 'slate' | 'pink';
  size?: 'sm' | 'md' | 'lg';
}
```

**Current duplicates:**
- nodes/education/EducationNodePanel.tsx:295-299
- All other node panels (Job, Project, Event, Action)

#### G. OptionTileGrid & OptionTile
**Impact:** Enables reusable type selectors
**Location:** packages/components/src/tiles/

```typescript
interface OptionTileProps {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  bgColor?: string;
}

interface OptionTileGridProps {
  options: OptionTileProps[];
  columns?: 1 | 2 | 3;
}
```

**Current usage:**
- modals/NodeTypeSelector.tsx:125-139 (tile structure)

### 5.3: High Impact - Higher Effort

#### H. SlideOver Panel Component
**Impact:** Centralizes 5 node panel structures
**Location:** packages/components/src/panels/slide-over.tsx

```typescript
interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  widthClass?: string;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}
```

**Current duplicates:**
- nodes/job/JobNodePanel.tsx:274-346
- nodes/education/EducationNodePanel.tsx:274-347
- nodes/project/ProjectNodePanel.tsx:249-322
- nodes/event/EventNodePanel.tsx:247-320
- nodes/action/ActionNodePanel.tsx:253-314

#### I. Wizard Components (StepIndicator + WizardShell)
**Impact:** Simplifies multi-step flows
**Location:** packages/components/src/wizard/

```typescript
interface StepIndicatorProps {
  current: number;
  total: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dots' | 'numbers';
}

interface WizardShellProps {
  leftStepper: React.ReactNode;
  header?: React.ReactNode;
  content: React.ReactNode;
  footer?: React.ReactNode;
}
```

**Current duplicates:**
- modals/MultiStepAddNodeModal.tsx:136-170 (step circles)
- career-transition/wizard steps (ActivitySelectionStep, AppliedToJobsStep, etc.)

### 5.4: Refactoring packages/ui

**Step-by-step migration:**

1. **Replace ConfirmDialog** (5 files)
   - JobNodePanel, EducationNodePanel, ProjectNodePanel, EventNodePanel, ActionNodePanel
   - Remove AlertDialog boilerplate, use ConfirmDialog

2. **Replace MonthInput** (6 forms, 12+ inputs)
   - JobModal, EducationModal, EventModal, ActionModal, ProjectModal
   - Remove pattern/title attributes, use MonthInput component

3. **Replace LoadingButton** (5 forms)
   - All node modal forms
   - Simplify isPending logic

4. **Replace InitialsAvatar** (3 files)
   - ProfileHeader, ProfileListItem, ProfileView
   - Remove getInitials logic, use component

5. **Replace InfoSection** (20+ blocks)
   - All node panels (Duration, Description sections)
   - Standardize tone/styling

6. **Replace IconBadge** (5 files)
   - All node panel headers
   - Standardize icon display

7. **Introduce SlideOver** (5 files)
   - Migrate one panel first (EventNodePanel) to de-risk
   - Then migrate remaining panels

8. **Introduce Wizard components** (2 flows)
   - Migrate MultiStepAddNodeModal first
   - Then migrate CareerUpdateWizard

### 5.5: Storybook Stories

Create stories for each new component:
- `confirm-dialog.stories.tsx`
- `month-input.stories.tsx`
- `loading-button.stories.tsx`
- `initials-avatar.stories.tsx`
- `info-section.stories.tsx`
- `icon-badge.stories.tsx`
- `option-tile-grid.stories.tsx`
- `slide-over.stories.tsx`
- `step-indicator.stories.tsx`
- `wizard-shell.stories.tsx`

## Implementation Order

### Week 1: High Priority Components
- [ ] Create ConfirmDialog
- [ ] Create MonthInput
- [ ] Create LoadingButton
- [ ] Create InitialsAvatar + getInitials utility
- [ ] Add Storybook stories for above
- [ ] Refactor 5 delete flows to use ConfirmDialog
- [ ] Refactor 12+ inputs to use MonthInput

### Week 2: Medium Priority Components
- [ ] Create InfoSection
- [ ] Create IconBadge
- [ ] Create OptionTileGrid + OptionTile
- [ ] Add Storybook stories for above
- [ ] Refactor 20+ sections to use InfoSection
- [ ] Refactor 5 panel headers to use IconBadge
- [ ] Refactor NodeTypeSelector to use OptionTileGrid

### Week 3: Complex Components
- [ ] Create SlideOver
- [ ] Create StepIndicator
- [ ] Create WizardShell
- [ ] Add Storybook stories for above
- [ ] Migrate EventNodePanel to use SlideOver (test)
- [ ] Migrate remaining 4 panels to use SlideOver
- [ ] Migrate MultiStepAddNodeModal to use wizard components
- [ ] Migrate CareerUpdateWizard to use wizard components

## Expected Impact

**Code Reduction:**
- Remove ~1,500 lines of duplicate code from packages/ui
- 60+ duplicate component files already removed (Phase 4)
- Additional ~500 lines of duplicate UI patterns consolidated

**Consistency:**
- Standardized delete confirmations
- Consistent date input validation
- Unified loading states
- Standardized panel layouts
- Consistent wizard flows

**Maintainability:**
- Single source of truth for common patterns
- Easier to update styling/behavior across app
- Better accessibility (centralized in components)
- Improved test coverage (test once, use everywhere)

**Developer Experience:**
- Simpler component APIs
- Better TypeScript support
- Comprehensive Storybook documentation
- Faster feature development

## Trade-offs & Considerations

1. **Keep business logic in packages/ui**
   - API calls, Zustand stores stay in app code
   - Components are presentational only

2. **Avoid hard-coding domain logic**
   - Don't hard-code node type colors in components
   - Expose tone props, let app code decide

3. **Animation dependencies**
   - Consider if framer-motion should be in @journey/components
   - Option: Keep components neutral, let consumers add animation
   - Current: magicui already uses framer-motion

4. **Incremental migration**
   - Migrate one component at a time
   - Test thoroughly before moving to next
   - Don't break existing functionality

## Success Criteria

- ✅ All identified components extracted to @journey/components
- ✅ Storybook stories for all new components
- ✅ All duplicates in packages/ui replaced with component imports
- ✅ No regression in functionality
- ✅ Build passes
- ✅ Tests pass
- ✅ knip passes with no unused dependencies
- ✅ TypeScript passes with no new errors

## References

Based on gpt-5 analysis with specific line numbers and code excerpts from:
- packages/ui/src/components/nodes/* (5 node types)
- packages/ui/src/components/modals/*
- packages/ui/src/components/search/*
- packages/ui/src/components/profile/*

See gpt-5 analysis above for detailed code locations and excerpts.
