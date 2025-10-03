import type { Meta, StoryObj } from '@storybook/react'
import { InitialsAvatar } from '../../src/avatar/initials-avatar'

const meta = {
  title: 'Avatar/InitialsAvatar',
  component: InitialsAvatar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
    },
  },
} satisfies Meta<typeof InitialsAvatar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    name: 'John Doe',
    size: 'md',
  },
}

export const WithImage: Story = {
  args: {
    name: 'Jane Smith',
    src: 'https://i.pravatar.cc/150?img=1',
    size: 'md',
  },
}

export const SingleName: Story = {
  args: {
    name: 'Alice',
    size: 'md',
  },
}

export const SmallSize: Story = {
  args: {
    name: 'Bob Johnson',
    size: 'sm',
  },
}

export const LargeSize: Story = {
  args: {
    name: 'Charlie Brown',
    size: 'lg',
  },
}

export const ExtraLargeSize: Story = {
  args: {
    name: 'David Williams',
    size: 'xl',
  },
}

export const ConsistentColors: Story = {
  render: () => (
    <div className="flex gap-4">
      <InitialsAvatar name="Alice Anderson" size="md" />
      <InitialsAvatar name="Bob Baker" size="md" />
      <InitialsAvatar name="Carol Chen" size="md" />
      <InitialsAvatar name="David Davis" size="md" />
      <InitialsAvatar name="Alice Anderson" size="md" />
    </div>
  ),
}

export const CustomColorSeed: Story = {
  render: () => (
    <div className="flex gap-4">
      <InitialsAvatar name="Same Name" colorSeed="seed1" size="md" />
      <InitialsAvatar name="Same Name" colorSeed="seed2" size="md" />
      <InitialsAvatar name="Same Name" colorSeed="seed3" size="md" />
    </div>
  ),
}
