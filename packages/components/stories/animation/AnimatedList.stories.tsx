import type { Meta, StoryObj } from '@storybook/react'
import { AnimatedList } from '../../src/animation/animated-list'
import { cn } from '../../src/lib/utils'

const meta = {
  title: 'Animation/AnimatedList',
  component: AnimatedList,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof AnimatedList>

export default meta
type Story = StoryObj<typeof meta>

interface Item {
  name: string
  description: string
  time: string
}

const Notification = ({ name, description, time }: Item) => {
  return (
    <figure
      className={cn(
        'relative mx-auto min-h-fit w-full max-w-[400px] transform cursor-pointer overflow-hidden rounded-2xl p-4',
        'transition-all duration-200 ease-in-out hover:scale-[103%]',
        'bg-white [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]',
      )}
    >
      <div className="flex flex-row items-center gap-3">
        <div className="flex flex-col overflow-hidden">
          <figcaption className="flex flex-row items-center whitespace-pre text-lg font-medium">
            <span className="text-sm sm:text-lg">{name}</span>
          </figcaption>
          <p className="text-sm font-normal">{description}</p>
          <p className="text-xs text-gray-500">{time}</p>
        </div>
      </div>
    </figure>
  )
}

const notifications = [
  {
    name: 'Payment received',
    description: 'Magic UI',
    time: '15m ago',
  },
  {
    name: 'User signed up',
    description: 'Magic UI',
    time: '10m ago',
  },
  {
    name: 'New message',
    description: 'Magic UI',
    time: '5m ago',
  },
]

export const Default: Story = {
  render: () => (
    <div className="relative flex h-[500px] w-full flex-col overflow-hidden rounded-lg border bg-background p-6">
      <AnimatedList>
        {notifications.map((item, idx) => (
          <Notification {...item} key={idx} />
        ))}
      </AnimatedList>
    </div>
  ),
}
