import type { Meta, StoryObj } from '@storybook/react'
import { Briefcase, Calendar, GraduationCap, Award, Star } from 'lucide-react'
import { IconBadge } from '../../src/misc/icon-badge'

const meta = {
  title: 'Misc/IconBadge',
  component: IconBadge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['solid', 'soft', 'outline'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
} satisfies Meta<typeof IconBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    icon: <Briefcase className="h-4 w-4" />,
    variant: 'soft',
    size: 'md',
  },
}

export const Solid: Story = {
  args: {
    icon: <Calendar className="h-4 w-4" />,
    variant: 'solid',
    size: 'md',
  },
}

export const Outline: Story = {
  args: {
    icon: <GraduationCap className="h-4 w-4" />,
    variant: 'outline',
    size: 'md',
  },
}

export const SmallSize: Story = {
  args: {
    icon: <Star className="h-3 w-3" />,
    variant: 'soft',
    size: 'sm',
  },
}

export const LargeSize: Story = {
  args: {
    icon: <Award className="h-5 w-5" />,
    variant: 'soft',
    size: 'lg',
  },
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-4 items-center">
      <IconBadge icon={<Briefcase className="h-4 w-4" />} variant="solid" />
      <IconBadge icon={<Calendar className="h-4 w-4" />} variant="soft" />
      <IconBadge icon={<GraduationCap className="h-4 w-4" />} variant="outline" />
    </div>
  ),
}

export const AllSizes: Story = {
  render: () => (
    <div className="flex gap-4 items-center">
      <IconBadge icon={<Star className="h-3 w-3" />} variant="soft" size="sm" />
      <IconBadge icon={<Star className="h-4 w-4" />} variant="soft" size="md" />
      <IconBadge icon={<Star className="h-5 w-5" />} variant="soft" size="lg" />
    </div>
  ),
}
