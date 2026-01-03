/**
 * Full Component Showcase (Storybook-like)
 *
 * A comprehensive component showcase with controls, documentation, and code snippets.
 * Access at: http://localhost:3000/tools/storybook
 */

import React, { useState, useMemo } from 'react'
import Head from 'next/head'
import {
  Layout,
  Menu,
  Typography,
  Button,
  Space,
  Card,
  Divider,
  Input,
  Select,
  Checkbox,
  Table,
  Modal,
  Spin,
  Alert,
  Tooltip,
  Tag,
  Tabs,
  Row,
  Col,
  Switch,
  Radio,
  Slider,
  InputNumber,
  ColorPicker,
  Collapse,
  Descriptions,
  theme,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  HomeOutlined,
  SettingOutlined,
  UserOutlined,
  BellOutlined,
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  BookOutlined,
  CodeOutlined,
  ControlOutlined,
  FileTextOutlined,
  CopyOutlined,
  PlayCircleOutlined,
  TableOutlined,
  FormOutlined,
  MessageOutlined,
  LayoutOutlined,
  LoadingOutlined,
} from '@ant-design/icons'

const { Header, Sider, Content } = Layout
const { Title, Text, Paragraph } = Typography
const { Panel } = Collapse

// ============================================================================
// TYPES
// ============================================================================

type ComponentCategory = 'general' | 'forms' | 'data' | 'feedback' | 'layout'

interface Story {
  id: string
  name: string
  category: ComponentCategory
  component: string
  description: string
  render: (props: Record<string, any>) => React.ReactNode
  controls: Control[]
  defaultProps: Record<string, any>
  code: (props: Record<string, any>) => string
}

interface Control {
  name: string
  type: 'select' | 'boolean' | 'text' | 'number' | 'color' | 'radio'
  label: string
  options?: { label: string; value: any }[]
  min?: number
  max?: number
  step?: number
}

// ============================================================================
// PREVIEW COMPONENTS (for stories that need state)
// ============================================================================

// Modal preview component - needs its own state management
const ModalPreview = ({ props }: { props: Record<string, any> }) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="primary" onClick={() => setOpen(true)}>Open Modal</Button>
      <Modal {...props} open={open} onOk={() => setOpen(false)} onCancel={() => setOpen(false)}>
        <p>This is the modal content.</p>
        <p>You can put any content here.</p>
      </Modal>
    </>
  )
}

// ============================================================================
// STORIES DEFINITION
// ============================================================================

const STORIES: Story[] = [
  // BUTTON
  {
    id: 'button-primary',
    name: 'Button',
    category: 'general',
    component: 'Button',
    description: 'Primary button for main actions. Use for the most important action on a page.',
    controls: [
      { name: 'type', type: 'select', label: 'Type', options: [
        { label: 'Primary', value: 'primary' },
        { label: 'Default', value: 'default' },
        { label: 'Dashed', value: 'dashed' },
        { label: 'Text', value: 'text' },
        { label: 'Link', value: 'link' },
      ]},
      { name: 'size', type: 'select', label: 'Size', options: [
        { label: 'Large', value: 'large' },
        { label: 'Middle', value: 'middle' },
        { label: 'Small', value: 'small' },
      ]},
      { name: 'children', type: 'text', label: 'Label' },
      { name: 'disabled', type: 'boolean', label: 'Disabled' },
      { name: 'loading', type: 'boolean', label: 'Loading' },
      { name: 'danger', type: 'boolean', label: 'Danger' },
      { name: 'block', type: 'boolean', label: 'Block' },
      { name: 'ghost', type: 'boolean', label: 'Ghost' },
    ],
    defaultProps: {
      type: 'primary',
      size: 'middle',
      children: 'Button',
      disabled: false,
      loading: false,
      danger: false,
      block: false,
      ghost: false,
    },
    render: (props) => <Button {...props} />,
    code: (props) => `<Button
  type="${props.type}"
  size="${props.size}"${props.disabled ? '\n  disabled' : ''}${props.loading ? '\n  loading' : ''}${props.danger ? '\n  danger' : ''}${props.block ? '\n  block' : ''}${props.ghost ? '\n  ghost' : ''}
>
  ${props.children}
</Button>`,
  },

  // INPUT
  {
    id: 'input-basic',
    name: 'Input',
    category: 'forms',
    component: 'Input',
    description: 'Basic text input field for user data entry.',
    controls: [
      { name: 'size', type: 'select', label: 'Size', options: [
        { label: 'Large', value: 'large' },
        { label: 'Middle', value: 'middle' },
        { label: 'Small', value: 'small' },
      ]},
      { name: 'placeholder', type: 'text', label: 'Placeholder' },
      { name: 'disabled', type: 'boolean', label: 'Disabled' },
      { name: 'status', type: 'select', label: 'Status', options: [
        { label: 'None', value: '' },
        { label: 'Error', value: 'error' },
        { label: 'Warning', value: 'warning' },
      ]},
      { name: 'showCount', type: 'boolean', label: 'Show Count' },
      { name: 'maxLength', type: 'number', label: 'Max Length', min: 0, max: 100 },
      { name: 'allowClear', type: 'boolean', label: 'Allow Clear' },
    ],
    defaultProps: {
      size: 'middle',
      placeholder: 'Enter text...',
      disabled: false,
      status: '',
      showCount: false,
      maxLength: 50,
      allowClear: false,
    },
    render: (props) => <Input {...props} style={{ maxWidth: 300 }} />,
    code: (props) => `<Input
  size="${props.size}"
  placeholder="${props.placeholder}"${props.disabled ? '\n  disabled' : ''}${props.status ? `\n  status="${props.status}"` : ''}${props.showCount ? '\n  showCount' : ''}${props.maxLength ? `\n  maxLength={${props.maxLength}}` : ''}${props.allowClear ? '\n  allowClear' : ''}
/>`,
  },

  // SELECT
  {
    id: 'select-basic',
    name: 'Select',
    category: 'forms',
    component: 'Select',
    description: 'Dropdown selector for choosing from predefined options.',
    controls: [
      { name: 'size', type: 'select', label: 'Size', options: [
        { label: 'Large', value: 'large' },
        { label: 'Middle', value: 'middle' },
        { label: 'Small', value: 'small' },
      ]},
      { name: 'mode', type: 'select', label: 'Mode', options: [
        { label: 'Single', value: undefined },
        { label: 'Multiple', value: 'multiple' },
        { label: 'Tags', value: 'tags' },
      ]},
      { name: 'disabled', type: 'boolean', label: 'Disabled' },
      { name: 'showSearch', type: 'boolean', label: 'Show Search' },
      { name: 'allowClear', type: 'boolean', label: 'Allow Clear' },
      { name: 'loading', type: 'boolean', label: 'Loading' },
    ],
    defaultProps: {
      size: 'middle',
      mode: undefined,
      disabled: false,
      showSearch: false,
      allowClear: false,
      loading: false,
    },
    render: (props) => (
      <Select
        {...props}
        style={{ width: 200 }}
        placeholder="Select option"
        options={[
          { label: 'Option 1', value: '1' },
          { label: 'Option 2', value: '2' },
          { label: 'Option 3', value: '3' },
        ]}
      />
    ),
    code: (props) => `<Select
  size="${props.size}"${props.mode ? `\n  mode="${props.mode}"` : ''}${props.disabled ? '\n  disabled' : ''}${props.showSearch ? '\n  showSearch' : ''}${props.allowClear ? '\n  allowClear' : ''}${props.loading ? '\n  loading' : ''}
  style={{ width: 200 }}
  placeholder="Select option"
  options={[
    { label: 'Option 1', value: '1' },
    { label: 'Option 2', value: '2' },
    { label: 'Option 3', value: '3' },
  ]}
/>`,
  },

  // TABLE
  {
    id: 'table-basic',
    name: 'Table',
    category: 'data',
    component: 'Table',
    description: 'Display data in a structured table format with sorting and selection.',
    controls: [
      { name: 'size', type: 'select', label: 'Size', options: [
        { label: 'Large', value: 'large' },
        { label: 'Middle', value: 'middle' },
        { label: 'Small', value: 'small' },
      ]},
      { name: 'bordered', type: 'boolean', label: 'Bordered' },
      { name: 'showHeader', type: 'boolean', label: 'Show Header' },
      { name: 'loading', type: 'boolean', label: 'Loading' },
      { name: 'rowSelection', type: 'boolean', label: 'Row Selection' },
    ],
    defaultProps: {
      size: 'middle',
      bordered: false,
      showHeader: true,
      loading: false,
      rowSelection: false,
    },
    render: (props) => {
      const columns: ColumnsType<any> = [
        { title: 'Name', dataIndex: 'name', key: 'name' },
        { title: 'Age', dataIndex: 'age', key: 'age', sorter: (a: any, b: any) => a.age - b.age },
        { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === 'Active' ? 'green' : 'red'}>{s}</Tag> },
      ]
      const data = [
        { key: '1', name: 'John Doe', age: 32, status: 'Active' },
        { key: '2', name: 'Jane Smith', age: 28, status: 'Active' },
        { key: '3', name: 'Bob Wilson', age: 45, status: 'Inactive' },
      ]
      return (
        <Table
          {...props}
          columns={columns}
          dataSource={data}
          pagination={false}
          rowSelection={props.rowSelection ? { type: 'checkbox' } : undefined}
        />
      )
    },
    code: (props) => `<Table
  size="${props.size}"${props.bordered ? '\n  bordered' : ''}${!props.showHeader ? '\n  showHeader={false}' : ''}${props.loading ? '\n  loading' : ''}${props.rowSelection ? '\n  rowSelection={{ type: "checkbox" }}' : ''}
  columns={columns}
  dataSource={data}
  pagination={false}
/>`,
  },

  // MODAL
  {
    id: 'modal-basic',
    name: 'Modal',
    category: 'feedback',
    component: 'Modal',
    description: 'Dialog overlay for important content requiring user interaction.',
    controls: [
      { name: 'title', type: 'text', label: 'Title' },
      { name: 'width', type: 'number', label: 'Width', min: 300, max: 800 },
      { name: 'centered', type: 'boolean', label: 'Centered' },
      { name: 'closable', type: 'boolean', label: 'Closable' },
      { name: 'maskClosable', type: 'boolean', label: 'Mask Closable' },
      { name: 'okText', type: 'text', label: 'OK Text' },
      { name: 'cancelText', type: 'text', label: 'Cancel Text' },
    ],
    defaultProps: {
      title: 'Modal Title',
      width: 520,
      centered: false,
      closable: true,
      maskClosable: true,
      okText: 'OK',
      cancelText: 'Cancel',
    },
    render: (props) => <ModalPreview props={props} />,
    code: (props) => `<Modal
  title="${props.title}"
  width={${props.width}}${props.centered ? '\n  centered' : ''}${!props.closable ? '\n  closable={false}' : ''}${!props.maskClosable ? '\n  maskClosable={false}' : ''}
  okText="${props.okText}"
  cancelText="${props.cancelText}"
  open={open}
  onOk={() => setOpen(false)}
  onCancel={() => setOpen(false)}
>
  <p>Modal content here</p>
</Modal>`,
  },

  // ALERT
  {
    id: 'alert-basic',
    name: 'Alert',
    category: 'feedback',
    component: 'Alert',
    description: 'Display important messages to users with different severity levels.',
    controls: [
      { name: 'type', type: 'select', label: 'Type', options: [
        { label: 'Success', value: 'success' },
        { label: 'Info', value: 'info' },
        { label: 'Warning', value: 'warning' },
        { label: 'Error', value: 'error' },
      ]},
      { name: 'message', type: 'text', label: 'Message' },
      { name: 'description', type: 'text', label: 'Description' },
      { name: 'showIcon', type: 'boolean', label: 'Show Icon' },
      { name: 'closable', type: 'boolean', label: 'Closable' },
      { name: 'banner', type: 'boolean', label: 'Banner Mode' },
    ],
    defaultProps: {
      type: 'info',
      message: 'Alert message',
      description: '',
      showIcon: true,
      closable: false,
      banner: false,
    },
    render: (props) => <Alert {...props} style={{ maxWidth: 500 }} />,
    code: (props) => `<Alert
  type="${props.type}"
  message="${props.message}"${props.description ? `\n  description="${props.description}"` : ''}${props.showIcon ? '\n  showIcon' : ''}${props.closable ? '\n  closable' : ''}${props.banner ? '\n  banner' : ''}
/>`,
  },

  // TAG
  {
    id: 'tag-basic',
    name: 'Tag',
    category: 'data',
    component: 'Tag',
    description: 'Small labels for categorizing or marking items.',
    controls: [
      { name: 'color', type: 'select', label: 'Color', options: [
        { label: 'Default', value: 'default' },
        { label: 'Success', value: 'success' },
        { label: 'Processing', value: 'processing' },
        { label: 'Error', value: 'error' },
        { label: 'Warning', value: 'warning' },
        { label: 'Magenta', value: 'magenta' },
        { label: 'Red', value: 'red' },
        { label: 'Volcano', value: 'volcano' },
        { label: 'Orange', value: 'orange' },
        { label: 'Gold', value: 'gold' },
        { label: 'Lime', value: 'lime' },
        { label: 'Green', value: 'green' },
        { label: 'Cyan', value: 'cyan' },
        { label: 'Blue', value: 'blue' },
        { label: 'Geekblue', value: 'geekblue' },
        { label: 'Purple', value: 'purple' },
      ]},
      { name: 'children', type: 'text', label: 'Label' },
      { name: 'closable', type: 'boolean', label: 'Closable' },
      { name: 'bordered', type: 'boolean', label: 'Bordered' },
    ],
    defaultProps: {
      color: 'blue',
      children: 'Tag Label',
      closable: false,
      bordered: true,
    },
    render: (props) => <Tag {...props}>{props.children}</Tag>,
    code: (props) => `<Tag
  color="${props.color}"${props.closable ? '\n  closable' : ''}${!props.bordered ? '\n  bordered={false}' : ''}
>
  ${props.children}
</Tag>`,
  },

  // SPIN
  {
    id: 'spin-basic',
    name: 'Spin',
    category: 'feedback',
    component: 'Spin',
    description: 'Loading indicator for async operations.',
    controls: [
      { name: 'size', type: 'select', label: 'Size', options: [
        { label: 'Small', value: 'small' },
        { label: 'Default', value: 'default' },
        { label: 'Large', value: 'large' },
      ]},
      { name: 'tip', type: 'text', label: 'Tip Text' },
    ],
    defaultProps: {
      size: 'default',
      tip: '',
    },
    render: (props) => (
      <div style={{ padding: 20, background: '#fafafa', borderRadius: 4 }}>
        <Spin {...props}>
          {props.tip && <div style={{ padding: 50 }} />}
        </Spin>
      </div>
    ),
    code: (props) => `<Spin
  size="${props.size}"${props.tip ? `\n  tip="${props.tip}"` : ''}
/>`,
  },

  // TOOLTIP
  {
    id: 'tooltip-basic',
    name: 'Tooltip',
    category: 'feedback',
    component: 'Tooltip',
    description: 'Show additional information on hover.',
    controls: [
      { name: 'title', type: 'text', label: 'Title' },
      { name: 'placement', type: 'select', label: 'Placement', options: [
        { label: 'Top', value: 'top' },
        { label: 'Bottom', value: 'bottom' },
        { label: 'Left', value: 'left' },
        { label: 'Right', value: 'right' },
        { label: 'Top Left', value: 'topLeft' },
        { label: 'Top Right', value: 'topRight' },
        { label: 'Bottom Left', value: 'bottomLeft' },
        { label: 'Bottom Right', value: 'bottomRight' },
      ]},
      { name: 'color', type: 'select', label: 'Color', options: [
        { label: 'Default', value: undefined },
        { label: 'Pink', value: 'pink' },
        { label: 'Red', value: 'red' },
        { label: 'Orange', value: 'orange' },
        { label: 'Green', value: 'green' },
        { label: 'Cyan', value: 'cyan' },
        { label: 'Blue', value: 'blue' },
        { label: 'Purple', value: 'purple' },
      ]},
    ],
    defaultProps: {
      title: 'Tooltip text',
      placement: 'top',
      color: undefined,
    },
    render: (props) => (
      <Tooltip {...props}>
        <Button>Hover me</Button>
      </Tooltip>
    ),
    code: (props) => `<Tooltip
  title="${props.title}"
  placement="${props.placement}"${props.color ? `\n  color="${props.color}"` : ''}
>
  <Button>Hover me</Button>
</Tooltip>`,
  },

  // CARD
  {
    id: 'card-basic',
    name: 'Card',
    category: 'layout',
    component: 'Card',
    description: 'Container for grouping related content.',
    controls: [
      { name: 'title', type: 'text', label: 'Title' },
      { name: 'size', type: 'select', label: 'Size', options: [
        { label: 'Default', value: 'default' },
        { label: 'Small', value: 'small' },
      ]},
      { name: 'bordered', type: 'boolean', label: 'Bordered' },
      { name: 'hoverable', type: 'boolean', label: 'Hoverable' },
      { name: 'loading', type: 'boolean', label: 'Loading' },
    ],
    defaultProps: {
      title: 'Card Title',
      size: 'default',
      bordered: true,
      hoverable: false,
      loading: false,
    },
    render: (props) => (
      <Card {...props} style={{ width: 300 }} extra={<a href="#">More</a>}>
        <p>Card content</p>
        <p>More card content</p>
      </Card>
    ),
    code: (props) => `<Card
  title="${props.title}"
  size="${props.size}"${!props.bordered ? '\n  bordered={false}' : ''}${props.hoverable ? '\n  hoverable' : ''}${props.loading ? '\n  loading' : ''}
  style={{ width: 300 }}
  extra={<a href="#">More</a>}
>
  <p>Card content</p>
</Card>`,
  },

  // TABS
  {
    id: 'tabs-basic',
    name: 'Tabs',
    category: 'layout',
    component: 'Tabs',
    description: 'Organize content into separate views.',
    controls: [
      { name: 'type', type: 'select', label: 'Type', options: [
        { label: 'Line', value: 'line' },
        { label: 'Card', value: 'card' },
        { label: 'Editable Card', value: 'editable-card' },
      ]},
      { name: 'size', type: 'select', label: 'Size', options: [
        { label: 'Large', value: 'large' },
        { label: 'Middle', value: 'middle' },
        { label: 'Small', value: 'small' },
      ]},
      { name: 'tabPosition', type: 'select', label: 'Position', options: [
        { label: 'Top', value: 'top' },
        { label: 'Bottom', value: 'bottom' },
        { label: 'Left', value: 'left' },
        { label: 'Right', value: 'right' },
      ]},
      { name: 'centered', type: 'boolean', label: 'Centered' },
    ],
    defaultProps: {
      type: 'line',
      size: 'middle',
      tabPosition: 'top',
      centered: false,
    },
    render: (props) => (
      <Tabs
        {...props}
        items={[
          { key: '1', label: 'Tab 1', children: 'Content of Tab 1' },
          { key: '2', label: 'Tab 2', children: 'Content of Tab 2' },
          { key: '3', label: 'Tab 3', children: 'Content of Tab 3' },
        ]}
      />
    ),
    code: (props) => `<Tabs
  type="${props.type}"
  size="${props.size}"
  tabPosition="${props.tabPosition}"${props.centered ? '\n  centered' : ''}
  items={[
    { key: '1', label: 'Tab 1', children: 'Content of Tab 1' },
    { key: '2', label: 'Tab 2', children: 'Content of Tab 2' },
    { key: '3', label: 'Tab 3', children: 'Content of Tab 3' },
  ]}
/>`,
  },
]

// ============================================================================
// CATEGORY CONFIG
// ============================================================================

const CATEGORIES: { key: ComponentCategory; label: string; icon: React.ReactNode }[] = [
  { key: 'general', label: 'General', icon: <SettingOutlined /> },
  { key: 'forms', label: 'Form Controls', icon: <FormOutlined /> },
  { key: 'data', label: 'Data Display', icon: <TableOutlined /> },
  { key: 'feedback', label: 'Feedback', icon: <MessageOutlined /> },
  { key: 'layout', label: 'Layout', icon: <LayoutOutlined /> },
]

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function StorybookPage() {
  const [selectedStory, setSelectedStory] = useState<string>(STORIES[0].id)
  const [storyProps, setStoryProps] = useState<Record<string, Record<string, any>>>(() => {
    const initial: Record<string, Record<string, any>> = {}
    STORIES.forEach((story) => {
      initial[story.id] = { ...story.defaultProps }
    })
    return initial
  })
  const [showCode, setShowCode] = useState(true)
  const [copied, setCopied] = useState(false)

  const story = useMemo(() => STORIES.find((s) => s.id === selectedStory), [selectedStory])
  const currentProps = story ? storyProps[story.id] : {}

  const updateProp = (name: string, value: any) => {
    if (!story) return
    setStoryProps((prev) => ({
      ...prev,
      [story.id]: { ...prev[story.id], [name]: value },
    }))
  }

  const resetProps = () => {
    if (!story) return
    setStoryProps((prev) => ({
      ...prev,
      [story.id]: { ...story.defaultProps },
    }))
  }

  const copyCode = () => {
    if (!story) return
    navigator.clipboard.writeText(story.code(currentProps))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const storiesByCategory = useMemo(() => {
    const grouped: Record<ComponentCategory, Story[]> = {
      general: [],
      forms: [],
      data: [],
      feedback: [],
      layout: [],
    }
    STORIES.forEach((s) => grouped[s.category].push(s))
    return grouped
  }, [])

  const menuItems = CATEGORIES.map((cat) => ({
    key: cat.key,
    icon: cat.icon,
    label: cat.label,
    children: storiesByCategory[cat.key].map((s) => ({
      key: s.id,
      label: s.name,
    })),
  }))

  const renderControl = (control: Control) => {
    const value = currentProps[control.name]

    switch (control.type) {
      case 'select':
        return (
          <Select
            size="small"
            value={value}
            onChange={(v: string | number | undefined) => updateProp(control.name, v)}
            options={control.options}
            style={{ width: '100%' }}
          />
        )
      case 'boolean':
        return (
          <Switch
            size="small"
            checked={value}
            onChange={(v: boolean) => updateProp(control.name, v)}
          />
        )
      case 'text':
        return (
          <Input
            size="small"
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProp(control.name, e.target.value)}
          />
        )
      case 'number':
        return (
          <InputNumber
            size="small"
            value={value}
            onChange={(v: number | null) => updateProp(control.name, v)}
            min={control.min}
            max={control.max}
            step={control.step}
            style={{ width: '100%' }}
          />
        )
      case 'radio':
        return (
          <Radio.Group
            size="small"
            value={value}
            onChange={(e: { target: { value: any } }) => updateProp(control.name, e.target.value)}
          >
            {control.options?.map((opt) => (
              <Radio key={opt.value} value={opt.value}>{opt.label}</Radio>
            ))}
          </Radio.Group>
        )
      default:
        return null
    }
  }

  return (
    <>
      <Head>
        <title>Component Showcase | AOTE Tools</title>
      </Head>
      <Layout style={{ minHeight: '100vh' }}>
        {/* Sidebar */}
        <Sider width={240} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
            <Space>
              <BookOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <Title level={5} style={{ margin: 0 }}>Storybook</Title>
            </Space>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[selectedStory]}
            defaultOpenKeys={CATEGORIES.map((c) => c.key)}
            style={{ borderRight: 0, height: 'calc(100vh - 120px)', overflow: 'auto' }}
            items={menuItems}
            onClick={({ key }: { key: string }) => setSelectedStory(key)}
          />
          <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
            <Button block href="/tools" icon={<HomeOutlined />}>
              Back to Tools
            </Button>
          </div>
        </Sider>

        {/* Main Content */}
        <Layout>
          {/* Header */}
          <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0', height: 'auto', lineHeight: 'normal', paddingTop: 16, paddingBottom: 16 }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Space direction="vertical" size={0}>
                  <Space>
                    <Title level={4} style={{ margin: 0 }}>{story?.component}</Title>
                    <Tag color="blue">{story?.category}</Tag>
                  </Space>
                  <Text type="secondary">{story?.description}</Text>
                </Space>
              </Col>
              <Col>
                <Space>
                  <Button icon={<ControlOutlined />} onClick={resetProps}>Reset</Button>
                  <Button
                    type={showCode ? 'primary' : 'default'}
                    icon={<CodeOutlined />}
                    onClick={() => setShowCode(!showCode)}
                  >
                    {showCode ? 'Hide Code' : 'Show Code'}
                  </Button>
                </Space>
              </Col>
            </Row>
          </Header>

          <Content style={{ display: 'flex', overflow: 'hidden' }}>
            {/* Preview Area */}
            <div style={{ flex: 1, padding: 24, background: '#fafafa', overflow: 'auto' }}>
              <Card title={<Space><PlayCircleOutlined /> Preview</Space>} size="small">
                <div style={{ padding: 24, background: '#fff', borderRadius: 4, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {story && story.render(currentProps)}
                </div>
              </Card>

              {/* Code Panel */}
              {showCode && story && (
                <Card
                  title={<Space><CodeOutlined /> Code</Space>}
                  size="small"
                  style={{ marginTop: 16 }}
                  extra={
                    <Button
                      size="small"
                      icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                      onClick={copyCode}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                  }
                >
                  <pre style={{
                    background: '#1e1e1e',
                    color: '#d4d4d4',
                    padding: 16,
                    borderRadius: 4,
                    overflow: 'auto',
                    fontSize: 13,
                    lineHeight: 1.5,
                    margin: 0,
                  }}>
                    <code>{story.code(currentProps)}</code>
                  </pre>
                </Card>
              )}
            </div>

            {/* Controls Panel */}
            <div style={{ width: 300, background: '#fff', borderLeft: '1px solid #f0f0f0', overflow: 'auto' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
                <Space>
                  <ControlOutlined />
                  <Text strong>Controls</Text>
                </Space>
              </div>
              <div style={{ padding: 16 }}>
                {story?.controls.map((control) => (
                  <div key={control.name} style={{ marginBottom: 16 }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                      {control.label}
                    </Text>
                    {renderControl(control)}
                  </div>
                ))}
              </div>
            </div>
          </Content>
        </Layout>
      </Layout>
    </>
  )
}
