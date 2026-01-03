/**
 * Form Components
 *
 * Reusable form field components that integrate react-hook-form with Ant Design.
 * These components handle validation display and form state automatically.
 */

import React from 'react'
import {
  Input,
  InputNumber,
  Select,
  DatePicker,
  Checkbox,
  Radio,
  Switch,
  Form,
} from 'antd'
import type { InputProps } from 'antd/es/input'
import type { InputNumberProps } from 'antd/es/input-number'
import type { SelectProps } from 'antd/es/select'
import type { DatePickerProps } from 'antd/es/date-picker'
import type { CheckboxProps } from 'antd/es/checkbox'
import type { RadioGroupProps } from 'antd/es/radio'
import type { SwitchProps } from 'antd/es/switch'
import { Controller, Control, FieldValues, Path, FieldError } from 'react-hook-form'
import dayjs from 'dayjs'

// ============================================================================
// Common Types
// ============================================================================

interface BaseFieldProps<TFieldValues extends FieldValues> {
  name: Path<TFieldValues>
  control: Control<TFieldValues>
  label?: string
  required?: boolean
  help?: string
}

// ============================================================================
// Text Input Field
// ============================================================================

interface FormInputProps<TFieldValues extends FieldValues>
  extends BaseFieldProps<TFieldValues>,
    Omit<InputProps, 'name' | 'value' | 'onChange'> {}

export function FormInput<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  required,
  help,
  ...inputProps
}: FormInputProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <Form.Item
          label={label}
          required={required}
          validateStatus={error ? 'error' : undefined}
          help={error?.message || help}
        >
          <Input {...field} {...inputProps} />
        </Form.Item>
      )}
    />
  )
}

// ============================================================================
// Password Input Field
// ============================================================================

interface FormPasswordProps<TFieldValues extends FieldValues>
  extends BaseFieldProps<TFieldValues>,
    Omit<InputProps, 'name' | 'value' | 'onChange'> {}

export function FormPassword<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  required,
  help,
  ...inputProps
}: FormPasswordProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <Form.Item
          label={label}
          required={required}
          validateStatus={error ? 'error' : undefined}
          help={error?.message || help}
        >
          <Input.Password {...field} {...inputProps} />
        </Form.Item>
      )}
    />
  )
}

// ============================================================================
// TextArea Field
// ============================================================================

interface FormTextAreaProps<TFieldValues extends FieldValues>
  extends BaseFieldProps<TFieldValues>,
    Omit<React.ComponentProps<typeof Input.TextArea>, 'name' | 'value' | 'onChange'> {}

export function FormTextArea<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  required,
  help,
  ...textAreaProps
}: FormTextAreaProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <Form.Item
          label={label}
          required={required}
          validateStatus={error ? 'error' : undefined}
          help={error?.message || help}
        >
          <Input.TextArea {...field} {...textAreaProps} />
        </Form.Item>
      )}
    />
  )
}

// ============================================================================
// Number Input Field
// ============================================================================

interface FormNumberProps<TFieldValues extends FieldValues>
  extends BaseFieldProps<TFieldValues>,
    Omit<InputNumberProps, 'name' | 'value' | 'onChange'> {}

export function FormNumber<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  required,
  help,
  ...inputProps
}: FormNumberProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <Form.Item
          label={label}
          required={required}
          validateStatus={error ? 'error' : undefined}
          help={error?.message || help}
        >
          <InputNumber
            {...inputProps}
            value={field.value}
            onChange={(value: number | null) => field.onChange(value)}
            onBlur={field.onBlur}
            ref={field.ref}
            style={{ width: '100%', ...inputProps.style }}
          />
        </Form.Item>
      )}
    />
  )
}

// ============================================================================
// Select Field
// ============================================================================

interface FormSelectProps<TFieldValues extends FieldValues>
  extends BaseFieldProps<TFieldValues>,
    Omit<SelectProps, 'name' | 'value' | 'onChange'> {}

export function FormSelect<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  required,
  help,
  ...selectProps
}: FormSelectProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <Form.Item
          label={label}
          required={required}
          validateStatus={error ? 'error' : undefined}
          help={error?.message || help}
        >
          <Select
            {...selectProps}
            value={field.value}
            onChange={(value: string | number | string[] | number[]) => field.onChange(value)}
            onBlur={field.onBlur}
            ref={field.ref}
          />
        </Form.Item>
      )}
    />
  )
}

// ============================================================================
// Date Picker Field
// ============================================================================

interface FormDatePickerProps<TFieldValues extends FieldValues>
  extends BaseFieldProps<TFieldValues>,
    Omit<DatePickerProps, 'name' | 'value' | 'onChange'> {
  /** If true, stores as ISO string instead of dayjs object */
  asString?: boolean
}

export function FormDatePicker<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  required,
  help,
  asString = false,
  ...datePickerProps
}: FormDatePickerProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <Form.Item
          label={label}
          required={required}
          validateStatus={error ? 'error' : undefined}
          help={error?.message || help}
        >
          <DatePicker
            {...datePickerProps}
            value={field.value ? dayjs(field.value) : null}
            onChange={(date: dayjs.Dayjs | null) => {
              if (asString) {
                field.onChange(date?.format('YYYY-MM-DD') || null)
              } else {
                field.onChange(date?.toDate() || null)
              }
            }}
            onBlur={field.onBlur}
            ref={field.ref}
            style={{ width: '100%', ...datePickerProps.style }}
          />
        </Form.Item>
      )}
    />
  )
}

// ============================================================================
// Checkbox Field
// ============================================================================

interface FormCheckboxProps<TFieldValues extends FieldValues>
  extends BaseFieldProps<TFieldValues>,
    Omit<CheckboxProps, 'name' | 'checked' | 'onChange'> {
  children?: React.ReactNode
}

export function FormCheckbox<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  required,
  help,
  children,
  ...checkboxProps
}: FormCheckboxProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <Form.Item
          required={required}
          validateStatus={error ? 'error' : undefined}
          help={error?.message || help}
          valuePropName="checked"
        >
          <Checkbox
            {...checkboxProps}
            checked={field.value}
            onChange={(e: { target: { checked: boolean } }) => field.onChange(e.target.checked)}
            onBlur={field.onBlur}
            ref={field.ref}
          >
            {children || label}
          </Checkbox>
        </Form.Item>
      )}
    />
  )
}

// ============================================================================
// Radio Group Field
// ============================================================================

interface FormRadioGroupProps<TFieldValues extends FieldValues>
  extends BaseFieldProps<TFieldValues>,
    Omit<RadioGroupProps, 'name' | 'value' | 'onChange'> {}

export function FormRadioGroup<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  required,
  help,
  ...radioGroupProps
}: FormRadioGroupProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <Form.Item
          label={label}
          required={required}
          validateStatus={error ? 'error' : undefined}
          help={error?.message || help}
        >
          <Radio.Group
            {...radioGroupProps}
            value={field.value}
            onChange={(e: { target: { value: string | number } }) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
            ref={field.ref}
          />
        </Form.Item>
      )}
    />
  )
}

// ============================================================================
// Switch Field
// ============================================================================

interface FormSwitchProps<TFieldValues extends FieldValues>
  extends BaseFieldProps<TFieldValues>,
    Omit<SwitchProps, 'name' | 'checked' | 'onChange'> {}

export function FormSwitch<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  required,
  help,
  ...switchProps
}: FormSwitchProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <Form.Item
          label={label}
          required={required}
          validateStatus={error ? 'error' : undefined}
          help={error?.message || help}
          valuePropName="checked"
        >
          <Switch
            {...switchProps}
            checked={field.value}
            onChange={(checked: boolean) => field.onChange(checked)}
            onBlur={field.onBlur}
            ref={field.ref}
          />
        </Form.Item>
      )}
    />
  )
}

// ============================================================================
// Currency Input Field
// ============================================================================

interface FormCurrencyProps<TFieldValues extends FieldValues>
  extends BaseFieldProps<TFieldValues>,
    Omit<InputNumberProps, 'name' | 'value' | 'onChange'> {
  currency?: string
}

export function FormCurrency<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  required,
  help,
  currency = 'USD',
  ...inputProps
}: FormCurrencyProps<TFieldValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <Form.Item
          label={label}
          required={required}
          validateStatus={error ? 'error' : undefined}
          help={error?.message || help}
        >
          <InputNumber
            {...inputProps}
            value={field.value}
            onChange={(value: number | null) => field.onChange(value)}
            onBlur={field.onBlur}
            ref={field.ref}
            prefix={currency}
            precision={2}
            min={0}
            style={{ width: '100%', ...inputProps.style }}
            formatter={(value: number | string | undefined) =>
              value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
            }
            parser={(value: string | undefined) =>
              value ? parseFloat(value.replace(/,/g, '')) : 0
            }
          />
        </Form.Item>
      )}
    />
  )
}
