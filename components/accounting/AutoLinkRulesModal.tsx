/**
 * Auto-Link Rules Modal
 *
 * Modal component for managing auto-link rules that automatically
 * categorize imported transactions based on configurable patterns.
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  Modal,
  Table,
  Button,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Space,
  Popconfirm,
  Typography,
  Tag,
  Tooltip,
  Divider,
  Alert,
  App as AntdApp,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type {
  AutoLinkRule,
  AutoLinkRuleInput,
  FieldCondition,
  MatchField,
  MatchOperator,
  AmountCondition,
} from '../../lib/accounting/autoLinker'

const { Text } = Typography
const { TextArea } = Input

// ============================================================================
// Types
// ============================================================================

interface AutoLinkRulesModalProps {
  open: boolean
  onClose: () => void
  accounts: Array<{ code: string; name: string }>
  subsidiaryId?: string
}

interface RuleFormData {
  name: string
  description?: string
  conditions: FieldCondition[]
  amountCondition?: AmountCondition
  isDebit?: boolean | null
  currency?: string
  accountCode: string
  displayNameOverride?: string
  priority: number
  enabled: boolean
}

// ============================================================================
// Constants
// ============================================================================

const MATCH_FIELDS: { value: MatchField; label: string }[] = [
  { value: 'payerName', label: 'Payer Name' },
  { value: 'displayName', label: 'Display Name' },
  { value: 'originalDescription', label: 'Description' },
  { value: 'referenceNumber', label: 'Reference' },
  { value: 'memo', label: 'Memo' },
]

const MATCH_OPERATORS: { value: MatchOperator; label: string }[] = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: 'Equals' },
  { value: 'startsWith', label: 'Starts With' },
  { value: 'endsWith', label: 'Ends With' },
  { value: 'regex', label: 'Regex' },
]

const DIRECTION_OPTIONS = [
  { value: null, label: 'Both (Debit & Credit)' },
  { value: true, label: 'Debit (Outgoing)' },
  { value: false, label: 'Credit (Incoming)' },
]

// ============================================================================
// Component
// ============================================================================

export default function AutoLinkRulesModal({
  open,
  onClose,
  accounts,
  subsidiaryId,
}: AutoLinkRulesModalProps) {
  const { message } = AntdApp.useApp()
  const [form] = Form.useForm()

  const [rules, setRules] = useState<AutoLinkRule[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingRule, setEditingRule] = useState<AutoLinkRule | null>(null)
  const [isFormVisible, setIsFormVisible] = useState(false)
  const [conditions, setConditions] = useState<FieldCondition[]>([])

  // Fetch rules on mount
  useEffect(() => {
    if (open) {
      fetchRules()
    }
  }, [open])

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (subsidiaryId) params.set('subsidiaryId', subsidiaryId)

      const res = await fetch(`/api/accounting/auto-link-rules?${params}`)
      const data = await res.json()

      if (data.success) {
        setRules(data.data || [])
      } else {
        message.error(data.error || 'Failed to fetch rules')
      }
    } catch (err) {
      message.error('Failed to fetch rules')
    } finally {
      setLoading(false)
    }
  }, [subsidiaryId, message])

  const handleCreateNew = () => {
    form.resetFields()
    setConditions([{ field: 'payerName', operator: 'contains', value: '' }])
    setEditingRule(null)
    setIsFormVisible(true)
  }

  const handleEdit = (rule: AutoLinkRule) => {
    setEditingRule(rule)
    setConditions(rule.conditions || [])
    form.setFieldsValue({
      name: rule.name,
      description: rule.description,
      accountCode: rule.accountCode,
      displayNameOverride: rule.displayNameOverride,
      priority: rule.priority || 50,
      enabled: rule.enabled !== false,
      isDebit: rule.isDebit ?? null,
      currency: rule.currency,
    })
    setIsFormVisible(true)
  }

  const handleDelete = async (ruleId: string) => {
    try {
      const res = await fetch(`/api/accounting/auto-link-rules?id=${ruleId}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (data.success) {
        message.success('Rule deleted')
        fetchRules()
      } else {
        message.error(data.error || 'Failed to delete rule')
      }
    } catch (err) {
      message.error('Failed to delete rule')
    }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      const ruleData: AutoLinkRuleInput = {
        name: values.name,
        description: values.description,
        conditions,
        isDebit: values.isDebit ?? undefined,
        currency: values.currency || undefined,
        accountCode: values.accountCode,
        displayNameOverride: values.displayNameOverride || undefined,
        priority: values.priority || 50,
        enabled: values.enabled !== false,
        subsidiaryId,
        createdBy: 'user', // Will be replaced by server with actual user
      }

      const isEdit = !!editingRule
      const url = '/api/accounting/auto-link-rules'
      const method = isEdit ? 'PUT' : 'POST'
      const body = isEdit ? { id: editingRule!.id, ...ruleData } : ruleData

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.success) {
        message.success(isEdit ? 'Rule updated' : 'Rule created')
        setIsFormVisible(false)
        fetchRules()
      } else {
        const errorMsg = data.errors
          ? data.errors.map((e: { message: string }) => e.message).join(', ')
          : data.error
        message.error(errorMsg || 'Failed to save rule')
      }
    } catch (err) {
      // Form validation error
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setIsFormVisible(false)
    setEditingRule(null)
    form.resetFields()
    setConditions([])
  }

  // Condition management
  const addCondition = () => {
    setConditions([...conditions, { field: 'payerName', operator: 'contains', value: '' }])
  }

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index))
  }

  const updateCondition = (index: number, updates: Partial<FieldCondition>) => {
    setConditions(
      conditions.map((c, i) => (i === index ? { ...c, ...updates } : c))
    )
  }

  // ============================================================================
  // Table Columns
  // ============================================================================

  const columns: ColumnsType<AutoLinkRule> = [
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (p: number) => <Text strong>{p}</Text>,
      sorter: (a, b) => (b.priority || 0) - (a.priority || 0),
      defaultSortOrder: 'ascend',
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Conditions',
      key: 'conditions',
      render: (_: unknown, record: AutoLinkRule) => (
        <Space wrap size={[4, 4]}>
          {record.conditions?.slice(0, 2).map((c, i) => (
            <Tag key={i} color="blue">
              {c.field} {c.operator} "{c.value}"
            </Tag>
          ))}
          {(record.conditions?.length || 0) > 2 && (
            <Tag>+{record.conditions!.length - 2} more</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Account',
      dataIndex: 'accountCode',
      key: 'accountCode',
      width: 120,
      render: (code: string) => {
        const account = accounts.find((a) => a.code === code)
        return (
          <Tooltip title={account?.name}>
            <Tag color="green">{code}</Tag>
          </Tooltip>
        )
      },
    },
    {
      title: 'Status',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean) =>
        enabled ? <Tag color="success">Active</Tag> : <Tag>Disabled</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: AutoLinkRule) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this rule?"
            onConfirm={() => handleDelete(record.id!)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Modal
      title="Auto-Link Rules"
      open={open}
      onCancel={onClose}
      width={900}
      footer={
        isFormVisible ? (
          <Space>
            <Button onClick={handleCancel} icon={<CloseOutlined />}>
              Cancel
            </Button>
            <Button
              type="primary"
              onClick={handleSave}
              loading={saving}
              icon={<SaveOutlined />}
            >
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </Space>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      {!isFormVisible ? (
        <>
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreateNew}
              >
                Add Rule
              </Button>
              <Text type="secondary">
                Rules are processed in priority order (highest first)
              </Text>
            </Space>
          </div>

          <Table
            columns={columns}
            dataSource={rules}
            rowKey="id"
            loading={loading}
            pagination={false}
            size="small"
          />
        </>
      ) : (
        <Form form={form} layout="vertical" initialValues={{ priority: 50, enabled: true }}>
          <Alert
            type="info"
            message="Auto-link rules automatically categorize imported transactions based on matching conditions."
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="name"
            label="Rule Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input placeholder="e.g., Google Cloud Platform" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <TextArea rows={2} placeholder="Optional description" />
          </Form.Item>

          <Divider orientation="left">Matching Conditions</Divider>

          {conditions.map((condition, index) => (
            <Space key={index} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
              <Select
                value={condition.field}
                onChange={(v) => updateCondition(index, { field: v })}
                style={{ width: 140 }}
                options={MATCH_FIELDS}
              />
              <Select
                value={condition.operator}
                onChange={(v) => updateCondition(index, { operator: v })}
                style={{ width: 120 }}
                options={MATCH_OPERATORS}
              />
              <Input
                value={condition.value}
                onChange={(e) => updateCondition(index, { value: e.target.value })}
                placeholder="Value to match"
                style={{ width: 200 }}
              />
              {conditions.length > 1 && (
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeCondition(index)}
                />
              )}
            </Space>
          ))}

          <Button
            type="dashed"
            onClick={addCondition}
            icon={<PlusOutlined />}
            style={{ marginBottom: 16 }}
          >
            Add Condition
          </Button>

          <Divider orientation="left">Filters</Divider>

          <Space>
            <Form.Item name="isDebit" label="Direction" style={{ marginBottom: 8 }}>
              <Select
                style={{ width: 180 }}
                options={DIRECTION_OPTIONS}
                allowClear
                placeholder="Both"
              />
            </Form.Item>

            <Form.Item name="currency" label="Currency" style={{ marginBottom: 8 }}>
              <Input style={{ width: 100 }} placeholder="e.g., USD" />
            </Form.Item>
          </Space>

          <Divider orientation="left">Action</Divider>

          <Form.Item
            name="accountCode"
            label="Categorize to Account"
            rules={[{ required: true, message: 'Please select an account' }]}
          >
            <Select
              showSearch
              placeholder="Select GL account"
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={accounts.map((a) => ({
                value: a.code,
                label: `${a.code} - ${a.name}`,
              }))}
            />
          </Form.Item>

          <Form.Item name="displayNameOverride" label="Override Display Name">
            <Input placeholder="Optional: Set a specific display name" />
          </Form.Item>

          <Space>
            <Form.Item
              name="priority"
              label="Priority"
              tooltip="Higher values are processed first (1-100)"
            >
              <InputNumber min={1} max={100} />
            </Form.Item>

            <Form.Item name="enabled" label="Enabled" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      )}
    </Modal>
  )
}
