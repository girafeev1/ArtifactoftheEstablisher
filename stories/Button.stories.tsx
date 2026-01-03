import type { Meta, StoryObj } from '@storybook/react'
import { Button } from 'antd'

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['default', 'primary', 'dashed', 'link', 'text'],
    },
    size: {
      control: { type: 'select' },
      options: ['small', 'middle', 'large'],
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: {
    type: 'primary',
    children: 'Primary Button',
  },
}

export const Default: Story = {
  args: {
    children: 'Default Button',
  },
}

export const Text: Story = {
  args: {
    type: 'text',
    children: 'Text Button',
  },
}

export const Small: Story = {
  args: {
    size: 'small',
    children: 'Small Button',
  },
}

export const Large: Story = {
  args: {
    size: 'large',
    type: 'primary',
    children: 'Large Button',
  },
}
