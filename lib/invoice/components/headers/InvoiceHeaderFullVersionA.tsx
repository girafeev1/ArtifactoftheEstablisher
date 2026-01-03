/**
 * InvoiceHeaderFullVersionA Component
 *
 * Full header for the first page of an invoice - Version A layout.
 * Layout matches rows 55-77 from the spreadsheet (gid=731885123).
 *
 * Key differences from Version B:
 * - "I n v o i c e" title on LEFT (column A-F), Logo "E." in column L-N
 * - Subsidiary name in column J-N (right-aligned), NO address lines
 * - Different row arrangement for invoice details
 *
 * Row heights (55-77): [21,21,21,21,21,21,21,23,21,21,21,21,21,21,21,21,21,21,42,21,21,21,21]
 * Total: 506px
 * Grid has 14 columns (A-N).
 *
 * Merge data from spreadsheet (1-indexed columns):
 * - Row 55: A-F (4r x 6c) "Invoice", L-N (4r x 3c) "E."
 * - Row 59: B-D (1r x 3c), J-N (2r x 5c) Subsidiary
 * - Row 60: A-D (2r x 4c) "BILL TO:"
 * - Row 62: A-D (1r x 4c) Client company
 * - Row 63-66: A-G (1r x 7c) Address lines
 * - Row 64: M-N (1r x 2c) Invoice #
 * - Row 66: L-N (1r x 3c) Date
 * - Row 67-68: L-N (1r x 3c) empty
 * - Row 69: A-D (1r x 4c)
 * - Row 70: N (5r x 1c) QR code
 * - Row 72: A-K (1r x 11c) Presenter
 * - Row 73: A-K (1r x 11c) Project title
 * - Row 74: A-J (1r x 10c) Project nature
 * - Row 77: A-I (1r x 9c)
 */

import React from 'react';
import { Cell, FlexCell } from '../../grid';
import type { ProjectInvoiceRecord, ProjectRecord, SubsidiaryDoc, Representative } from '../../types';
import type { RepresentativeInfo } from '../../../representative';

export interface InvoiceHeaderFullVersionAProps {
  invoice: ProjectInvoiceRecord;
  project?: ProjectRecord | null;
  subsidiary?: SubsidiaryDoc | null;
  qrCodeUrl?: string | null;
  debug?: boolean;
}

/**
 * Spacify text - add a space between each character
 */
function spacify(text: string | undefined | null): string {
  if (!text) return '';
  return String(text)
    .split('\n')
    .map((line) => line.split('').join(' '))
    .join('\n');
}

/**
 * Format invoice date
 */
function formatInvoiceDate(project?: ProjectRecord | null): string {
  const raw = project?.projectDateIso || project?.projectDateDisplay;
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Get representative display name
 */
function getRepresentativeName(rep?: Representative | RepresentativeInfo | string | null): { title: string; name: string } {
  if (!rep) return { title: '', name: '' };
  if (typeof rep === 'string') return { title: '', name: rep };
  const title = rep.title || '';
  const name = [rep.firstName, rep.lastName].filter(Boolean).join(' ');
  return { title, name };
}

// Row heights from spreadsheet (rows 55-77)
// Row 62 (index 7): 23px, Row 73 (index 18): 42px
const ROW_HEIGHTS = [21, 21, 21, 21, 21, 21, 21, 23, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 42, 21, 21, 21, 21];

/**
 * InvoiceHeaderFullVersionA - Full header for page 1, Version A layout
 */
export const InvoiceHeaderFullVersionA: React.FC<InvoiceHeaderFullVersionAProps> = ({
  invoice,
  project,
  subsidiary,
  qrCodeUrl,
  debug,
}) => {
  const invoiceDate = formatInvoiceDate(project);
  const { title: repTitle, name: repName } = getRepresentativeName(invoice.representative);

  // Common font styles matching spreadsheet
  const googleSansStyle = { fontFamily: '"Google Sans Mono", "Roboto Mono", monospace' };
  const cormorantStyle = { fontFamily: '"Cormorant Infant", serif' };

  // Helper to sum row heights
  const sumHeights = (start: number, count: number) =>
    ROW_HEIGHTS.slice(start, start + count).reduce((a, b) => a + b, 0);

  return (
    <>
      {/* === ROWS 55-58 (indices 0-3): Title A-F (4r), G empty, H-K empty, L-N logo (4r) === */}
      {/* Row 55: Merge A-F (4r x 6c) for "Invoice" */}
      <FlexCell
        columns="A-F"
        height={sumHeights(0, 4)}
        rowSpan={4}
        vAlign="bottom"
        hAlign="left"
        debug={debug}
      >
        <span style={{
          ...cormorantStyle,
          fontSize: '47px', // 35pt converted to px
          fontWeight: 700,
        }}>
          I n v o i c e
        </span>
      </FlexCell>
      {/* G-K for rows 55-58 (no merge, individual cells or combined) */}
      <Cell columns="G-K" height={sumHeights(0, 4)} rowSpan={4} debug={debug} />
      {/* Row 55: Merge L-N (4r x 3c) for "E." logo */}
      <FlexCell
        columns="L-N"
        height={sumHeights(0, 4)}
        rowSpan={4}
        vAlign="middle"
        hAlign="right"
        debug={debug}
      >
        <span style={{
          fontFamily: '"Rampart One", cursive',
          fontSize: '80px', // 60pt converted to px
          lineHeight: 1,
        }}>
          E.
        </span>
      </FlexCell>

      {/* === ROW 59 (index 4): B-D merged empty, J-N subsidiary (2r x 5c) === */}
      <Cell columns="A" height={ROW_HEIGHTS[4]} debug={debug} />
      <Cell columns="B-D" height={ROW_HEIGHTS[4]} debug={debug} />
      <Cell columns="E-I" height={ROW_HEIGHTS[4]} debug={debug} />
      {/* Row 59: Merge J-N (2r x 5c) for subsidiary */}
      <FlexCell
        columns="J-N"
        height={sumHeights(4, 2)}
        rowSpan={2}
        vAlign="top"
        hAlign="right"
        debug={debug}
      >
        <div style={{ textAlign: 'right' }}>
          <div style={{
            ...cormorantStyle,
            fontSize: '13px', // 10pt converted to px
            fontWeight: 700,
            lineHeight: 1.2,
            whiteSpace: 'pre',
          }}>
            {spacify(subsidiary?.englishName)}
          </div>
          <div style={{
            fontFamily: '"Iansui", sans-serif',
            fontSize: '11px', // 8pt converted to px
            fontWeight: 700,
            letterSpacing: '0.25em',
            lineHeight: 1.2,
          }}>
            {spacify(subsidiary?.chineseName)}
          </div>
        </div>
      </FlexCell>

      {/* === ROW 60 (index 5): A-D "BILL TO:" (2r x 4c), E-I empty === */}
      {/* Row 60: Merge A-D (2r x 4c) for "BILL TO:" */}
      <FlexCell columns="A-D" height={sumHeights(5, 2)} rowSpan={2} vAlign="middle" debug={debug}>
        <span style={{
          ...googleSansStyle,
          fontSize: '11px', // 8pt converted to px
          fontStyle: 'italic',
        }}>
          BILL TO:
        </span>
      </FlexCell>
      <Cell columns="E-I" height={ROW_HEIGHTS[5]} debug={debug} />
      {/* J-N covered by rowSpan from row 59 */}

      {/* === ROW 61 (index 6): A-D covered by BILL TO rowSpan, E-I empty === */}
      {/* A-D covered by rowSpan from row 60 */}
      <Cell columns="E-I" height={ROW_HEIGHTS[6]} debug={debug} />
      <Cell columns="J-N" height={ROW_HEIGHTS[6]} debug={debug} />

      {/* === ROW 62 (index 7, 23px): Client Company Name A-D (1r x 4c) === */}
      {/* Row 62: Merge A-D (1r x 4c) for client company - allow text overflow */}
      <FlexCell columns="A-D" height={ROW_HEIGHTS[7]} vAlign="top" style={{ overflow: 'visible' }} debug={debug}>
        <span style={{
          ...googleSansStyle,
          fontSize: '15px', // 11pt converted to px
          fontWeight: 700,
          fontStyle: 'italic',
          whiteSpace: 'nowrap',
        }}>
          {invoice.companyName || ''}
        </span>
      </FlexCell>
      <Cell columns="E-M" height={ROW_HEIGHTS[7]} debug={debug} />
      {/* N empty but has "Invoice #:" label styling */}
      <Cell columns="N" height={ROW_HEIGHTS[7]} debug={debug} />

      {/* === ROW 63 (index 8): Address 1 A-G (1r x 7c), "Invoice #:" in N === */}
      {/* Row 63: Merge A-G (1r x 7c) for address 1 */}
      <FlexCell columns="A-G" height={ROW_HEIGHTS[8]} vAlign="bottom" debug={debug}>
        <span style={{ ...googleSansStyle, fontSize: '12px' }}> {/* 9pt converted to px */}
          {invoice.addressLine1 || ''}
        </span>
      </FlexCell>
      <Cell columns="H-M" height={ROW_HEIGHTS[8]} debug={debug} />
      <FlexCell columns="N" height={ROW_HEIGHTS[8]} vAlign="bottom" hAlign="right" debug={debug}>
        <span style={{ ...googleSansStyle, fontSize: '11px', fontStyle: 'italic' }}> {/* 8pt converted to px */}
          Invoice #:
        </span>
      </FlexCell>

      {/* === ROW 64 (index 9): Address 2 A-G (1r x 7c), Invoice # M-N (1r x 2c) === */}
      {/* Row 64: Merge A-G (1r x 7c) for address 2 */}
      <FlexCell columns="A-G" height={ROW_HEIGHTS[9]} vAlign="bottom" debug={debug}>
        <span style={{ ...googleSansStyle, fontSize: '12px' }}> {/* 9pt converted to px */}
          {invoice.addressLine2 || ''}
        </span>
      </FlexCell>
      <Cell columns="H-L" height={ROW_HEIGHTS[9]} debug={debug} />
      {/* Row 64: Merge M-N (1r x 2c) for invoice number */}
      <FlexCell columns="M-N" height={ROW_HEIGHTS[9]} vAlign="top" hAlign="right" debug={debug}>
        <span style={{ ...googleSansStyle, fontSize: '12px', fontWeight: 700 }}> {/* 9pt converted to px */}
          #{invoice.invoiceNumber || ''}
        </span>
      </FlexCell>

      {/* === ROW 65 (index 10): Address 3 A-G (1r x 7c), "Issued Date:" in N === */}
      {/* Row 65: Merge A-G (1r x 7c) for address 3 */}
      <FlexCell columns="A-G" height={ROW_HEIGHTS[10]} vAlign="bottom" debug={debug}>
        <span style={{ ...googleSansStyle, fontSize: '12px' }}> {/* 9pt converted to px */}
          {[invoice.addressLine3, invoice.region].filter(Boolean).join(', ')}
        </span>
      </FlexCell>
      <Cell columns="H-M" height={ROW_HEIGHTS[10]} debug={debug} />
      <FlexCell columns="N" height={ROW_HEIGHTS[10]} vAlign="bottom" hAlign="right" debug={debug}>
        <span style={{ ...googleSansStyle, fontSize: '11px', fontStyle: 'italic' }}> {/* 8pt converted to px */}
          Issued Date:
        </span>
      </FlexCell>

      {/* === ROW 66 (index 11): A-G empty (1r x 7c), L-N date (1r x 3c) === */}
      {/* Row 66: Merge A-G (1r x 7c) empty */}
      <Cell columns="A-G" height={ROW_HEIGHTS[11]} debug={debug} />
      <Cell columns="H-K" height={ROW_HEIGHTS[11]} debug={debug} />
      {/* Row 66: Merge L-N (1r x 3c) for date */}
      <FlexCell columns="L-N" height={ROW_HEIGHTS[11]} vAlign="top" hAlign="right" debug={debug}>
        <span style={{ ...googleSansStyle, fontSize: '12px', fontWeight: 700 }}> {/* 9pt converted to px */}
          {invoiceDate}
        </span>
      </FlexCell>

      {/* === ROW 67 (index 12): Attn in A, Rep in B, L-N empty (1r x 3c) === */}
      <FlexCell columns="A" height={ROW_HEIGHTS[12]} vAlign="bottom" debug={debug}>
        <span style={{ ...googleSansStyle, fontSize: '12px', fontStyle: 'italic' }}> {/* 9pt converted to px */}
          Attn:
        </span>
      </FlexCell>
      <FlexCell columns="B-K" height={ROW_HEIGHTS[12]} vAlign="bottom" debug={debug}>
        <span style={{ ...googleSansStyle, fontSize: '12px' }}> {/* 9pt converted to px */}
          {repTitle} {repName}
        </span>
      </FlexCell>
      {/* Row 67: Merge L-N (1r x 3c) empty */}
      <Cell columns="L-N" height={ROW_HEIGHTS[12]} debug={debug} />

      {/* === ROW 68 (index 13): Empty, L-N (1r x 3c) === */}
      <Cell columns="A-K" height={ROW_HEIGHTS[13]} debug={debug} />
      {/* Row 68: Merge L-N (1r x 3c) empty */}
      <Cell columns="L-N" height={ROW_HEIGHTS[13]} debug={debug} />

      {/* === ROW 69 (index 14): A-D merged empty (1r x 4c), "FPS:" in N === */}
      {/* Row 69: Merge A-D (1r x 4c) empty */}
      <Cell columns="A-D" height={ROW_HEIGHTS[14]} debug={debug} />
      <Cell columns="E-M" height={ROW_HEIGHTS[14]} debug={debug} />
      <FlexCell columns="N" height={ROW_HEIGHTS[14]} vAlign="bottom" hAlign="left" debug={debug}>
        <span style={{ ...googleSansStyle, fontSize: '11px', fontStyle: 'italic' }}> {/* 8pt converted to px */}
          FPS:
        </span>
      </FlexCell>

      {/* === ROWS 70-74 (indices 15-19): QR Code in N (5r x 1c) === */}
      <Cell columns="A-M" height={ROW_HEIGHTS[15]} debug={debug} />
      {/* Row 70: Merge N (5r x 1c) for QR code */}
      <FlexCell
        columns="N"
        height={sumHeights(15, 5)}
        rowSpan={5}
        vAlign="top"
        hAlign="center"
        debug={debug}
      >
        {qrCodeUrl && (
          <img
            src={qrCodeUrl}
            alt="FPS QR Code"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        )}
      </FlexCell>

      {/* Row 71 (index 16) */}
      <Cell columns="A-M" height={ROW_HEIGHTS[16]} debug={debug} />

      {/* === ROW 72 (index 17): Presenter A-K (1r x 11c) === */}
      {/* Row 72: Merge A-K (1r x 11c) for presenter */}
      <FlexCell columns="A-K" height={ROW_HEIGHTS[17]} vAlign="bottom" debug={debug}>
        <PresenterWorkTypeText text={project?.presenterWorkType} />
      </FlexCell>
      <Cell columns="L-M" height={ROW_HEIGHTS[17]} debug={debug} />

      {/* === ROW 73 (index 18, 42px): Project Title A-K (1r x 11c) === */}
      {/* Row 73: Merge A-K (1r x 11c) for project title */}
      <FlexCell columns="A-K" height={ROW_HEIGHTS[18]} vAlign="middle" debug={debug}>
        <ProjectTitleText title={project?.projectTitle} />
      </FlexCell>
      <Cell columns="L-M" height={ROW_HEIGHTS[18]} debug={debug} />

      {/* === ROW 74 (index 19): Project Nature A-J (1r x 10c) === */}
      {/* Row 74: Merge A-J (1r x 10c) for project nature */}
      <FlexCell columns="A-J" height={ROW_HEIGHTS[19]} vAlign="bottom" debug={debug}>
        <span style={{ ...googleSansStyle, fontSize: '11px', fontStyle: 'italic' }}> {/* 8pt converted to px */}
          {project?.projectNature || ''}
        </span>
      </FlexCell>
      <Cell columns="K-M" height={ROW_HEIGHTS[19]} debug={debug} />
      {/* N covered by QR code rowSpan */}

      {/* === ROWS 75-76 (indices 20-21): Spacer === */}
      <Cell columns="A-M" height={ROW_HEIGHTS[20]} debug={debug} />
      <Cell columns="A-M" height={ROW_HEIGHTS[21]} debug={debug} />

      {/* === ROW 77 (index 22): A-I merged empty (1r x 9c) === */}
      {/* Row 77: Merge A-I (1r x 9c) empty */}
      <Cell columns="A-I" height={ROW_HEIGHTS[22]} debug={debug} />
      <Cell columns="J-N" height={ROW_HEIGHTS[22]} debug={debug} />
    </>
  );
};

/**
 * ProjectTitleText - Renders project title with CJK/Latin font handling
 */
const ProjectTitleText: React.FC<{ title?: string | null }> = ({ title }) => {
  if (!title) return null;

  const segments = title.split(/([\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]+)/);

  return (
    <span>
      {segments.filter(Boolean).map((seg, idx) => {
        const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]/.test(seg);
        const style: React.CSSProperties = hasCJK
          ? { fontFamily: '"Yuji Mai", serif', fontSize: '32px', fontWeight: 700 } // 24pt converted to px
          : { fontFamily: '"Federo", sans-serif', fontSize: '32px', fontWeight: 700 }; // 24pt converted to px
        return (
          <span key={idx} style={style}>
            {seg}
          </span>
        );
      })}
    </span>
  );
};

/**
 * PresenterWorkTypeText - Renders presenter/work type with CJK/Latin font handling
 */
const PresenterWorkTypeText: React.FC<{ text?: string | null }> = ({ text }) => {
  if (!text) return null;

  const segments = text.split(/([\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]+)/);

  return (
    <span>
      {segments.filter(Boolean).map((seg, idx) => {
        const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]/.test(seg);
        const style: React.CSSProperties = hasCJK
          ? { fontFamily: '"Iansui", sans-serif', fontSize: '11px', fontWeight: 700 } // 8pt converted to px
          : { fontFamily: '"Google Sans Mono", "Roboto Mono", monospace', fontSize: '11px' }; // 8pt converted to px
        return (
          <span key={idx} style={style}>
            {seg}
          </span>
        );
      })}
      :
    </span>
  );
};

export default InvoiceHeaderFullVersionA;
