import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Briefcase, GraduationCap, Award, Code, Palette, Rocket } from 'lucide-react'
import { OptionTile } from '../../src/tiles/option-tile'
import { OptionTileGrid } from '../../src/tiles/option-tile-grid'

const meta = {
  title: 'Tiles/OptionTile',
  component: OptionTile,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof OptionTile>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => {
    const [selected, setSelected] = useState(false)
    return (
      <div className="max-w-md">
        <OptionTile
          value="option-1"
          title="Professional Experience"
          description="Add details about your work history and achievements"
          icon={<Briefcase className="h-5 w-5" />}
          selected={selected}
          onSelect={() => setSelected(!selected)}
        />
      </div>
    )
  },
}

export const WithoutIcon: Story = {
  render: () => {
    const [selected, setSelected] = useState(false)
    return (
      <div className="max-w-md">
        <OptionTile
          value="option-2"
          title="Basic Option"
          description="This option doesn't have an icon"
          selected={selected}
          onSelect={() => setSelected(!selected)}
        />
      </div>
    )
  },
}

export const Disabled: Story = {
  args: {
    value: "disabled",
    title: "Disabled Option",
    description: "This option is currently unavailable",
    icon: <Award className="h-5 w-5" />,
    selected: false,
    disabled: true,
    onSelect: () => {},
  },
}

export const GridLayout: Story = {
  render: () => {
    const [selectedValue, setSelectedValue] = useState<string | null>(null)

    const options = [
      {
        value: 'work',
        title: 'Work Experience',
        description: 'Add your professional background',
        icon: <Briefcase className="h-5 w-5" />,
      },
      {
        value: 'education',
        title: 'Education',
        description: 'Add your educational background',
        icon: <GraduationCap className="h-5 w-5" />,
      },
      {
        value: 'achievement',
        title: 'Achievement',
        description: 'Highlight your accomplishments',
        icon: <Award className="h-5 w-5" />,
      },
    ]

    return (
      <div className="max-w-3xl">
        <OptionTileGrid columns={2}>
          {options.map((option) => (
            <OptionTile
              key={option.value}
              value={option.value}
              title={option.title}
              description={option.description}
              icon={option.icon}
              selected={selectedValue === option.value}
              onSelect={() => setSelectedValue(option.value)}
            />
          ))}
        </OptionTileGrid>
      </div>
    )
  },
}

export const ThreeColumns: Story = {
  render: () => {
    const [selectedValue, setSelectedValue] = useState<string | null>('design')

    const options = [
      {
        value: 'development',
        title: 'Development',
        description: 'Build amazing applications',
        icon: <Code className="h-5 w-5" />,
      },
      {
        value: 'design',
        title: 'Design',
        description: 'Create beautiful interfaces',
        icon: <Palette className="h-5 w-5" />,
      },
      {
        value: 'launch',
        title: 'Launch',
        description: 'Ship your products',
        icon: <Rocket className="h-5 w-5" />,
      },
    ]

    return (
      <div className="max-w-4xl">
        <OptionTileGrid columns={3}>
          {options.map((option) => (
            <OptionTile
              key={option.value}
              value={option.value}
              title={option.title}
              description={option.description}
              icon={option.icon}
              selected={selectedValue === option.value}
              onSelect={() => setSelectedValue(option.value)}
            />
          ))}
        </OptionTileGrid>
      </div>
    )
  },
}

export const SingleColumn: Story = {
  render: () => {
    const [selectedValue, setSelectedValue] = useState<string | null>('option-1')

    const options = [
      {
        value: 'option-1',
        title: 'First Option',
        description: 'This is the first option with a longer description to show how it looks',
        icon: <Briefcase className="h-5 w-5" />,
      },
      {
        value: 'option-2',
        title: 'Second Option',
        description: 'This is the second option',
        icon: <GraduationCap className="h-5 w-5" />,
      },
      {
        value: 'option-3',
        title: 'Third Option (Disabled)',
        description: 'This option is currently unavailable',
        icon: <Award className="h-5 w-5" />,
        disabled: true,
      },
    ]

    return (
      <div className="max-w-md">
        <OptionTileGrid columns={1}>
          {options.map((option) => (
            <OptionTile
              key={option.value}
              value={option.value}
              title={option.title}
              description={option.description}
              icon={option.icon}
              selected={selectedValue === option.value}
              onSelect={() => setSelectedValue(option.value)}
              disabled={option.disabled}
            />
          ))}
        </OptionTileGrid>
      </div>
    )
  },
}
