/**
 * ItemTableHeader Component
 *
 * Header row for the items table with "DESCRIPTION" and "AMOUNT" columns.
 * Layout matches item-table-header.json exactly.
 *
 * Row height: 25px
 */

import React from 'react';
import { FlexCell, Cell } from '../../grid';

export interface ItemTableHeaderProps {
  /** Show debug borders */
  debug?: boolean;
}

/**
 * ItemTableHeader - Column headers for the items section
 *
 * Layout (1 row, 25px):
 * - Columns A-D (1-4): "DESCRIPTION" merged - Roboto Mono 12px bold, LEFT aligned
 * - Columns E-M (5-13): Empty cells with same borders
 * - Column N (14): "AMOUNT" - Roboto Mono 12px bold, CENTER aligned
 * All cells have top and bottom borders (SOLID_MEDIUM width:2)
 */
export const ItemTableHeader: React.FC<ItemTableHeaderProps> = ({ debug }) => {
  const headerStyle: React.CSSProperties = {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: '14px', // 12 + 2
    fontWeight: 700,
    borderTop: '2px solid #000', // SOLID_MEDIUM width:2 from JSON
    borderBottom: '2px solid #000',
  };

  return (
    <>
      {/* Merge: cols 1-4 (A-D) for DESCRIPTION */}
      <FlexCell
        columns="A-D"
        height={25}
        vAlign="middle"
        hAlign="left"
        debug={debug}
        style={headerStyle}
      >
        DESCRIPTION
      </FlexCell>
      {/* Empty bordered cells E-M */}
      <Cell
        columns="E-M"
        height={25}
        debug={debug}
        style={headerStyle}
      />
      <FlexCell
        columns="N"
        height={25}
        vAlign="middle"
        hAlign="center"
        debug={debug}
        style={headerStyle}
      >
        AMOUNT
      </FlexCell>
    </>
  );
};

export default ItemTableHeader;
