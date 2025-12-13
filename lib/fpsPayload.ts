// Utilities for building Hong Kong FPS EMV payloads and simple QR URLs.
// This is a browser-safe copy of the logic used by the PDFKit renderer so
// that the HTML/Chromium pipeline can reuse the same encoding without
// pulling in Node-only dependencies.

export const buildHKFPSPayload = (
  fpsProxyValue: string | null,
  includeAmount: boolean,
  amountNumber: number | null,
  billRef?: string | null,
): string | null => {
  const inputStr =
    typeof fpsProxyValue === 'string'
      ? fpsProxyValue
      : fpsProxyValue != null
      ? String(fpsProxyValue)
      : '';
  const raw = inputStr.trim();
  if (!raw) return null;

  const TLV = (id: string, val: string | null | undefined) => {
    if (!val) return '';
    const str = String(val);
    return id + (`0${str.length}`).slice(-2) + str;
  };

  const CRC16 = (input: string) => {
    let crc = 0xffff;
    for (let i = 0; i < input.length; i++) {
      crc ^= (input.charCodeAt(i) & 0xff) << 8;
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
        else crc <<= 1;
        crc &= 0xffff;
      }
    }
    return (`000${crc.toString(16).toUpperCase()}`).slice(-4);
  };

  const payloadFormat = TLV('00', '01');
  const pointOfInit = TLV('01', includeAmount ? '12' : '11');

  let proxyType: 'id' | 'phone' | 'email';
  if (/@/.test(raw)) proxyType = 'email';
  else if (/^\+/.test(raw)) proxyType = 'phone';
  else proxyType = 'id';

  const GUID = 'hk.com.hkicl';
  let mai = TLV('00', GUID);
  if (proxyType === 'email') mai += TLV('04', raw);
  else if (proxyType === 'phone') mai += TLV('03', raw);
  else mai += TLV('02', raw);

  const merchantAccountInfo = TLV('26', mai);
  const mcc = TLV('52', '0000');
  const currency = TLV('53', '344');

  let amountTLV = '';
  if (includeAmount && typeof amountNumber === 'number' && Number.isFinite(amountNumber)) {
    let amt = amountNumber.toFixed(2).replace(/\.00$/, '');
    amountTLV = TLV('54', amt);
  }

  const country = TLV('58', 'HK');
  const name = TLV('59', 'NA');
  const city = TLV('60', 'HK');

  let additionalData = '';
  if (billRef && billRef.trim()) {
    additionalData = TLV('62', TLV('01', billRef.trim()));
  }

  const withoutCRC =
    payloadFormat +
    pointOfInit +
    merchantAccountInfo +
    mcc +
    currency +
    amountTLV +
    country +
    name +
    city +
    additionalData;

  const crc = CRC16(withoutCRC + '63' + '04');
  return withoutCRC + '63' + '04' + crc;
};

export const buildHKFPSQrUrl = (payload: string | null, size = 220): string | null =>
  payload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
        payload,
      )}`
    : null;

