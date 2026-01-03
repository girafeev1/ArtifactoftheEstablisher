/**
 * Bank Dashboard Component
 *
 * Generic multi-provider bank dashboard with Airwallex as the primary implementation.
 * Layout: Balance (left half) + Transactions (right half)
 */

import React, { useState, useEffect, useCallback } from "react"
import {
  Card,
  Row,
  Col,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Spin,
  Alert,
  Empty,
  Select,
  Drawer,
  Tooltip,
  Badge,
  Grid,
  Divider,
  Switch,
  App as AntdApp,
} from "antd"
import {
  BankOutlined,
  SendOutlined,
  ReloadOutlined,
  LinkOutlined,
  DisconnectOutlined,
  CopyOutlined,
  GlobalOutlined,
  SwapOutlined,
  CreditCardOutlined,
  TransactionOutlined,
} from "@ant-design/icons"
import type { ColumnsType } from "antd/es/table"
import dayjs from "dayjs"

import type {
  BankAccount,
  BankTransaction,
  Beneficiary,
  BankProviderId,
} from "../../lib/banking/types"
import { BANK_PROVIDERS } from "../../lib/banking/types"
import { getCountryCodeForCurrency } from "../common/CurrencyFlag"

const { Title, Text } = Typography

// ============================================================================
// Types
// ============================================================================

interface BalanceSummary {
  currency: string
  available: number
  total: number
  pending: number
}

interface FxRate {
  buy_currency: string
  sell_currency: string
  rate: number
  buy_amount: number
  sell_amount: number
}

// Major currencies for conversion dropdown
const CONVERSION_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CNY", "AUD", "CAD", "CHF", "SGD", "NZD",
  "HKD", "INR", "KRW", "MXN", "BRL", "ZAR", "SEK", "NOK", "DKK", "THB"
]

interface GlobalAccount {
  id: string
  account_name: string
  account_number: string
  bank_code?: string
  branch_code?: string
  swift_code?: string
  status: string
  institution: {
    name: string
    address?: {
      country_code?: string
    }
  }
  supported_features: Array<{
    currency: string
    transfer_method: string
  }>
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (amount: number, currency: string = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

// Currency Flag Component using circle-flags CDN
const CurrencyFlagIcon: React.FC<{ currency: string; size?: number }> = ({
  currency,
  size = 20,
}) => {
  const countryCode = getCountryCodeForCurrency(currency)
  const flagUrl = `https://hatscripts.github.io/circle-flags/flags/${countryCode}.svg`

  return (
    <img
      src={flagUrl}
      alt={`${currency} flag`}
      width={size}
      height={size}
      style={{ borderRadius: "50%", objectFit: "cover" }}
    />
  )
}

// Airwallex Logo Component - inline SVG for reliability
const AirwallexLogo: React.FC<{ width?: number; height?: number }> = ({
  width = 120,
  height = 20,
}) => {
  return (
    <svg width={width} height={height} viewBox="0 0 175 24" style={{ display: 'block' }}>
      <defs>
        <linearGradient x1="0%" y1="0%" x2="100%" y2="100%" id="awx-gradient">
          <stop stopColor="#FF4244" offset="0%"></stop>
          <stop stopColor="#FF8E3C" offset="100%"></stop>
        </linearGradient>
      </defs>
      <g fill="none" fillRule="evenodd">
        <path d="M34.614 9.421a4.452 4.452 0 0 1 1.057 4.77l-2.347 6.376c-.616 1.674-2.02 2.969-3.755 3.307a4.882 4.882 0 0 1-4.732-1.69L10.763 5.322a.31.31 0 0 0-.528.093L5.656 17.8c-.095.256.157.504.407.402l5.619-2.295a2.481 2.481 0 0 1 3.296 1.546c.415 1.273-.283 2.648-1.512 3.15L6.126 23.6c-1.359.555-2.92.457-4.144-.36a4.461 4.461 0 0 1-1.704-5.26l5.41-14.628C6.329 1.618 7.789.394 9.594.078a5.025 5.025 0 0 1 4.768 1.755l8.078 9.68 7.43-3.035c1.651-.674 3.469-.313 4.744.943zm-4.285 4.862c.094-.256-.158-.504-.408-.401l-4.105 1.676 2.462 2.951a.31.31 0 0 0 .53-.093l1.52-4.133z" fill="url(#awx-gradient)"></path>
        <path d="M150.743 11.045c2.213 0 3.066 1.354 3.185 2.533a.128.128 0 0 1-.128.14h-6.077a.128.128 0 0 1-.127-.144c.164-1.152 1.185-2.529 3.147-2.529zm3.331 7.496a.254.254 0 0 0-.207.105c-.548.772-1.44 1.248-2.772 1.248-1.835 0-3.428-1.206-3.6-2.915a.128.128 0 0 1 .127-.14h10.919c.031-.096.095-.828.095-1.497 0-5.092-3.036-8.116-7.957-8.116-4.122 0-7.925 3.246-7.925 8.339 0 5.316 3.899 8.435 8.277 8.435 3.957 0 6.464-2.214 7.277-4.89.005-.016.032-.116.062-.262a.255.255 0 0 0-.25-.307h-4.046zm9.655-3.057l-5.177-7.38a.255.255 0 0 1 .21-.401h5.09c.087 0 .167.043.215.115l2.66 4.05c.05.077.164.076.214-.002l2.599-4.045a.255.255 0 0 1 .215-.118h4.798c.208 0 .329.233.21.402l-5.108 7.186a.254.254 0 0 0-.001.293c1.672 2.38 3.583 5.13 5.298 7.537.12.169 0 .401-.208.401h-5.055a.256.256 0 0 1-.214-.114l-2.758-4.182a.128.128 0 0 0-.213 0c-.826 1.228-1.906 2.938-2.725 4.182a.255.255 0 0 1-.214.114h-4.712a.254.254 0 0 1-.21-.399l5.087-7.349a.254.254 0 0 0 0-.29zm-27.43 7.784V.733c0-.141.115-.255.256-.255h4.346c.141 0 .256.114.256.255v22.535c0 .14-.115.254-.256.254h-4.346a.255.255 0 0 1-.256-.254zm-7.158 0V.733c0-.141.115-.255.256-.255h4.346c.141 0 .255.114.255.255v22.535c0 .14-.114.254-.255.254h-4.346a.255.255 0 0 1-.256-.254zm-10.748-3.47c1.95 0 3.611-1.527 3.611-4.201 0-2.737-1.63-4.17-3.611-4.17-2.077 0-3.643 1.433-3.643 4.17 0 2.61 1.63 4.202 3.643 4.202zm3.643 1.687c-.703 1.528-2.3 2.483-4.282 2.483-4.666 0-7.893-3.533-7.893-8.403 0-4.71 3.036-8.34 7.733-8.34 2.844 0 4.09 1.56 4.41 2.292v-1.56c0-.14.114-.254.256-.254h4.186c.14 0 .255.114.255.255v15.31c0 .14-.114.254-.255.254h-4.183a.255.255 0 0 1-.255-.258c.008-.575.028-1.904.028-1.779zM99.496 7.878l2.911 8.818c.04.12.21.116.244-.005l2.487-8.802a.255.255 0 0 1 .246-.186h4.22c.173 0 .296.166.245.33l-4.763 15.31a.255.255 0 0 1-.244.18h-4.453a.256.256 0 0 1-.242-.174l-3.27-9.682c-.04-.116-.205-.115-.243 0l-3.21 9.68a.255.255 0 0 1-.242.175h-4.549a.256.256 0 0 1-.244-.178l-4.825-15.31a.255.255 0 0 1 .244-.331h4.508c.114 0 .215.076.246.186l2.487 8.774c.034.12.204.124.244.005l2.942-8.79a.256.256 0 0 1 .243-.175h4.775c.11 0 .209.07.243.175zm-17.25 4.287a.255.255 0 0 1-.299.251 7.027 7.027 0 0 0-1.235-.098c-1.95 0-3.707 1.146-3.707 4.297v6.653c0 .14-.114.254-.255.254h-4.346a.255.255 0 0 1-.256-.254V7.958c0-.14.114-.255.256-.255h4.186c.141 0 .255.114.255.255v1.878c.831-1.783 2.845-2.292 4.123-2.292.388 0 .776.042 1.079.108.117.026.199.13.199.249v4.264zM64.894 23.268V7.958c0-.14.115-.255.256-.255h4.346c.141 0 .256.114.256.255v15.31c0 .14-.115.254-.256.254H65.15a.255.255 0 0 1-.256-.254zM67.291.032c1.598 0 2.876 1.273 2.876 2.833 0 1.56-1.278 2.833-2.876 2.833-1.534 0-2.812-1.273-2.812-2.833 0-1.56 1.278-2.833 2.812-2.833zM49.417 14.355h5.136c.088 0 .15-.086.12-.169L52.137 6.9a.128.128 0 0 0-.242-.001l-2.597 7.287c-.03.082.032.17.12.17zm6.733 4.584h-8.395a.255.255 0 0 0-.24.17l-1.51 4.244a.255.255 0 0 1-.241.17H41.01a.255.255 0 0 1-.24-.345L49.11 1.12a.255.255 0 0 1 .239-.165h5.494c.106 0 .202.066.239.166l8.246 22.058a.255.255 0 0 1-.24.343h-4.947a.256.256 0 0 1-.241-.17l-1.51-4.243a.256.256 0 0 0-.24-.17z" fill="#000"></path>
      </g>
    </svg>
  )
}

const AirwallexIcon: React.FC<{ size?: number }> = ({ size = 24 }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: 'block' }}>
      <defs>
        <linearGradient x1="0%" y1="0%" x2="100%" y2="100%" id="awx-icon-gradient">
          <stop stopColor="#FF4244" offset="0%"></stop>
          <stop stopColor="#FF8E3C" offset="100%"></stop>
        </linearGradient>
      </defs>
      <path d="M23.076 6.281a2.97 2.97 0 0 1 .705 3.18l-1.565 4.251c-.41 1.116-1.347 1.98-2.503 2.205a3.255 3.255 0 0 1-3.155-1.127L7.175 3.548a.207.207 0 0 0-.352.062l-3.053 8.28c-.063.17.105.336.271.268l3.746-1.53a1.654 1.654 0 0 1 2.197 1.03c.277.849-.188 1.766-1.008 2.1l-4.81 1.964c-.906.37-1.947.305-2.763-.24a2.974 2.974 0 0 1-1.136-3.507l3.607-9.752C4.22 1.079 5.193.262 6.396.052a3.35 3.35 0 0 1 3.179 1.17l5.385 6.453 4.953-2.023c1.1-.45 2.313-.209 3.163.629zm-2.857 3.241c.063-.17-.105-.336-.272-.267l-2.737 1.117 1.642 1.967a.207.207 0 0 0 .353-.062l1.014-2.755z" fill="url(#awx-icon-gradient)" transform="translate(4 4)"></path>
    </svg>
  )
}

// OCBC Logo Component - circular symbol with rays + "OCBC" text paths
// Using SVG paths for authentic letter shapes matching official branding
const OCBCLogo: React.FC<{ width?: number; height?: number }> = ({
  width = 130,
  height = 30,
}) => {
  return (
    <svg width={width} height={height} viewBox="0 0 130 30" style={{ display: 'block' }}>
      {/* Circular symbol with rays */}
      <g transform="translate(1, 1) scale(0.063)">
        <path fill="#e30513" d="m209.1 0.7c-36.2 0-70.2 9.8-99.9 26.9l39.4 48.9 28 33.7c11.3-4.1 23.4-6.3 36-6.3 61.4 0 111.2 52.6 111.2 117.4 0 45.7-24.8 85.3-60.9 104.7-2.3 1.4-43 25.6-112.7 25.6l-109.9-0.3c38 54.9 99.5 90.6 168.8 90.6 115.4 0 209-98.8 209-220.6 0-121.8-93.6-220.6-209-220.6zm-165 85.3l84 59c8.7-10.7 19.2-19.8 31-26.7l-72.7-75.5c-16 12.3-30.2 26.8-42.3 43.2zm77.1 121.6l103 41.9v-25.7l-87.7-52.6c-6.9 9.6-12.3 21.6-15.3 36.4zm26.4-48.9l76.6 53.8v-26.7l-44.3-45.9c-11.2 3.9-22.5 9.9-32.3 18.8zm76.6 131.3v-29.6l-105.3-35c-1 17 0.8 37.2 6.2 61 0 0-24-26.3-24.2-67l-98.2-32.6c-1.7 11.2-2.6 22.7-2.6 34.5 0 24 3.7 47 10.4 68.7zm-215.9-129.6l93.4 39.7c2.3-14.6 7.3-28.1 14.4-40.1l-85.4-53.5c-9.6 16.6-17.2 34.8-22.4 53.9zm91.5 143h-84.5c4.4 11.7 9.8 23 16 33.6h150.9l19.3-21.4h-90.8z"/>
      </g>
      {/* OCBC text - using paths for authentic look */}
      <g transform="translate(34, 6)" fill="#e30513">
        {/* O */}
        <path d="M0 9.5C0 4.3 3.8 0.5 9 0.5C14.2 0.5 18 4.3 18 9.5C18 14.7 14.2 18.5 9 18.5C3.8 18.5 0 14.7 0 9.5ZM9 15.2C12.1 15.2 14.3 12.8 14.3 9.5C14.3 6.2 12.1 3.8 9 3.8C5.9 3.8 3.7 6.2 3.7 9.5C3.7 12.8 5.9 15.2 9 15.2Z"/>
        {/* C */}
        <path d="M22 9.5C22 4.3 25.8 0.5 31 0.5C34.5 0.5 37.2 2.2 38.5 4.8L35.3 6.5C34.5 5 32.9 3.8 31 3.8C27.9 3.8 25.7 6.2 25.7 9.5C25.7 12.8 27.9 15.2 31 15.2C32.9 15.2 34.5 14 35.3 12.5L38.5 14.2C37.2 16.8 34.5 18.5 31 18.5C25.8 18.5 22 14.7 22 9.5Z"/>
        {/* B */}
        <path d="M42 0.8H50.5C54.2 0.8 56.5 2.8 56.5 5.8C56.5 7.5 55.7 8.9 54.3 9.7C56.2 10.5 57.3 12.1 57.3 14C57.3 17.2 54.8 18.2 51 18.2H42V0.8ZM50 8.2C52 8.2 53 7.4 53 5.9C53 4.5 52 3.7 50 3.7H45.5V8.2H50ZM50.5 15.3C52.7 15.3 53.8 14.5 53.8 12.8C53.8 11.2 52.7 10.4 50.5 10.4H45.5V15.3H50.5Z"/>
        {/* C */}
        <path d="M61 9.5C61 4.3 64.8 0.5 70 0.5C73.5 0.5 76.2 2.2 77.5 4.8L74.3 6.5C73.5 5 71.9 3.8 70 3.8C66.9 3.8 64.7 6.2 64.7 9.5C64.7 12.8 66.9 15.2 70 15.2C71.9 15.2 73.5 14 74.3 12.5L77.5 14.2C76.2 16.8 73.5 18.5 70 18.5C64.8 18.5 61 14.7 61 9.5Z"/>
      </g>
    </svg>
  )
}

// OCBC Icon - official sun/rays symbol
const OCBCIcon: React.FC<{ size?: number }> = ({ size = 24 }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 1549 1635" style={{ display: 'block' }}>
      <path fill="#e30513" fillRule="evenodd" d="m1548.7 817.6c0 451.1-346.7 817-774.2 817-256.7 0-484.5-132.2-625.2-335.5l407 1.1c258.2 0 409-89.6 417.5-94.8 133.7-71.9 225.6-218.5 225.6-387.8 0-240-184.5-434.8-411.9-434.8-46.7 0-91.5 8.2-133.4 23.3l-103.7-124.8-145.9-181.1c110-63.3 235.9-99.6 370-99.6 427.5 0 774.2 365.9 774.2 817zm-1228.7-661.1l269.3 279.6c-43.7 25.6-82.6 59.3-114.8 98.9l-311.2-218.5c44.9-60.7 97.5-114.4 156.7-160zm185.6 475.6l324.8 194.8v95.2l-381.5-155.2c11.1-54.8 31.1-99.3 56.7-134.8zm160.8-116l164 170v98.9l-283.7-199.2c36.3-33 78.2-55.2 119.7-69.7zm-627.5 555.9c-24.8-80.3-38.5-165.5-38.5-254.4 0-43.7 3.3-86.3 9.6-127.8l363.7 120.8c0.8 150.7 89.7 248.1 89.7 248.1-20-88.1-26.7-162.9-23-225.9l390 129.6v109.6zm74.9-679.6l316.3 198.2c-26.3 44.4-44.8 94.4-53.3 148.5l-346-147c19.3-70.8 47.4-138.2 83-199.7zm296.3 774.5h336.3l-71.5 79.2h-558.9c-23-39.2-43-81.1-59.3-124.4h313z"/>
    </svg>
  )
}

// Fubon Bank Logo Component - official FB symbol + Traditional Chinese text
// Based on official branding: teal (#009e9c) and blue (#008fc7)
const FubonLogo: React.FC<{ width?: number; height?: number }> = ({
  width = 140,
  height = 34,
}) => {
  return (
    <svg width={width} height={height} viewBox="0 0 160 42" style={{ display: 'block' }}>
      <g transform="translate(0, 0)">
        {/* FB Symbol - F part (blue) */}
        <g transform="matrix(1.25,0,0,1.25,13.5,20)">
          <path fill="#008fc7" d="m 0,0 -1.446,0 0,-0.008 c -2.65,-0.068 -5.423,-0.906 -7.268,-3.003 -1.948,-2.217 -2.133,-4.183 -2.133,-7.431 l 0,-23.204 15.852,0 0,9.109 5.018,0 0,5.114 -10.068,0 0,-9.18 -5.756,0 0,19.232 c 0,0 -0.375,4.179 4.653,4.292 L 0.003,-5.022 0,0 z"/>
        </g>
        {/* FB Symbol - B part (teal) */}
        <g transform="matrix(1.25,0,0,1.25,30.4,16.7)">
          <path fill="#009e9c" d="M 0,0 C -0.017,-0.012 0.017,0.004 0,0 0,0 -0.002,-0.098 0.284,-0.299 2.077,-1.742 3.025,-3.133 3.013,-5.975 3,-9.521 -0.076,-12.096 -3.571,-12.096 l 0,-4.902 c 6.085,0 11.612,4.338 11.612,10.519 0,2.213 -0.603,4.391 -2.109,6.514 0.067,0.086 0.391,0.47 0.657,0.944 0.373,0.654 0.442,1.453 0.442,4.119 l 0,11.555 -15.608,0 0,-9.21 -4.973,0 0,-5.055 10.059,0 0,9.085 5.615,0 0,-7.839 C 2.124,3.634 2.353,1.447 0,0"/>
        </g>
        {/* 富邦銀行 Traditional Chinese text */}
        <text x="52" y="29" fill="#000000" fontFamily="'PingFang TC', 'Microsoft JhengHei', 'Heiti TC', sans-serif" fontSize="20" fontWeight="600" letterSpacing="1">
          富邦銀行
        </text>
      </g>
    </svg>
  )
}

// Fubon Bank Icon - official FB symbol only
const FubonIcon: React.FC<{ size?: number }> = ({ size = 24 }) => {
  const scale = size / 42
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ display: 'block' }}>
      {/* FB Symbol - F part (blue) */}
      <g transform="matrix(1.25,0,0,1.25,13.5,20)">
        <path fill="#008fc7" d="m 0,0 -1.446,0 0,-0.008 c -2.65,-0.068 -5.423,-0.906 -7.268,-3.003 -1.948,-2.217 -2.133,-4.183 -2.133,-7.431 l 0,-23.204 15.852,0 0,9.109 5.018,0 0,5.114 -10.068,0 0,-9.18 -5.756,0 0,19.232 c 0,0 -0.375,4.179 4.653,4.292 L 0.003,-5.022 0,0 z"/>
      </g>
      {/* FB Symbol - B part (teal) */}
      <g transform="matrix(1.25,0,0,1.25,30.4,16.7)">
        <path fill="#009e9c" d="M 0,0 C -0.017,-0.012 0.017,0.004 0,0 0,0 -0.002,-0.098 0.284,-0.299 2.077,-1.742 3.025,-3.133 3.013,-5.975 3,-9.521 -0.076,-12.096 -3.571,-12.096 l 0,-4.902 c 6.085,0 11.612,4.338 11.612,10.519 0,2.213 -0.603,4.391 -2.109,6.514 0.067,0.086 0.391,0.47 0.657,0.944 0.373,0.654 0.442,1.453 0.442,4.119 l 0,11.555 -15.608,0 0,-9.21 -4.973,0 0,-5.055 10.059,0 0,9.085 5.615,0 0,-7.839 C 2.124,3.634 2.353,1.447 0,0"/>
      </g>
    </svg>
  )
}

const getTransactionTypeIcon = (sourceType?: string) => {
  const type = (sourceType || "").toLowerCase()
  if (type.includes("card")) return <CreditCardOutlined />
  if (type.includes("transfer") || type.includes("payment")) return <SendOutlined />
  if (type.includes("conversion") || type.includes("fx")) return <SwapOutlined />
  if (type.includes("global") || type.includes("deposit")) return <GlobalOutlined />
  return <TransactionOutlined />
}

const getTransactionTypeLabel = (sourceType?: string, transactionType?: string): string => {
  const type = (sourceType || transactionType || "").toLowerCase()
  if (type.includes("card")) return "Cards"
  if (type.includes("payout") || type.includes("payment")) return "Transfers"
  if (type.includes("conversion") || type.includes("fx")) return "Conversion"
  if (type.includes("global_account")) return "Global Accounts"
  if (type.includes("deposit") || type.includes("funding")) return "Deposit"
  if (type.includes("withdrawal")) return "Withdrawal"
  if (type.includes("fee")) return "Fee"
  return sourceType || transactionType || "Transaction"
}

// ============================================================================
// Balance Card Component (Left Side)
// ============================================================================

interface BalanceCardProps {
  balances: BalanceSummary[]
  viewCurrency: string
  onCurrencyChange: (currency: string) => void
  convertToCurrency: string
  onConvertCurrencyChange: (currency: string) => void
  fxRates: Record<string, number>  // Currency -> rate to convertToCurrency
  fxLoading?: boolean
  loading?: boolean
}

// Currencies to show in the All Wallets section
const DISPLAY_CURRENCIES = ["HKD", "CNY", "EUR", "USD", "GBP"]

const BalanceCard: React.FC<BalanceCardProps> = ({
  balances,
  viewCurrency,
  onCurrencyChange,
  convertToCurrency,
  onConvertCurrencyChange,
  fxRates,
  fxLoading,
  loading,
}) => {
  const [showConverted, setShowConverted] = useState(false)

  // Filter wallets to only show specific currencies
  const displayWallets = DISPLAY_CURRENCIES.map(currency => {
    const wallet = balances.find(b => b.currency === currency)
    return wallet || { currency, available: 0, total: 0, pending: 0 }
  })

  const showConversion = convertToCurrency !== viewCurrency

  // Calculate total balance: sum of ALL wallets converted to target currency
  const totalConverted = displayWallets.reduce((sum, wallet) => {
    if (wallet.currency === convertToCurrency) {
      // Same currency, no conversion needed
      return sum + wallet.total
    }
    const rate = fxRates[wallet.currency] || 0
    return sum + (wallet.total * rate)
  }, 0)

  // For display: show converted total when conversion is active, otherwise show selected wallet balance
  const selectedBalance = balances.find(b => b.currency === viewCurrency)
  const displayCurrency = showConversion ? convertToCurrency : viewCurrency
  const displayAmount = showConversion ? totalConverted : (selectedBalance?.total || 0)

  // Build currency options for conversion (exclude current viewCurrency)
  const conversionOptions = CONVERSION_CURRENCIES
    .filter(c => c !== viewCurrency)
    .map(c => ({ value: c, label: c }))

  return (
    <Card
      title={
        <Row justify="space-between" align="middle">
          <Text strong style={{ fontSize: 16 }}>Balance</Text>
          <Select
            value={convertToCurrency}
            onChange={onConvertCurrencyChange}
            style={{ width: 90 }}
            size="small"
            loading={fxLoading}
            options={[
              { value: viewCurrency, label: viewCurrency },
              ...conversionOptions
            ]}
            optionRender={(option: { value?: React.ReactNode; label?: React.ReactNode }) => (
              <Space>
                <CurrencyFlagIcon currency={option.value as string} size={16} />
                <span>{option.value}</span>
              </Space>
            )}
          />
        </Row>
      }
      loading={loading}
      style={{ height: "100%" }}
    >
      {/* Total Balance Header - shows converted currency when selected */}
      <div style={{ marginBottom: 16 }}>
        <Space align="center">
          <CurrencyFlagIcon currency={displayCurrency} size={32} />
          <div>
            <Title level={2} style={{ margin: 0 }}>
              {fxLoading && showConversion ? "..." : formatCurrency(displayAmount, displayCurrency)}
            </Title>
            <Text type="secondary">Total balance</Text>
          </div>
        </Space>
      </div>

      <Divider style={{ margin: "16px 0" }} />

      {/* All Wallet Balances */}
      <div>
        <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ALL WALLETS
          </Text>
          {showConversion && (
            <Tooltip title={showConverted ? `Show native currencies` : `Show as ${convertToCurrency}`}>
              <Switch
                size="small"
                checked={showConverted}
                onChange={setShowConverted}
                checkedChildren={convertToCurrency}
                unCheckedChildren="FX"
              />
            </Tooltip>
          )}
        </Row>
        <Space direction="vertical" style={{ width: "100%" }} size={8}>
          {displayWallets
            .filter(wallet => wallet.currency !== viewCurrency) // Exclude view currency (shown in Total)
            .map(wallet => {
              // Calculate converted amount for this wallet
              const rate = wallet.currency === convertToCurrency ? 1 : (fxRates[wallet.currency] || 0)
              const walletConverted = showConverted && rate > 0
                ? wallet.total * rate
                : wallet.total
              const walletDisplayCurrency = showConverted ? convertToCurrency : wallet.currency

              return (
                <Row
                  key={wallet.currency}
                  justify="space-between"
                  align="middle"
                  style={{
                    padding: "8px 12px",
                    background: "transparent",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                  onClick={() => onCurrencyChange(wallet.currency)}
                >
                  <Col>
                    <Space>
                      <CurrencyFlagIcon currency={wallet.currency} size={24} />
                      <div>
                        <Text strong>{wallet.currency}</Text>
                        {wallet.pending > 0 && (
                          <div>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              Pending: {formatCurrency(wallet.pending, wallet.currency)}
                            </Text>
                          </div>
                        )}
                      </div>
                    </Space>
                  </Col>
                  <Col>
                    <Text strong>
                      {showConverted && fxLoading ? "..." : formatCurrency(walletConverted, walletDisplayCurrency)}
                    </Text>
                  </Col>
                </Row>
              )
            })}
        </Space>
      </div>
    </Card>
  )
}

// ============================================================================
// Transaction Detail Drawer
// ============================================================================

interface TransactionDetailDrawerProps {
  transaction: BankTransaction | null
  open: boolean
  onClose: () => void
}

const TransactionDetailDrawer: React.FC<TransactionDetailDrawerProps> = ({
  transaction,
  open,
  onClose,
}) => {
  const { message } = AntdApp.useApp()

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    message.success("Copied to clipboard")
  }

  if (!transaction) return null

  const typeLabel = getTransactionTypeLabel(
    transaction.metadata?.source_type,
    transaction.metadata?.transaction_type
  )

  // Check if this is a card transaction
  const isCardTransaction = (transaction.metadata?.source_type || "").toLowerCase().includes("card")
  const isTransfer = typeLabel === "Transfers"
  const isDeposit = typeLabel === "Global Accounts" || typeLabel === "Deposit"

  const isCredit = transaction.type === "credit"

  // Get status badge color and label
  const getStatusBadge = () => {
    const status = transaction.status
    if (status === "completed") return { color: "green", label: "Succeeded" }
    if (status === "pending") return { color: "gold", label: "Pending" }
    if (status === "failed") return { color: "red", label: "Failed" }
    return { color: "default", label: status.charAt(0).toUpperCase() + status.slice(1) }
  }
  const statusBadge = getStatusBadge()

  // Extract merchant info - prefer enriched metadata from card transactions API
  const getMerchantInfo = () => {
    if (!isCardTransaction) return null
    const meta = transaction.metadata || {}

    // Use enriched merchant data if available
    if (meta.merchant_name) {
      return {
        name: meta.merchant_name,
        category: meta.merchant_category,
        city: meta.merchant_city,
        country: meta.merchant_country,
        location: meta.location,
      }
    }

    // Fallback: Try to extract merchant name from description like "Purchase from GOOGLE*CLOUD..."
    const desc = transaction.description || ""
    const match = desc.match(/Purchase from ([^,]+)/)
    if (match) {
      return { name: match[1].trim(), category: meta.merchant_category }
    }

    return { name: transaction.counterparty?.name, category: meta.merchant_category }
  }
  const merchantInfo = getMerchantInfo()

  // Drawer title based on transaction type
  const drawerTitle = isCardTransaction ? "Card transaction details" :
                      isTransfer ? "Transfer details" :
                      isDeposit ? "Deposit details" : "Transaction details"

  return (
    <Drawer
      title={drawerTitle}
      placement="right"
      onClose={onClose}
      open={open}
      width={420}
    >
      <Space direction="vertical" style={{ width: "100%" }} size={16}>
        {/* Amount & Status Header - like Airwallex */}
        <div>
          <Space align="baseline" size={12}>
            <Title level={2} style={{ margin: 0 }}>
              {isCredit ? "+" : "-"}{formatCurrency(Math.abs(transaction.amount), transaction.currency).replace(/[A-Z]{3}\s*/, "")}
            </Title>
            <Text style={{ fontSize: 16 }}>{transaction.currency}</Text>
            <Tag color={statusBadge.color} style={{ marginLeft: 8 }}>{statusBadge.label}</Tag>
          </Space>
        </div>

        {/* Timestamps */}
        <div style={{ color: "#666", fontSize: 13 }}>
          <div>Initiated on {dayjs(transaction.date).format("MMM DD, YYYY, h:mm A")}</div>
          {transaction.postedDate && (
            <div>Settled on {dayjs(transaction.postedDate).format("MMM DD, YYYY, h:mm A")}</div>
          )}
        </div>

        <Divider style={{ margin: "8px 0" }} />

        {/* Transaction details section */}
        <div>
          <Text strong style={{ fontSize: 14 }}>Transaction details</Text>
        </div>

        <Row gutter={[16, 12]}>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 12, display: "block" }}>Transaction amount</Text>
            <Text>{isCredit ? "" : "-"}{formatCurrency(Math.abs(transaction.amount), transaction.currency)}</Text>
          </Col>
          {isCardTransaction && (
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12, display: "block" }}>Billing amount</Text>
              <Text>{isCredit ? "" : "-"}{formatCurrency(Math.abs(transaction.amount), transaction.currency)}</Text>
            </Col>
          )}
          {(transaction.metadata?.location || merchantInfo?.location) && (
            <Col span={24}>
              <Text type="secondary" style={{ fontSize: 12, display: "block" }}>Location</Text>
              <Text>{transaction.metadata?.location || merchantInfo?.location}</Text>
            </Col>
          )}
          {transaction.metadata?.decline_reason && (
            <Col span={24}>
              <Text type="secondary" style={{ fontSize: 12, display: "block" }}>Declined reason</Text>
              <Text type="danger">{transaction.metadata.decline_reason}</Text>
            </Col>
          )}
        </Row>

        {/* Merchant details section - for card transactions */}
        {isCardTransaction && merchantInfo && (
          <>
            <Divider style={{ margin: "8px 0" }} />
            <div>
              <Text strong style={{ fontSize: 14 }}>Merchant details</Text>
            </div>
            <Row gutter={[16, 12]}>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12, display: "block" }}>Merchant name</Text>
                <Text>{merchantInfo.name || "—"}</Text>
              </Col>
              {merchantInfo.category && (
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12, display: "block" }}>Merchant category</Text>
                  <Text>{merchantInfo.category}</Text>
                </Col>
              )}
            </Row>
          </>
        )}

        {/* Card info box - for card transactions */}
        {isCardTransaction && transaction.metadata?.card_last_four && (
          <Card size="small" style={{ background: "#f8f9fa", marginTop: 8 }}>
            <Space>
              <CreditCardOutlined style={{ fontSize: 24, color: "#666" }} />
              <div>
                <Text strong style={{ display: "block" }}>Company Card</Text>
                <Text type="secondary">Company card •••• {transaction.metadata.card_last_four}</Text>
              </div>
            </Space>
          </Card>
        )}

        {/* Transfer details - Payer and Recipient */}
        {isTransfer && (
          <>
            <Divider style={{ margin: "8px 0" }} />
            <div>
              <Text strong style={{ fontSize: 14 }}>Transfer details</Text>
            </div>
            <Row gutter={[16, 12]}>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12, display: "block" }}>Status</Text>
                <Tag color={statusBadge.color}>{statusBadge.label === "Succeeded" ? "Paid" : statusBadge.label}</Tag>
              </Col>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12, display: "block" }}>Payer name</Text>
                <Text>{transaction.metadata?.payer_name || "—"}</Text>
              </Col>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12, display: "block" }}>Recipient name</Text>
                <Text>{transaction.counterparty?.name || transaction.metadata?.recipient_name || "—"}</Text>
              </Col>
              {transaction.reference && (
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12, display: "block" }}>Reference</Text>
                  <Text>{transaction.reference}</Text>
                </Col>
              )}
            </Row>
          </>
        )}

        {/* Deposit details - From and To */}
        {isDeposit && (
          <>
            <Divider style={{ margin: "8px 0" }} />
            <div>
              <Text strong style={{ fontSize: 14 }}>Deposit details</Text>
            </div>
            <Row gutter={[16, 12]}>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12, display: "block" }}>Status</Text>
                <Tag color={statusBadge.color}>{statusBadge.label === "Succeeded" ? "Settled" : statusBadge.label}</Tag>
              </Col>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12, display: "block" }}>From</Text>
                <Text>{transaction.metadata?.from_account || transaction.counterparty?.accountNumber || "—"}</Text>
              </Col>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12, display: "block" }}>To</Text>
                <Text>{transaction.metadata?.to_name || "—"}</Text>
              </Col>
              {transaction.reference && (
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12, display: "block" }}>Reference</Text>
                  <Text>{transaction.reference}</Text>
                </Col>
              )}
            </Row>
          </>
        )}

        <Divider style={{ margin: "8px 0" }} />

        {/* Transaction ID */}
        <Row gutter={[16, 12]}>
          <Col span={24}>
            <Text type="secondary" style={{ fontSize: 12, display: "block" }}>Transaction ID</Text>
            <Space>
              <Text style={{ fontSize: 13, wordBreak: "break-all" }}>{transaction.id}</Text>
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => copyToClipboard(transaction.id)}
              />
            </Space>
          </Col>
          <Col span={24}>
            <Text type="secondary" style={{ fontSize: 12, display: "block" }}>Description</Text>
            <Text>{transaction.description || "—"}</Text>
          </Col>
        </Row>
      </Space>
    </Drawer>
  )
}

// ============================================================================
// Transactions Table Component (Right Side)
// ============================================================================

interface TransactionsTableProps {
  transactions: BankTransaction[]
  loading?: boolean
  onRowClick: (transaction: BankTransaction) => void
  onViewAll?: () => void
  showViewAll?: boolean
}

const TransactionsTable: React.FC<TransactionsTableProps> = ({
  transactions,
  loading,
  onRowClick,
  onViewAll,
  showViewAll = true,
}) => {
  const [showAll, setShowAll] = useState(false)

  // Columns matching Airwallex UI: DATE, PRODUCT, DETAILS, AMOUNT
  const columns: ColumnsType<BankTransaction> = [
    {
      title: "DATE",
      dataIndex: "date",
      key: "date",
      width: 100,
      render: (date: string) => (
        <Text style={{ fontSize: 13 }}>{dayjs(date).format("MMM DD, YYYY HH:mm")}</Text>
      ),
      sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
      defaultSortOrder: "descend",
    },
    {
      title: "PRODUCT",
      key: "product",
      width: 130,
      render: (_, record) => {
        const typeLabel = getTransactionTypeLabel(
          record.metadata?.source_type,
          record.metadata?.transaction_type
        )
        return (
          <Space size={6}>
            {getTransactionTypeIcon(record.metadata?.source_type)}
            <Text strong style={{ fontSize: 13 }}>{typeLabel}</Text>
          </Space>
        )
      },
    },
    {
      title: "DETAILS",
      key: "details",
      ellipsis: true,
      render: (_, record) => {
        const details = record.description || ""
        return (
          <Tooltip title={details}>
            <Text style={{ fontSize: 15 }} ellipsis>
              {details}
            </Text>
          </Tooltip>
        )
      },
    },
    {
      title: "AMOUNT",
      key: "amount",
      width: 120,
      align: "right" as const,
      render: (_, record) => {
        const isCredit = record.type === "credit"
        const sign = isCredit ? "+" : "-"
        const color = isCredit ? "#52c41a" : undefined
        return (
          <Text style={{ fontSize: 13, color, fontWeight: 500 }}>
            {sign}{formatCurrency(Math.abs(record.amount), record.currency)}
          </Text>
        )
      },
      sorter: (a, b) => {
        const aVal = a.type === "credit" ? a.amount : -a.amount
        const bVal = b.type === "credit" ? b.amount : -b.amount
        return aVal - bVal
      },
    },
  ]

  // Show 10 items initially, all when "View all" is clicked
  const displayedTransactions = showAll ? transactions : transactions.slice(0, 10)

  return (
    <Card
      title={
        <Space>
          <Text strong style={{ fontSize: 16 }}>Transactions</Text>
          {showViewAll && transactions.length > 10 && !showAll && (
            <Button
              type="link"
              size="small"
              style={{ padding: 0, fontSize: 14 }}
              onClick={() => setShowAll(true)}
            >
              View all
            </Button>
          )}
        </Space>
      }
      style={{ height: "100%" }}
      bodyStyle={{ padding: 0 }}
    >
      <Table
        dataSource={displayedTransactions}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={showAll ? {
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total: number) => `${total} transactions`,
          size: "small",
        } : false}
        size="small"
        onRow={(record: BankTransaction, index?: number) => ({
          onClick: () => onRowClick(record),
          style: {
            cursor: "pointer",
            background: index !== undefined && index % 2 === 1 ? "#fafafa" : "#fff",
          },
        })}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No transactions"
            />
          ),
        }}
      />
    </Card>
  )
}

// ============================================================================
// Global Accounts Card Component
// ============================================================================

interface GlobalAccountsCardProps {
  globalAccounts: GlobalAccount[]
  loading?: boolean
}

const GlobalAccountsCard: React.FC<GlobalAccountsCardProps> = ({
  globalAccounts,
  loading,
}) => {
  const { message } = AntdApp.useApp()

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    message.success(`${label} copied`)
  }

  if (loading) {
    return (
      <Card title={<Space><GlobalOutlined /> Receive Funds</Space>}>
        <Spin />
      </Card>
    )
  }

  if (globalAccounts.length === 0) return null

  return (
    <Card
      title={<Space><GlobalOutlined /><Text strong>Receive Funds</Text></Space>}
      size="small"
    >
      {globalAccounts.map((account) => (
        <div key={account.id} style={{ marginBottom: 16 }}>
          <Row gutter={[16, 8]}>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 11 }}>Bank</Text>
              <div><Text style={{ fontSize: 13 }}>{account.institution.name}</Text></div>
            </Col>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 11 }}>Account Number</Text>
              <div>
                <Space size={4}>
                  <Text code style={{ fontSize: 12 }}>{account.account_number}</Text>
                  <CopyOutlined
                    style={{ cursor: "pointer", fontSize: 12 }}
                    onClick={() => copyToClipboard(account.account_number, "Account number")}
                  />
                </Space>
              </div>
            </Col>
            {account.swift_code && (
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 11 }}>SWIFT</Text>
                <div>
                  <Space size={4}>
                    <Text code style={{ fontSize: 12 }}>{account.swift_code}</Text>
                    <CopyOutlined
                      style={{ cursor: "pointer", fontSize: 12 }}
                      onClick={() => copyToClipboard(account.swift_code!, "SWIFT code")}
                    />
                  </Space>
                </div>
              </Col>
            )}
          </Row>
        </div>
      ))}
    </Card>
  )
}

// ============================================================================
// Main Bank Dashboard Component
// ============================================================================

interface BankDashboardProps {
  providerId?: BankProviderId
}

const BankDashboard: React.FC<BankDashboardProps> = ({
  providerId = "airwallex",
}) => {
  const screens = Grid.useBreakpoint()
  const { message } = AntdApp.useApp()

  // State
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [balances, setBalances] = useState<BalanceSummary[]>([])
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [globalAccounts, setGlobalAccounts] = useState<GlobalAccount[]>([])
  const [error, setError] = useState<string | null>(null)

  // UI State
  const [viewCurrency, setViewCurrency] = useState("HKD")
  const [convertToCurrency, setConvertToCurrency] = useState("USD")
  const [fxRates, setFxRates] = useState<Record<string, number>>({})  // Currency -> rate to convertToCurrency
  const [fxLoading, setFxLoading] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const provider = BANK_PROVIDERS[providerId]

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch(`/api/${providerId}/auth?action=status`, {
        credentials: "include",
      })
      const data = await response.json()
      const isConnected = data.data?.connected || false
      setConnected(isConnected)
      return isConnected
    } catch {
      setConnected(false)
      return false
    }
  }, [providerId])

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch(`/api/${providerId}/accounts`, {
        credentials: "include",
      })
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch accounts")
      }

      const mappedAccounts: BankAccount[] = (data.data?.accounts || []).map((acc: any) => ({
        id: acc.id,
        provider: providerId,
        currency: acc.currency,
        accountName: acc.account_name || `${acc.currency} Wallet`,
        accountType: "wallet",
        availableBalance: acc.available_balance || 0,
        totalBalance: acc.total_balance || 0,
        pendingBalance: acc.pending_balance || 0,
        status: acc.status === "ACTIVE" ? "active" : "inactive",
      }))

      setAccounts(mappedAccounts)
      setBalances(data.data?.summary?.balancesByCurrency || [])

      // Set default view currency to highest balance
      if (data.data?.summary?.balancesByCurrency?.length > 0) {
        setViewCurrency(data.data.summary.balancesByCurrency[0].currency)
      }
    } catch (err) {
      console.error("Failed to fetch accounts:", err)
      throw err
    }
  }, [providerId])

  const fetchTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set("pageSize", "100")

      // Fetch both financial transactions and card transactions in parallel
      const [financialResponse, cardResponse] = await Promise.all([
        fetch(`/api/${providerId}/transactions?${params}`, { credentials: "include" }),
        fetch(`/api/${providerId}/card-transactions?${params}`, { credentials: "include" }).catch(() => null),
      ])

      const financialData = await financialResponse.json()
      const cardData = cardResponse ? await cardResponse.json() : null

      if (!financialData.success) {
        throw new Error(financialData.error || "Failed to fetch transactions")
      }

      // Build a map of card transactions by date+amount for matching
      const cardTxMap = new Map<string, any>()
      if (cardData?.success && cardData.data?.transactions) {
        for (const cardTx of cardData.data.transactions) {
          // Key by date (YYYY-MM-DD) + amount for matching
          const dateKey = cardTx.transaction_date?.split("T")[0] || ""
          const amountKey = Math.abs(cardTx.billing_amount || cardTx.transaction_amount).toFixed(2)
          const key = `${dateKey}_${amountKey}_${cardTx.billing_currency}`
          cardTxMap.set(key, cardTx)
        }
      }

      const mappedTxs: BankTransaction[] = (financialData.data?.transactions || []).map((tx: any) => {
        const meta = tx.metadata || {}
        const isCardTx = (meta.source_type || "").toLowerCase().includes("card") ||
                         (meta.transaction_type || "").toLowerCase().includes("issuing")

        // Try to match with card transaction for enriched data
        let cardTx: any = null
        if (isCardTx) {
          const dateKey = tx.created_at?.split("T")[0] || ""
          const amountKey = Math.abs(tx.amount).toFixed(2)
          const key = `${dateKey}_${amountKey}_${tx.currency}`
          cardTx = cardTxMap.get(key)
        }

        // Build description - prefer card transaction data if available
        let description = tx.description
        if (cardTx?.readable_description) {
          description = cardTx.readable_description
        } else if (!description || description === "Transaction" || description.includes("ISSUING_")) {
          const parts: string[] = []
          if (meta.transaction_type) parts.push(meta.transaction_type)
          if (meta.source_type && meta.source_type !== meta.transaction_type) {
            parts.push(`(${meta.source_type})`)
          }
          description = parts.length > 0 ? parts.join(" ") : `${tx.currency} Transaction`
        }

        // Merge merchant data from card transaction
        const merchant = cardTx?.merchant
        const enhancedMetadata = {
          ...meta,
          ...(cardTx ? {
            card_last_four: cardTx.masked_card_number?.slice(-4),
            card_nickname: cardTx.card_nickname,
            merchant_name: merchant?.name,
            merchant_city: merchant?.city,
            merchant_country: merchant?.country,
            merchant_category: cardTx.merchant_category_name,
            merchant_category_code: merchant?.category_code,
            location: merchant ? [merchant.city, merchant.country].filter(Boolean).join(", ") : undefined,
            decline_reason: cardTx.decline_reason,
          } : {}),
        }

        return {
          id: tx.id,
          provider: providerId,
          accountId: tx.account_id,
          date: tx.created_at,
          postedDate: tx.posted_at,
          description,
          amount: tx.amount,
          currency: tx.currency,
          type: tx.type === "credit" ? "credit" : "debit",
          status: cardTx?.status === "DECLINED" ? "failed" :
                  tx.status === "SUCCEEDED" ? "completed" :
                  tx.status?.toLowerCase() || "pending",
          counterparty: merchant ? {
            name: merchant.name,
            bankName: undefined,
            accountNumber: undefined,
            bankCountryCode: merchant.country,
          } : tx.counterparty,
          reference: tx.reference,
          runningBalance: tx.running_balance,
          metadata: enhancedMetadata,
        }
      })

      setTransactions(mappedTxs)
    } catch (err) {
      console.error("Failed to fetch transactions:", err)
    }
  }, [providerId])

  const fetchBeneficiaries = useCallback(async () => {
    try {
      const response = await fetch(`/api/${providerId}/beneficiaries`, {
        credentials: "include",
      })
      const data = await response.json()

      if (data.success && data.data?.beneficiaries) {
        const mappedBens: Beneficiary[] = data.data.beneficiaries.map((ben: any) => ({
          id: ben.id,
          provider: providerId,
          name: ben.name,
          nickname: ben.nick_name,
          type: ben.entity_type === "PERSONAL" ? "personal" : "company",
          accountNumber: ben.account_number,
          bankName: ben.bank_name,
          status: "active",
        }))
        setBeneficiaries(mappedBens)
      }
    } catch (err) {
      console.error("Failed to fetch beneficiaries:", err)
    }
  }, [providerId])

  const fetchGlobalAccounts = useCallback(async () => {
    try {
      const response = await fetch(`/api/${providerId}/global-accounts`, {
        credentials: "include",
      })
      const data = await response.json()

      if (data.success && data.data?.globalAccounts) {
        setGlobalAccounts(data.data.globalAccounts)
      }
    } catch (err) {
      console.error("Failed to fetch global accounts:", err)
    }
  }, [providerId])

  // Fetch a single FX rate and return it
  // Returns: how much buyCurrency you get per 1 sellCurrency
  const fetchSingleFxRate = useCallback(async (
    sellCurrency: string,
    buyCurrency: string
  ): Promise<number> => {
    // Skip if same currency
    if (sellCurrency === buyCurrency) {
      return 1
    }

    try {
      const params = new URLSearchParams({
        sell_currency: sellCurrency,
        buy_currency: buyCurrency,
        sell_amount: "1", // Just get the rate for 1 unit
      })

      const response = await fetch(`/api/${providerId}/fx-rates?${params}`, {
        credentials: "include",
      })
      const data = await response.json()

      if (data.success && data.data?.rates?.length > 0) {
        const rateData = data.data.rates[0]
        // Use buy_amount which tells us how much buyCurrency we get for 1 sellCurrency
        // This is more reliable than the rate field which can be inverted
        if (rateData.buy_amount && rateData.sell_amount) {
          return rateData.buy_amount / rateData.sell_amount
        }
        // Fallback to rate, but it might be inverted - check if rate > 1 for typical pairs
        const rate = rateData.rate || 0
        // For HKD->USD, rate should be ~0.13, not ~7.8
        // If rate > 1 and we're converting from a weaker currency, it's likely inverted
        return rate
      }
      console.warn("No FX rate available for", sellCurrency, "->", buyCurrency)
      return 0
    } catch (err) {
      console.error("Failed to fetch FX rate:", err)
      return 0
    }
  }, [providerId])

  // Fetch FX rates for all display currencies to the target currency
  const fetchAllFxRates = useCallback(async (targetCurrency: string) => {
    setFxLoading(true)
    try {
      const rates: Record<string, number> = {}

      // Fetch rates for all display currencies in parallel
      const promises = DISPLAY_CURRENCIES.map(async (currency) => {
        const rate = await fetchSingleFxRate(currency, targetCurrency)
        return { currency, rate }
      })

      const results = await Promise.all(promises)
      results.forEach(({ currency, rate }) => {
        rates[currency] = rate
      })

      setFxRates(rates)
    } catch (err) {
      console.error("Failed to fetch FX rates:", err)
    } finally {
      setFxLoading(false)
    }
  }, [fetchSingleFxRate])

  const loadAllData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        fetchAccounts(),
        fetchTransactions(),
        fetchBeneficiaries(),
        fetchGlobalAccounts(),
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [fetchAccounts, fetchTransactions, fetchBeneficiaries, fetchGlobalAccounts])

  // Initial load
  useEffect(() => {
    const init = async () => {
      const isConnected = await checkConnection()
      if (isConnected) {
        await loadAllData()
      } else {
        setLoading(false)
      }
    }
    init()
  }, [checkConnection, loadAllData])

  // Fetch FX rates for all currencies when conversion currency changes
  useEffect(() => {
    if (!connected || balances.length === 0) return
    fetchAllFxRates(convertToCurrency)
  }, [connected, convertToCurrency, balances, fetchAllFxRates])

  // ============================================================================
  // Actions
  // ============================================================================

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const response = await fetch(`/api/${providerId}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      })
      const data = await response.json()

      if (data.success) {
        setConnected(true)
        message.success(`Connected to ${provider?.name || providerId}!`)
        await loadAllData()
      } else {
        message.error(data.error || "Failed to connect")
      }
    } catch (err) {
      message.error("Failed to connect")
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await fetch(`/api/${providerId}/auth`, {
        method: "DELETE",
        credentials: "include",
      })
      setConnected(false)
      setAccounts([])
      setBalances([])
      setTransactions([])
      setBeneficiaries([])
      setGlobalAccounts([])
      message.success(`Disconnected from ${provider?.name || providerId}`)
    } catch {
      message.error("Failed to disconnect")
    }
  }

  const handleRefresh = async () => {
    message.info("Refreshing...")
    await loadAllData()
    message.success("Data refreshed")
  }

  const handleTransactionClick = (transaction: BankTransaction) => {
    setSelectedTransaction(transaction)
    setDrawerOpen(true)
  }

  // ============================================================================
  // Render: Not Connected State
  // ============================================================================

  if (!connected && !loading) {
    return (
      <div style={{ padding: screens.md ? "32px 24px" : "16px" }}>
        <Card>
          <Empty
            image={
              providerId === "airwallex" ? (
                <div style={{ marginBottom: 16 }}>
                  <AirwallexIcon size={64} />
                </div>
              ) : providerId === "fubon" ? (
                <div style={{ marginBottom: 16 }}>
                  <FubonIcon size={64} />
                </div>
              ) : providerId === "ocbc" ? (
                <div style={{ marginBottom: 16 }}>
                  <OCBCIcon size={64} />
                </div>
              ) : (
                <BankOutlined style={{ fontSize: 64, color: provider?.color || "#722ed1" }} />
              )
            }
            description={
              <Space direction="vertical" align="center">
                {providerId === "airwallex" ? (
                  <AirwallexLogo width={140} height={24} />
                ) : providerId === "fubon" ? (
                  <FubonLogo width={140} height={36} />
                ) : providerId === "ocbc" ? (
                  <OCBCLogo width={140} height={36} />
                ) : (
                  <Title level={4}>{provider?.name || "Bank Provider"}</Title>
                )}
                <Text type="secondary">
                  Connect to view balances and transactions.
                </Text>
              </Space>
            }
          >
            <Button
              type="primary"
              size="large"
              icon={<LinkOutlined />}
              onClick={handleConnect}
              loading={connecting}
              style={{
                backgroundColor: providerId === "airwallex" ? "#FF4244" : providerId === "fubon" ? "#0066b3" : providerId === "ocbc" ? "#E60012" : provider?.color,
                borderColor: providerId === "airwallex" ? "#FF4244" : providerId === "fubon" ? "#0066b3" : providerId === "ocbc" ? "#E60012" : provider?.color,
              }}
            >
              Connect {provider?.name || "Account"}
            </Button>
          </Empty>
        </Card>
      </div>
    )
  }

  // ============================================================================
  // Render: Loading State
  // ============================================================================

  if (loading) {
    return (
      <div style={{ padding: "48px", textAlign: "center" }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">Loading {provider?.name || "bank"} data...</Text>
        </div>
      </div>
    )
  }

  // ============================================================================
  // Render: Error State
  // ============================================================================

  if (error) {
    return (
      <div style={{ padding: screens.md ? "32px 24px" : "16px" }}>
        <Alert
          type="error"
          message="Failed to load data"
          description={error}
          showIcon
          action={<Button onClick={handleRefresh}>Retry</Button>}
        />
      </div>
    )
  }

  // ============================================================================
  // Render: Main Dashboard
  // ============================================================================

  return (
    <div style={{ padding: screens.md ? "24px" : "16px", background: "#f5f5f5", minHeight: "100%" }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center">
            {providerId === "airwallex" ? (
              <>
                <AirwallexLogo width={120} height={20} />
                <Tag color="success">Connected</Tag>
              </>
            ) : providerId === "fubon" ? (
              <>
                <FubonLogo width={120} height={24} />
                <Tag color="success">Connected</Tag>
              </>
            ) : providerId === "ocbc" ? (
              <>
                <OCBCLogo width={100} height={26} />
                <Tag color="success">Connected</Tag>
              </>
            ) : (
              <>
                <Badge dot color={provider?.color || "#722ed1"}>
                  <BankOutlined style={{ fontSize: 24, color: provider?.color }} />
                </Badge>
                <Title level={4} style={{ margin: 0 }}>
                  {provider?.name || "Bank Dashboard"}
                </Title>
                <Tag color="success">Connected</Tag>
              </>
            )}
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} size="small">
              Refresh
            </Button>
            <Tooltip title={`Disconnect ${provider?.name}`}>
              <Button icon={<DisconnectOutlined />} danger size="small" onClick={handleDisconnect} />
            </Tooltip>
          </Space>
        </Col>
      </Row>

      {/* Main Content: Balance (left) + Transactions (right) */}
      <Row gutter={[16, 16]}>
        {/* Left Column: Balance + Global Accounts */}
        <Col xs={24} lg={10} xl={8}>
          <Space direction="vertical" style={{ width: "100%" }} size={16}>
            <BalanceCard
              balances={balances}
              viewCurrency={viewCurrency}
              onCurrencyChange={setViewCurrency}
              convertToCurrency={convertToCurrency}
              onConvertCurrencyChange={setConvertToCurrency}
              fxRates={fxRates}
              fxLoading={fxLoading}
              loading={loading}
            />
            <GlobalAccountsCard globalAccounts={globalAccounts} />
          </Space>
        </Col>

        {/* Right Column: Transactions */}
        <Col xs={24} lg={14} xl={16}>
          <TransactionsTable
            transactions={transactions}
            loading={loading}
            onRowClick={handleTransactionClick}
          />
        </Col>
      </Row>

      {/* Transaction Detail Drawer */}
      <TransactionDetailDrawer
        transaction={selectedTransaction}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}

export default BankDashboard
