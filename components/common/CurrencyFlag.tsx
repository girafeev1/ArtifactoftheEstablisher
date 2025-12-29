/**
 * CurrencyFlag Component
 * Displays circular flag icons for currencies using circle-flags library
 */

import React from 'react'
import Image from 'next/image'

// Map currency codes to country codes
const currencyToCountry: Record<string, string> = {
  // Major currencies
  USD: 'us',
  EUR: 'eu', // European Union flag
  GBP: 'gb',
  JPY: 'jp',
  CNY: 'cn',
  CNH: 'cn', // Offshore CNY
  HKD: 'hk',
  AUD: 'au',
  CAD: 'ca',
  CHF: 'ch',
  SGD: 'sg',
  NZD: 'nz',
  KRW: 'kr',
  INR: 'in',
  MXN: 'mx',
  BRL: 'br',
  ZAR: 'za',
  RUB: 'ru',
  SEK: 'se',
  NOK: 'no',
  DKK: 'dk',
  PLN: 'pl',
  THB: 'th',
  IDR: 'id',
  MYR: 'my',
  PHP: 'ph',
  VND: 'vn',
  TWD: 'tw',
  AED: 'ae',
  SAR: 'sa',
  TRY: 'tr',
  ILS: 'il',
  CZK: 'cz',
  HUF: 'hu',
  RON: 'ro',
  BGN: 'bg',
  HRK: 'hr',
  ISK: 'is',
  CLP: 'cl',
  COP: 'co',
  PEN: 'pe',
  ARS: 'ar',
  EGP: 'eg',
  PKR: 'pk',
  BDT: 'bd',
  LKR: 'lk',
  KES: 'ke',
  NGN: 'ng',
  GHS: 'gh',
  MAD: 'ma',
  QAR: 'qa',
  KWD: 'kw',
  BHD: 'bh',
  OMR: 'om',
  JOD: 'jo',
}

interface CurrencyFlagProps {
  currency: string
  size?: number
  className?: string
}

export const CurrencyFlag: React.FC<CurrencyFlagProps> = ({
  currency,
  size = 20,
  className = '',
}) => {
  const countryCode = currencyToCountry[currency.toUpperCase()] || 'xx' // xx for unknown

  // Use circle-flags from node_modules via public path
  // We'll copy the required flags to public folder or use a CDN
  const flagUrl = `https://hatscripts.github.io/circle-flags/flags/${countryCode}.svg`

  return (
    <Image
      src={flagUrl}
      alt={`${currency} flag`}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      style={{ objectFit: 'cover' }}
      unoptimized // SVG doesn't need optimization
    />
  )
}

// Alternative: inline component that doesn't require external loading
export const CurrencyFlagInline: React.FC<CurrencyFlagProps> = ({
  currency,
  size = 20,
  className = '',
}) => {
  const countryCode = currencyToCountry[currency.toUpperCase()] || 'xx'

  return (
    <img
      src={`https://hatscripts.github.io/circle-flags/flags/${countryCode}.svg`}
      alt={`${currency} flag`}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      style={{ objectFit: 'cover' }}
    />
  )
}

// Get country code for a currency
export const getCountryCodeForCurrency = (currency: string): string => {
  return currencyToCountry[currency.toUpperCase()] || 'xx'
}

export default CurrencyFlag
