/**
 * TermsAndConditions Component
 *
 * Full terms and conditions for Payment Details page.
 * Contains 8 English clauses + Chinese translation as per scheme.
 * Layout matches payment-details-terms.json exactly:
 * - Row heights: [21, 161, 21, 115, 21] = 339px total
 */

import React from 'react';
import { FlexCell, Row, Cell } from '../../grid';

export interface TermsAndConditionsProps {
  /** Show debug borders */
  debug?: boolean;
}

/**
 * Full English T&C text (8 clauses) - exact text from scheme
 */
const TERMS_ENGLISH = `1.  Acceptance. By continuing to use our services, instructing us to proceed, requesting release of deliverables, failing to object in writing within the dispute period, or paying in whole or in part, the Client is deemed to have agreed to and be bound by these Terms & Conditions.
2.  Payment Due. Payment is due within seven (7) days after the earlier of (i) the Invoice date; or (ii) the Client's written request to release final deliverables. Final deliverables will be released only after cleared funds (credited to our designated account) are received.
3.  Disputes. Any billing disputes must be submitted in writing within three (3) days of receipt of this Invoice; otherwise, the Invoice is deemed accepted.
4.  Late Charges. If payment is not received when due, a late fee of the greater of HK$150 or 1.5% of the outstanding balance for each 14-day period (or any part thereof) will accrue from the due date until paid in full, unless otherwise agreed in writing.
5.  Carry-Forward. Accrued late charges (and reasonable collection costs) may be carried forward and added to the Client's next invoice or project, to the extent permitted by law, without prejudice to any other rights or remedies.
6.  Suspension / Withholding. We may suspend services and/or withhold deliverables (including current or future projects) while any amount remains unpaid.
7.  Currency & Fees. Unless stated otherwise, all amounts are in HKD. Bank/remittance charges are for the payer's account; the net amount received must equal the Invoice total.
8.  Application of Payments. Unless otherwise agreed in writing, we may apply payments to the oldest outstanding amounts first.`;

/**
 * Full Chinese T&C text - exact text from scheme
 */
const TERMS_CHINESE = `1.  同意與約束力。 客戶如繼續使用本公司服務、指示本公司開展／續行工作、要求發放交付品、於爭議期限內未以書面提出異議，或已全部或部分付款，即視為已同意並受本條款及細則約束。
2.  到期付款。 付款須於以下二者中之較早者起計七（7）日內繳清：（i）發票日期；或（ii）客戶以書面要求發放最終交付品之日期。最終交付品將於款項已入賬（存入本公司指定賬戶）後方予發放。
3.  爭議。 任何賬單爭議須於收妥本發票後三（3）日內以書面提出；逾期視為已接納本發票。
4.  逾期費用。 如未如期付款，將就每一個十四（14）日期（不足十四日亦作一個期計）按較高者收取：港幣一百五十元（HK$150）或欠款金額之1.5%，由到期日起累計至全數清償為止；除非另有書面協議。
5.  結轉。 在法律許可範圍內，累積之逾期費用（及合理之追收成本）可結轉並列入同一客戶之下一張發票或下一個項目，並不影響本公司之其他權利或補救。
6.  暫停／扣留。 於任何金額未清償期間，本公司可暫停提供服務及／或扣留交付品（包括現行或未來項目）。
7.  貨幣及手續費。 除另有說明，所有金額以港幣（HKD）計算；銀行╱匯款手續費由付款人承擔，並須確保本公司實收淨額等同發票金額。
8.  付款抵銷次序。 除另有書面約定，本公司可將所收款項優先抵銷最早到期之未清款項。`;

/**
 * TermsAndConditions - Full T&C section for Payment Details page
 * Layout matches payment-details-terms.json exactly:
 * - Row 1 (21px): "Terms & Conditions" header - Cormorant Infant 9px, bold, vAlign BOTTOM
 * - Row 2 (161px): English T&C - Cormorant Infant 8px, vAlign MIDDLE, color 0.4
 * - Row 3 (21px): "條款及細則" - Yuji Mai 8px, vAlign BOTTOM, color #434343
 * - Row 4 (115px): Chinese T&C - Iansui 7px, vAlign MIDDLE, color 0.4
 * - Row 5 (21px): Empty spacer
 */
export const TermsAndConditions: React.FC<TermsAndConditionsProps> = ({ debug }) => {
  // Color from scheme: rgb(0.4, 0.4, 0.4) = rgb(102, 102, 102)
  const textColor = 'rgb(102, 102, 102)';
  // Color from scheme: rgb(0.2627451, 0.2627451, 0.2627451) = #434343
  const headerColor = '#434343';

  return (
    <>
      {/* Row 1 (21px): English Header */}
      <Row height={21}>
        <FlexCell columns="A-N" vAlign="bottom" debug={debug}>
          <span
            style={{
              fontFamily: '"Cormorant Infant", serif',
              fontSize: '9px',
              fontWeight: 700,
            }}
          >
            Terms & Conditions
          </span>
        </FlexCell>
      </Row>

      {/* Row 2 (161px): English T&C */}
      <Row height={161}>
        <FlexCell columns="A-N" vAlign="middle" debug={debug}>
          <div
            style={{
              fontFamily: '"Cormorant Infant", serif',
              fontSize: '8px',
              color: textColor,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
            }}
          >
            {TERMS_ENGLISH}
          </div>
        </FlexCell>
      </Row>

      {/* Row 3 (21px): Chinese Header */}
      <Row height={21}>
        <FlexCell columns="A-N" vAlign="bottom" debug={debug}>
          <span
            style={{
              fontFamily: '"Yuji Mai", serif',
              fontSize: '8px',
              color: headerColor,
            }}
          >
            條款及細則
          </span>
        </FlexCell>
      </Row>

      {/* Row 4 (115px): Chinese T&C */}
      <Row height={115}>
        <FlexCell columns="A-N" vAlign="middle" debug={debug}>
          <div
            style={{
              fontFamily: '"Iansui", sans-serif',
              fontSize: '7px',
              color: textColor,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
            }}
          >
            {TERMS_CHINESE}
          </div>
        </FlexCell>
      </Row>

      {/* Row 5 (21px): Empty spacer */}
      <Row height={21}>
        <Cell columns="A-N" debug={debug} />
      </Row>
    </>
  );
};

export default TermsAndConditions;
