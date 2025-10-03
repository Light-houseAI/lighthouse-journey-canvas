# Component Stories

This directory contains Storybook stories for the Journey component library.

## Organization

- `base/` - Stories for shadcn/ui base components
- `animation/` - Stories for MagicUI animation components

## Running Storybook

```bash
# Development mode
pnpm --filter @journey/components storybook

# Build static Storybook
pnpm --filter @journey/components build-storybook
```

## Story Examples

### Base Components
- **Button** - All variants and sizes
- **Badge** - All badge variants
- **Card** - Card compositions with header/content/footer

### Animation Components
- **BlurFade** - Blur and fade animations with timing controls
- **ShimmerButton** - Animated shimmer effect buttons

## Adding New Stories

1. Create a new `.stories.tsx` file in the appropriate directory
2. Import the component from `../../src/`
3. Define meta configuration with title, component, and controls
4. Export story variants as named exports

Example:
```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { YourComponent } from '../../src/base/your-component'

const meta = {
  title: 'Base/YourComponent',
  component: YourComponent,
  tags: ['autodocs'],
} satisfies Meta<typeof YourComponent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    // component props
  },
}
```
