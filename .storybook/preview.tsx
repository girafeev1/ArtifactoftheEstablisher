import type { Preview } from '@storybook/react'
import React from 'react'
import { ConfigProvider } from 'antd'
import '../styles/antd-reset.css'
import '../styles/studentDialog.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      <ConfigProvider>
        <Story />
      </ConfigProvider>
    ),
  ],
}

export default preview
