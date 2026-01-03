/**
 * PageBranding Component
 *
 * Shared branding elements used across supplementary invoice pages:
 * - E Logo (Rampart One 60px)
 * - Subsidiary names (English + Chinese spacified)
 * - Page title with consistent styling
 *
 * Used by: PaymentDetailsPage, PaymentInstructionsPage
 *
 * Layout based on scheme JSON files with exact row heights and column spans.
 */

import React from 'react';
import { Cell, FlexCell, Row, Spacer } from '../../grid';
import type { SubsidiaryDoc } from '../../types';

/**
 * Spacify text - add a space between each character
 */
export function spacify(text: string | undefined | null): string {
  if (!text) return '';
  return String(text)
    .split('\n')
    .map((line) => line.split('').join(' '))
    .join('\n');
}

export interface ELogoProps {
  /** Size in pixels (default 60) */
  size?: number;
  /** Show debug border */
  debug?: boolean;
}

/**
 * ELogo - The "E." logo in Rampart One font
 * Used in top-right corner of supplementary pages
 */
export const ELogo: React.FC<ELogoProps> = ({ size = 60, debug }) => {
  return (
    <span
      style={{
        fontFamily: '"Rampart One", cursive',
        fontSize: `${size}px`,
        lineHeight: 1,
        color: '#434343',
      }}
    >
      E.
    </span>
  );
};

export interface SubsidiaryBrandingProps {
  /** Subsidiary document */
  subsidiary: SubsidiaryDoc;
  /** Show debug border */
  debug?: boolean;
}

/**
 * SubsidiaryBranding - Subsidiary name block with English + Chinese
 * Positioned right-aligned, spacified text
 */
export const SubsidiaryBranding: React.FC<SubsidiaryBrandingProps> = ({
  subsidiary,
  debug,
}) => {
  return (
    <div style={{ textAlign: 'right' }}>
      <div
        style={{
          fontFamily: '"Cormorant Infant", serif',
          fontSize: '10px',
          fontWeight: 700,
          lineHeight: 1.2,
          whiteSpace: 'pre',
        }}
      >
        {spacify(subsidiary.englishName)}
      </div>
      <div
        style={{
          fontFamily: '"Iansui", sans-serif',
          fontSize: '8px',
          fontWeight: 700,
          letterSpacing: '0.25em',
          lineHeight: 1.2,
        }}
      >
        {spacify(subsidiary.chineseName)}
      </div>
    </div>
  );
};

export interface PageTitleProps {
  /** Title text (will be spacified) */
  title: string;
  /** Font size in pixels (default 30) */
  fontSize?: number;
}

/**
 * PageTitle - Spacified page title in Cormorant Infant
 */
export const PageTitle: React.FC<PageTitleProps> = ({ title, fontSize = 30 }) => {
  return (
    <span
      style={{
        fontFamily: '"Cormorant Infant", serif',
        fontSize: `${fontSize}px`,
        fontWeight: 700,
        color: '#434343',
      }}
    >
      {spacify(title)}
    </span>
  );
};

export interface PaymentDetailsHeaderProps {
  /** Subsidiary document */
  subsidiary: SubsidiaryDoc;
  /** Show debug borders */
  debug?: boolean;
}

/**
 * PaymentDetailsHeader - Header for Payment Details page
 * Matches payment-details-header.json exactly:
 * - 12 rows x 21px = 252px total
 * - Title (A-I) rows 1-4, E. logo (L-N) rows 1-4
 * - Row 5: Dotted border (A-I), Subsidiary (J-N) start
 * - Row 6: Empty (A-I), Subsidiary (J-N) end
 * - Rows 7-8: Empty
 * - Rows 9-10: Payment terms text
 * - Rows 11-12: Empty
 */
export const PaymentDetailsHeader: React.FC<PaymentDetailsHeaderProps> = ({
  subsidiary,
  debug,
}) => {
  const ROW_HEIGHT = 21;
  // Border color from scheme: rgb(0.8, 0.8, 0.8) = #CCCCCC
  const dottedBorderColor = '#CCCCCC';

  return (
    <>
      {/* Rows 1-4: Title + E. Logo (84px total) */}
      <FlexCell
        columns="A-I"
        height={ROW_HEIGHT * 4}
        rowSpan={4}
        vAlign="bottom"
        debug={debug}
      >
        <PageTitle title="Payment Details" />
      </FlexCell>
      <Cell columns="J-K" height={ROW_HEIGHT * 4} debug={debug} />
      <FlexCell
        columns="L-N"
        height={ROW_HEIGHT * 4}
        rowSpan={4}
        vAlign="middle"
        hAlign="right"
        debug={debug}
      >
        <ELogo size={60} />
      </FlexCell>

      {/* Row 5: Dotted border (A-I) + Subsidiary start (J-N) */}
      <FlexCell
        columns="A-I"
        height={ROW_HEIGHT}
        vAlign="top"
        style={{
          borderBottom: `1px dotted ${dottedBorderColor}`,
        }}
        debug={debug}
      />
      <FlexCell
        columns="J-N"
        height={ROW_HEIGHT * 2}
        rowSpan={2}
        vAlign="top"
        hAlign="right"
        debug={debug}
      >
        <SubsidiaryBranding subsidiary={subsidiary} />
      </FlexCell>

      {/* Row 6: Empty (A-I) - subsidiary continues in J-N from row 5 */}
      <Cell columns="A-I" height={ROW_HEIGHT} debug={debug} />

      {/* Rows 7-8: Empty (42px) */}
      <Cell columns="A-N" height={ROW_HEIGHT * 2} debug={debug} />

      {/* Rows 9-10: Payment terms text (42px) */}
      <FlexCell
        columns="A-N"
        height={ROW_HEIGHT * 2}
        rowSpan={2}
        vAlign="top"
        debug={debug}
      >
        <span
          style={{
            fontFamily: '"Cormorant Infant", serif',
            fontSize: '11px',
            fontWeight: 700,
            lineHeight: 1.4,
          }}
        >
          Payment is due within seven (7) calendar days after the earlier of (i) the invoice date; or (ii) the client's written request to release final deliverables. Final deliverables are released only after receipt of cleared funds.
        </span>
      </FlexCell>

      {/* Rows 11-12: Empty (42px) */}
      <Cell columns="A-N" height={ROW_HEIGHT * 2} debug={debug} />
    </>
  );
};

export interface PaymentInstructionsHeaderProps {
  /** Subsidiary document */
  subsidiary: SubsidiaryDoc;
  /** Show debug borders */
  debug?: boolean;
}

/**
 * PaymentInstructionsHeader - Header for Payment Instructions page
 * Matches payment-instructions-header.json exactly:
 * - 9 rows with heights [21,21,21,21,21,21,26,21,21] = 194px total
 * - Title (A-K) rows 1-4, E. logo (L-N) rows 1-4
 * - Row 5: Dotted border (B-I), Subsidiary start (J-N)
 * - Row 6: Empty (A-I), Subsidiary end (J-N)
 * - Row 7 (26px): Payment deadline text
 * - Rows 8-9: Empty
 */
export const PaymentInstructionsHeader: React.FC<PaymentInstructionsHeaderProps> = ({
  subsidiary,
  debug,
}) => {
  const ROW_HEIGHT = 21;
  const dottedBorderColor = '#CCCCCC';

  return (
    <>
      {/* Rows 1-4: Title + E. Logo (84px total) */}
      <FlexCell
        columns="A-K"
        height={ROW_HEIGHT * 4}
        rowSpan={4}
        vAlign="bottom"
        debug={debug}
      >
        <PageTitle title="Payment Instructions" />
      </FlexCell>
      <FlexCell
        columns="L-N"
        height={ROW_HEIGHT * 4}
        rowSpan={4}
        vAlign="middle"
        hAlign="right"
        debug={debug}
      >
        <ELogo size={60} />
      </FlexCell>

      {/* Row 5: Dotted border (A-I) + Subsidiary start (J-N) */}
      <Cell columns="A" height={ROW_HEIGHT} debug={debug} />
      <FlexCell
        columns="B-I"
        height={ROW_HEIGHT}
        vAlign="top"
        style={{
          borderBottom: `1px dotted ${dottedBorderColor}`,
        }}
        debug={debug}
      />
      <FlexCell
        columns="J-N"
        height={ROW_HEIGHT * 2}
        rowSpan={2}
        vAlign="top"
        hAlign="right"
        debug={debug}
      >
        <SubsidiaryBranding subsidiary={subsidiary} />
      </FlexCell>

      {/* Row 6: Empty (A-I) - subsidiary continues in J-N from row 5 */}
      <Cell columns="A-I" height={ROW_HEIGHT} debug={debug} />

      {/* Row 7: Payment deadline text (26px) */}
      <FlexCell
        columns="A-N"
        height={26}
        vAlign="middle"
        debug={debug}
      >
        <span
          style={{
            fontFamily: '"Cormorant Infant", serif',
            fontSize: '13px',
            lineHeight: 1.2,
          }}
        >
          Payment for this invoice is required within 7 DAYS of its issuance. Please choose from the payment methods listed below.
        </span>
      </FlexCell>

      {/* Rows 8-9: Empty (42px) */}
      <Cell columns="A-N" height={ROW_HEIGHT * 2} debug={debug} />
    </>
  );
};

// Legacy components for backwards compatibility
export interface PageHeaderWithBrandingProps {
  /** Page title (e.g., "Payment Details") */
  title: string;
  /** Subsidiary document */
  subsidiary: SubsidiaryDoc;
  /** Optional subtitle text */
  subtitle?: string;
  /** Show debug borders */
  debug?: boolean;
}

/**
 * PageHeaderWithBranding - Generic header (deprecated, use specific headers)
 * @deprecated Use PaymentDetailsHeader or PaymentInstructionsHeader instead
 */
export const PageHeaderWithBranding: React.FC<PageHeaderWithBrandingProps> = ({
  title,
  subsidiary,
  subtitle,
  debug,
}) => {
  // Route to specific headers based on title
  if (title === 'Payment Details') {
    return <PaymentDetailsHeader subsidiary={subsidiary} debug={debug} />;
  }
  if (title === 'Payment Instructions') {
    return <PaymentInstructionsHeader subsidiary={subsidiary} debug={debug} />;
  }

  // Fallback for other titles
  return (
    <>
      <FlexCell columns="A-K" height={84} rowSpan={4} vAlign="bottom" debug={debug}>
        <PageTitle title={title} />
      </FlexCell>
      <FlexCell columns="L-N" height={84} rowSpan={4} vAlign="middle" hAlign="right" debug={debug}>
        <ELogo size={60} />
      </FlexCell>
      <FlexCell columns="A-I" height={42} rowSpan={2} vAlign="top" debug={debug}>
        {subtitle && (
          <span style={{ fontFamily: '"Roboto Mono", monospace', fontSize: '9px', color: '#666' }}>
            {subtitle}
          </span>
        )}
      </FlexCell>
      <FlexCell columns="J-N" height={42} rowSpan={2} vAlign="top" hAlign="right" debug={debug}>
        <SubsidiaryBranding subsidiary={subsidiary} />
      </FlexCell>
    </>
  );
};

export interface PageFooterProps {
  /** Subsidiary document */
  subsidiary: SubsidiaryDoc;
  /** Show debug borders */
  debug?: boolean;
}

/**
 * PageFooter - Standard footer for supplementary pages
 * Matches payment-instructions-footer.json scheme:
 * - Row 1 (24px): Subsidiary name, Cormorant Infant 12px bold, left-aligned (A-D)
 * - Row 2 (57px): Address (A-D, Cormorant Infant 8px), Phone/Email (J-N, Cormorant Infant 10px spacified)
 */
export const PageFooter: React.FC<PageFooterProps> = ({ subsidiary, debug }) => {
  // Border color from scheme
  const borderColor = 'rgb(239, 239, 239)';
  // Text color from scheme
  const grayText = 'rgb(67, 67, 67)';

  return (
    <>
      {/* Row 1: Subsidiary Name - 24px */}
      <Row height={24}>
        <FlexCell
          columns="A-D"
          vAlign="bottom"
          style={{ borderTop: `1px solid ${borderColor}` }}
          debug={debug}
        >
          <span
            style={{
              fontFamily: '"Cormorant Infant", serif',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            {subsidiary.englishName}
          </span>
        </FlexCell>
        <FlexCell columns="E-N" style={{ borderTop: `1px solid ${borderColor}` }} debug={debug} />
      </Row>

      {/* Row 2: Address + Contact - 57px */}
      <Row height={57}>
        <FlexCell columns="A-D" vAlign="top" debug={debug}>
          <div
            style={{
              fontFamily: '"Cormorant Infant", serif',
              fontSize: '8px',
              color: grayText,
              lineHeight: 1.4,
            }}
          >
            {subsidiary.addressLine1}
            {subsidiary.addressLine2 && (
              <>
                <br />
                {subsidiary.addressLine2}
              </>
            )}
            {subsidiary.addressLine3 && (
              <>
                <br />
                {subsidiary.addressLine3}
              </>
            )}
            <br />
            {subsidiary.region}, Hong Kong
          </div>
        </FlexCell>
        <Cell columns="E-I" debug={debug} />
        <FlexCell columns="J-N" vAlign="top" hAlign="right" debug={debug}>
          <div
            style={{
              fontFamily: '"Cormorant Infant", serif',
              fontSize: '10px',
              color: grayText,
              textAlign: 'right',
              lineHeight: 1.4,
            }}
          >
            {subsidiary.phone && (
              <>
                {spacify(subsidiary.phone)}
                <br />
              </>
            )}
            {spacify(subsidiary.email)}
          </div>
        </FlexCell>
      </Row>
    </>
  );
};

export default {
  ELogo,
  SubsidiaryBranding,
  PageTitle,
  PaymentDetailsHeader,
  PaymentInstructionsHeader,
  PageHeaderWithBranding,
  PageFooter,
  spacify,
};
