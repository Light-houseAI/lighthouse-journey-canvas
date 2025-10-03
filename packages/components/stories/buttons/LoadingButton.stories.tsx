import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { LoadingButton } from '../../src/buttons/loading-button'

const meta = {
  title: 'Buttons/LoadingButton',
  component: LoadingButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
    },
    spinnerPosition: {
      control: 'select',
      options: ['start', 'end'],
    },
  },
} satisfies Meta<typeof LoadingButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => {
    const [isLoading, setIsLoading] = useState(false)
    return (
      <LoadingButton
        isLoading={isLoading}
        onClick={() => {
          setIsLoading(true)
          setTimeout(() => setIsLoading(false), 2000)
        }}
      >
        Click Me
      </LoadingButton>
    )
  },
}

export const WithLoadingText: Story = {
  render: () => {
    const [isLoading, setIsLoading] = useState(false)
    return (
      <LoadingButton
        isLoading={isLoading}
        loadingText="Saving..."
        onClick={() => {
          setIsLoading(true)
          setTimeout(() => setIsLoading(false), 2000)
        }}
      >
        Save Changes
      </LoadingButton>
    )
  },
}

export const SpinnerAtEnd: Story = {
  render: () => {
    const [isLoading, setIsLoading] = useState(false)
    return (
      <LoadingButton
        isLoading={isLoading}
        loadingText="Processing..."
        spinnerPosition="end"
        onClick={() => {
          setIsLoading(true)
          setTimeout(() => setIsLoading(false), 2000)
        }}
      >
        Submit
      </LoadingButton>
    )
  },
}

export const DestructiveVariant: Story = {
  render: () => {
    const [isLoading, setIsLoading] = useState(false)
    return (
      <LoadingButton
        variant="destructive"
        isLoading={isLoading}
        loadingText="Deleting..."
        onClick={() => {
          setIsLoading(true)
          setTimeout(() => setIsLoading(false), 2000)
        }}
      >
        Delete
      </LoadingButton>
    )
  },
}

export const OutlineVariant: Story = {
  render: () => {
    const [isLoading, setIsLoading] = useState(false)
    return (
      <LoadingButton
        variant="outline"
        isLoading={isLoading}
        onClick={() => {
          setIsLoading(true)
          setTimeout(() => setIsLoading(false), 2000)
        }}
      >
        Load More
      </LoadingButton>
    )
  },
}
