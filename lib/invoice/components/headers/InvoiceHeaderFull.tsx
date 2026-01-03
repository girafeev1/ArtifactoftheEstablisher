/**
 * InvoiceHeaderFull Component
 *
 * Full header for the first page of an invoice.
 * Layout matches the extracted header-versionB-full.json exactly.
 *
 * Row heights: [42, 18, 18, 18, 16, 16, 16, 32, 19, 19, 19, 19, 21, 21, 22, 21, 17, 42, 17, 21, 21, 21]
 */

import React from 'react';
import { Cell, FlexCell } from '../../grid';
import type { ProjectInvoiceRecord, ProjectRecord, SubsidiaryDoc, Representative } from '../../types';
import type { RepresentativeInfo } from '../../../representative';

export interface InvoiceHeaderFullProps {
  invoice: ProjectInvoiceRecord;
  project?: ProjectRecord | null;
  subsidiary?: SubsidiaryDoc | null;
  qrCodeUrl?: string | null;
  debug?: boolean;
}

/**
 * Spacify text - add a space between each character (for CJK text)
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

/**
 * InvoiceHeaderFull - Full header for page 1
 *
 * Rows 1-22 total, heights from JSON:
 * [42, 18, 18, 18, 16, 16, 16, 32, 19, 19, 19, 19, 21, 21, 22, 21, 17, 42, 17, 21, 21, 21]
 * Total: 476px
 */
export const InvoiceHeaderFull: React.FC<InvoiceHeaderFullProps> = ({
  invoice,
  project,
  subsidiary,
  qrCodeUrl,
  debug,
}) => {
  const invoiceDate = formatInvoiceDate(project);
  const { title: repTitle, name: repName } = getRepresentativeName(invoice.representative);

  // Common font styles matching the JSON exactly
  const monoStyle = { fontFamily: '"Roboto Mono", monospace' };
  const cormorantStyle = { fontFamily: '"Cormorant Infant", serif' };
  const garamondStyle = { fontFamily: '"EB Garamond", serif' };
  const karlaStyle = { fontFamily: '"Karla", sans-serif' };
  const federoStyle = { fontFamily: '"Federo", sans-serif' };

  // Row heights from JSON
  const ROW_HEIGHTS = [42, 18, 18, 18, 16, 16, 16, 32, 19, 19, 19, 19, 21, 21, 22, 21, 17, 42, 17, 21, 21, 21];

  return (
    <>
      {/* === ROW 1-4: Logo (A-C spans 4 rows) | Subsidiary Names (J-N) === */}
      {/* Logo: merge r1=1, c1=1, r2=4, c2=3 → A-C, rows 1-4 */}
      <FlexCell
        columns="A-C"
        height={ROW_HEIGHTS[0] + ROW_HEIGHTS[1] + ROW_HEIGHTS[2] + ROW_HEIGHTS[3]}
        rowSpan={4}
        vAlign="middle"
        debug={debug}
      >
        <span style={{
          fontFamily: '"Rampart One", cursive',
          fontSize: '62px', // 60 + 2
          lineHeight: 1,
        }}>
          E.
        </span>
      </FlexCell>
      {/* Empty cells D-I for row 1 */}
      <Cell columns="D-I" height={ROW_HEIGHTS[0]} debug={debug} />
      {/* Subsidiary names: merge r1=1, c1=10, r2=1, c2=14 → J-N row 1 only */}
      <FlexCell columns="J-N" height={ROW_HEIGHTS[0]} vAlign="middle" hAlign="right" debug={debug}>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            ...cormorantStyle,
            fontSize: '12px', // 10 + 2 (2pt bigger than Chinese)
            fontWeight: 700,
            lineHeight: 1.2,
            whiteSpace: 'pre', // Preserve multiple spaces from spacification
          }}>
            {subsidiary?.englishName?.split('').join(' ')}
          </div>
          <div style={{
            fontFamily: '"Iansui", sans-serif',
            fontSize: '10px', // 8 + 2 for Chinese
            fontWeight: 700,
            letterSpacing: '0.25em',
            lineHeight: 1.2,
          }}>
            {spacify(subsidiary?.chineseName)}
          </div>
        </div>
      </FlexCell>

      {/* === ROW 2 (18px): Empty D-I | Address J-N (spans rows 2-4) === */}
      <Cell columns="D-I" height={ROW_HEIGHTS[1]} debug={debug} />
      {/* Address: merge r1=2, c1=10, r2=4, c2=14 → J-N, rows 2-4 */}
      <FlexCell
        columns="J-N"
        height={ROW_HEIGHTS[1] + ROW_HEIGHTS[2] + ROW_HEIGHTS[3]}
        rowSpan={3}
        vAlign="middle"
        hAlign="right"
        debug={debug}
      >
        <div style={{
          ...cormorantStyle,
          fontSize: '9px', // 7 + 2
          textAlign: 'right',
          lineHeight: 1.5,
        }}>
          {subsidiary?.addressLine1 && <div>{subsidiary.addressLine1}</div>}
          {subsidiary?.addressLine2 && <div>{subsidiary.addressLine2}</div>}
          {subsidiary?.addressLine3 && <div>{subsidiary.addressLine3}</div>}
          {subsidiary?.region && <div>{subsidiary.region}, Hong Kong</div>}
        </div>
      </FlexCell>

      {/* === ROW 3 (18px): Empty D-I (Logo and Address still spanning) === */}
      <Cell columns="D-I" height={ROW_HEIGHTS[2]} debug={debug} />
      {/* J-N covered by rowSpan from row 2 */}

      {/* === ROW 4 (18px): Empty D-I (Logo and Address still spanning) === */}
      <Cell columns="D-I" height={ROW_HEIGHTS[3]} debug={debug} />
      {/* J-N covered by rowSpan from row 2 */}

      {/* === ROW 5 (16px): Empty A-I | Email/Phone J-N (spans rows 5-6) === */}
      {/* merge r1=5, c1=10, r2=6, c2=14 → J-N rows 5-6 */}
      <Cell columns="A-I" height={ROW_HEIGHTS[4]} debug={debug} />
      <FlexCell
        columns="J-N"
        height={ROW_HEIGHTS[4] + ROW_HEIGHTS[5]}
        rowSpan={2}
        vAlign="top"
        hAlign="right"
        debug={debug}
      >
        <div style={{
          ...cormorantStyle,
          fontSize: '9px', // 7 + 2
          fontWeight: 700,
          color: 'rgb(102, 102, 102)', // 0.4 * 255
          textAlign: 'right',
          lineHeight: 1.4,
        }}>
          {subsidiary?.email && <div>{spacify(subsidiary.email)}</div>}
          {subsidiary?.phone && <div>{spacify(subsidiary.phone)}</div>}
        </div>
      </FlexCell>

      {/* === ROW 6 (16px): BILL TO A-D (spans rows 6-7) | J-N covered by row 5 === */}
      {/* merge r1=6, c1=1, r2=7, c2=4 → A-D rows 6-7 */}
      <FlexCell
        columns="A-D"
        height={ROW_HEIGHTS[5] + ROW_HEIGHTS[6]}
        rowSpan={2}
        vAlign="bottom"
        debug={debug}
      >
        <span style={{
          ...monoStyle,
          fontSize: '10px', // 8 + 2
          fontStyle: 'italic',
        }}>
          BILL TO:
        </span>
      </FlexCell>
      <Cell columns="E-I" height={ROW_HEIGHTS[5]} debug={debug} />
      {/* J-N covered by rowSpan from row 5 */}

      {/* === ROW 7 (16px): A-D covered by row 6 | E-K empty | Invoice L-N (spans rows 7-8) === */}
      {/* merge r1=7, c1=12, r2=8, c2=14 → L-N rows 7-8 */}
      <Cell columns="E-K" height={ROW_HEIGHTS[6]} debug={debug} />
      <FlexCell
        columns="L-N"
        height={ROW_HEIGHTS[6] + ROW_HEIGHTS[7]}
        rowSpan={2}
        vAlign="middle"
        hAlign="center"
        debug={debug}
      >
        <span style={{
          ...garamondStyle,
          fontSize: '37px', // 35 + 2
          fontWeight: 700,
        }}>
          Invoice
        </span>
      </FlexCell>

      {/* === ROW 8 (32px): Client Company Name A-D | E-K empty | L-N covered by row 7 === */}
      {/* merge r1=8, c1=1, r2=8, c2=4 → A-D row 8 - allow text overflow */}
      <FlexCell columns="A-D" height={ROW_HEIGHTS[7]} vAlign="middle" style={{ overflow: 'visible' }} debug={debug}>
        <span style={{
          ...monoStyle,
          fontSize: '13px', // 11 + 2
          fontWeight: 700,
          fontStyle: 'italic',
          whiteSpace: 'nowrap',
        }}>
          {invoice.companyName || ''}
        </span>
      </FlexCell>
      <Cell columns="E-K" height={ROW_HEIGHTS[7]} debug={debug} />
      {/* L-N covered by rowSpan from row 7 */}

      {/* === ROW 9 (19px): Client Address Line 1 === */}
      {/* merge r1=9, c1=1, r2=9, c2=7 → A-G */}
      <FlexCell columns="A-G" height={ROW_HEIGHTS[8]} vAlign="middle" debug={debug}>
        <span style={{ ...monoStyle, fontSize: '11px' }}>
          {invoice.addressLine1 || ''}
        </span>
      </FlexCell>
      <Cell columns="H-N" height={ROW_HEIGHTS[8]} debug={debug} />

      {/* === ROW 10 (19px): Client Address Line 2 | Invoice # Label === */}
      {/* merge r1=10, c1=1, r2=10, c2=7 → A-G */}
      <FlexCell columns="A-G" height={ROW_HEIGHTS[9]} vAlign="middle" debug={debug}>
        <span style={{ ...monoStyle, fontSize: '11px' }}>
          {invoice.addressLine2 || ''}
        </span>
      </FlexCell>
      <Cell columns="H-M" height={ROW_HEIGHTS[9]} debug={debug} />
      <FlexCell columns="N" height={ROW_HEIGHTS[9]} vAlign="bottom" hAlign="right" debug={debug}>
        <span style={{ ...monoStyle, fontSize: '10px', fontStyle: 'italic' }}>
          Invoice #:
        </span>
      </FlexCell>

      {/* === ROW 11 (19px): Client Address Line 3 | Invoice Number === */}
      {/* merge r1=11, c1=1, r2=11, c2=7 → A-G, merge r1=11, c1=13, r2=11, c2=14 → M-N */}
      <FlexCell columns="A-G" height={ROW_HEIGHTS[10]} vAlign="middle" debug={debug}>
        <span style={{ ...monoStyle, fontSize: '11px' }}>
          {[invoice.addressLine3, invoice.region].filter(Boolean).join(', ')}
        </span>
      </FlexCell>
      <Cell columns="H-L" height={ROW_HEIGHTS[10]} debug={debug} />
      <FlexCell columns="M-N" height={ROW_HEIGHTS[10]} vAlign="top" hAlign="right" debug={debug}>
        <span style={{ ...monoStyle, fontSize: '11px', fontWeight: 700 }}>
          #{invoice.invoiceNumber || ''}
        </span>
      </FlexCell>

      {/* === ROW 12 (19px): Empty | Issued Date Label === */}
      {/* merge r1=12, c1=1, r2=12, c2=7 → A-G */}
      <Cell columns="A-G" height={ROW_HEIGHTS[11]} debug={debug} />
      <Cell columns="H-M" height={ROW_HEIGHTS[11]} debug={debug} />
      <FlexCell columns="N" height={ROW_HEIGHTS[11]} vAlign="bottom" hAlign="right" debug={debug}>
        <span style={{ ...monoStyle, fontSize: '10px', fontStyle: 'italic' }}>
          Issued Date:
        </span>
      </FlexCell>

      {/* === ROW 13 (21px): Attn + Representative | Invoice Date === */}
      {/* merge r1=13, c1=2, r2=13, c2=7 → B-G, merge r1=13, c1=12, r2=13, c2=14 → L-N */}
      <FlexCell columns="A" height={ROW_HEIGHTS[12]} vAlign="bottom" debug={debug}>
        <span style={{ ...monoStyle, fontSize: '11px', fontWeight: 700, fontStyle: 'italic' }}>
          Attn:
        </span>
      </FlexCell>
      <FlexCell columns="B-G" height={ROW_HEIGHTS[12]} vAlign="bottom" debug={debug}>
        <span style={{ ...monoStyle, fontSize: '11px', fontWeight: 700 }}>
          {repTitle} {repName}
        </span>
      </FlexCell>
      <Cell columns="H-K" height={ROW_HEIGHTS[12]} debug={debug} />
      <FlexCell columns="L-N" height={ROW_HEIGHTS[12]} vAlign="top" hAlign="right" debug={debug}>
        <span style={{ ...monoStyle, fontSize: '11px', fontWeight: 700 }}>
          {invoiceDate}
        </span>
      </FlexCell>

      {/* === ROW 14 (21px): Empty | merge r1=14, c1=12, r2=14, c2=14 → L-N === */}
      <Cell columns="A-K" height={ROW_HEIGHTS[13]} debug={debug} />
      <Cell columns="L-N" height={ROW_HEIGHTS[13]} debug={debug} />

      {/* === ROW 15 (22px): FPS Label === */}
      {/* merge r1=15, c1=1, r2=15, c2=4 → A-D */}
      <Cell columns="A-D" height={ROW_HEIGHTS[14]} debug={debug} />
      <Cell columns="E-M" height={ROW_HEIGHTS[14]} debug={debug} />
      <FlexCell columns="N" height={ROW_HEIGHTS[14]} vAlign="middle" hAlign="left" debug={debug}>
        <span style={{ ...monoStyle, fontSize: '10px', fontStyle: 'italic' }}>
          FPS:
        </span>
      </FlexCell>

      {/* === ROW 16 (21px): QR Code starts (spans rows 16-19, column N only) === */}
      {/* merge r1=16, c1=14, r2=19, c2=14 → N rows 16-19 */}
      <Cell columns="A-M" height={ROW_HEIGHTS[15]} debug={debug} />
      <FlexCell
        columns="N"
        height={ROW_HEIGHTS[15] + ROW_HEIGHTS[16] + ROW_HEIGHTS[17] + ROW_HEIGHTS[18]}
        rowSpan={4}
        vAlign="middle"
        hAlign="center"
        debug={debug}
      >
        {qrCodeUrl && (
          <img
            src={qrCodeUrl}
            alt="FPS QR Code"
            style={{ width: '90px', height: '90px', objectFit: 'contain' }}
          />
        )}
      </FlexCell>

      {/* === ROW 17 (17px): PresenterWorkType === */}
      {/* merge r1=17, c1=1, r2=17, c2=11 → A-K */}
      <FlexCell columns="A-K" height={ROW_HEIGHTS[16]} vAlign="middle" debug={debug}>
        <PresenterWorkTypeText text={project?.presenterWorkType} />
      </FlexCell>
      <Cell columns="L-M" height={ROW_HEIGHTS[16]} debug={debug} />
      {/* N covered by QR code rowSpan */}

      {/* === ROW 18 (42px): Project Title === */}
      {/* merge r1=18, c1=1, r2=18, c2=11 → A-K */}
      <FlexCell columns="A-K" height={ROW_HEIGHTS[17]} vAlign="middle" debug={debug}>
        <ProjectTitleText title={project?.projectTitle} />
      </FlexCell>
      <Cell columns="L-M" height={ROW_HEIGHTS[17]} debug={debug} />
      {/* N covered by QR code rowSpan */}

      {/* === ROW 19 (17px): Project Nature === */}
      {/* merge r1=19, c1=1, r2=19, c2=11 → A-K */}
      <FlexCell columns="A-K" height={ROW_HEIGHTS[18]} vAlign="middle" debug={debug}>
        <span style={{ ...monoStyle, fontSize: '10px', fontStyle: 'italic' }}>
          {project?.projectNature || ''}
        </span>
      </FlexCell>
      <Cell columns="L-M" height={ROW_HEIGHTS[18]} debug={debug} />
      {/* N covered by QR code rowSpan */}

      {/* === ROWS 20-22 (21px each): Spacer before table === */}
      <Cell columns="A-N" height={ROW_HEIGHTS[19]} debug={debug} />
      <Cell columns="A-N" height={ROW_HEIGHTS[20]} debug={debug} />
      {/* Row 22: merge r1=22, c1=1, r2=22, c2=9 → A-I */}
      <Cell columns="A-I" height={ROW_HEIGHTS[21]} debug={debug} />
      <Cell columns="J-N" height={ROW_HEIGHTS[21]} debug={debug} />
    </>
  );
};

/**
 * ProjectTitleText - Renders project title with CJK/Latin font handling
 * Uses Federo for Latin, Yuji Mai for CJK
 */
const ProjectTitleText: React.FC<{ title?: string | null }> = ({ title }) => {
  if (!title) return null;

  const segments = title.split(/([\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]+)/);

  return (
    <span>
      {segments.filter(Boolean).map((seg, idx) => {
        const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]/.test(seg);
        const style: React.CSSProperties = hasCJK
          ? { fontFamily: '"Yuji Mai", serif', fontSize: '26px', fontWeight: 700 }
          : { fontFamily: '"Federo", sans-serif', fontSize: '26px', fontWeight: 700 };
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
 * Uses Karla for Latin, Iansui for CJK
 */
const PresenterWorkTypeText: React.FC<{ text?: string | null }> = ({ text }) => {
  if (!text) return null;

  const segments = text.split(/([\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]+)/);

  return (
    <span>
      {segments.filter(Boolean).map((seg, idx) => {
        const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]/.test(seg);
        const style: React.CSSProperties = hasCJK
          ? { fontFamily: '"Iansui", sans-serif', fontSize: '10px', fontWeight: 700 }
          : { fontFamily: '"Karla", sans-serif', fontSize: '10px' };
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

export default InvoiceHeaderFull;
