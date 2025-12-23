/**
 * Test script to verify dynamic pagination is working correctly
 */

// Mock implementation of the key functions
const SECTION_HEIGHTS = {
  headerFull: 476,
  headerContinuation: 210,
  tableHeader: 25,
  totalBox: 78,
  footerFull: 195,
  footerSimple: 81,
};

const ITEM_ROW_HEIGHTS = {
  titleRow: 35,
  feeTypeRow: 24,
  notesRow: 21,
};

const TYPOGRAPHY = {
  notesFontSize: 10,
  notesLineHeight: 1.4,
  notesCharsPerLine: 75,
};

const PAGE_DIMENSIONS = {
  contentHeight: 1180,
  spacerRowHeight: 21,
};

function calculateNotesHeight(notes) {
  if (!notes || notes.trim().length === 0) {
    return { lineCount: 0, height: 0, overflow: 0, hasNotes: false };
  }

  const text = notes.trim();
  const explicitLines = text.split('\n');
  let totalLines = 0;

  for (const line of explicitLines) {
    if (line.length === 0) {
      totalLines += 1;
    } else {
      const wrappedLines = Math.ceil(line.length / TYPOGRAPHY.notesCharsPerLine);
      totalLines += Math.max(1, wrappedLines);
    }
  }

  const lineHeight = TYPOGRAPHY.notesFontSize * TYPOGRAPHY.notesLineHeight;
  const actualHeight = Math.ceil(totalLines * lineHeight);
  const finalHeight = Math.max(ITEM_ROW_HEIGHTS.notesRow, actualHeight);
  const overflow = Math.max(0, actualHeight - ITEM_ROW_HEIGHTS.notesRow);

  return { lineCount: totalLines, height: finalHeight, overflow, hasNotes: true };
}

function calculateItemHeight(item) {
  const notesCalc = calculateNotesHeight(item.notes);
  const titleRowHeight = ITEM_ROW_HEIGHTS.titleRow;
  const feeTypeRowHeight = ITEM_ROW_HEIGHTS.feeTypeRow;
  const notesRowHeight = notesCalc.hasNotes ? notesCalc.height : 0;

  return {
    titleRowHeight,
    feeTypeRowHeight,
    notesRowHeight,
    totalHeight: titleRowHeight + feeTypeRowHeight + notesRowHeight,
    notesLineCount: notesCalc.lineCount,
    hasNotes: notesCalc.hasNotes,
  };
}

function getEquivalentItemCount(item) {
  const notesCalc = calculateNotesHeight(item.notes);
  const notesRows = notesCalc.hasNotes ? Math.max(1, Math.ceil(notesCalc.lineCount)) : 0;
  const totalRows = 1 + 1 + notesRows;
  return Math.ceil(totalRows / 2);
}

function getTotalEquivalentItems(items) {
  return items.reduce(function(sum, item) { return sum + getEquivalentItemCount(item); }, 0);
}

function calculateSpacing(equivalentItemCount) {
  var preItem = 0, betweenItems = 0, beforeTotal = 0;
  var afterTotal = 2;

  if (equivalentItemCount === 1) {
    preItem = 3; betweenItems = 0; beforeTotal = 3;
  } else if (equivalentItemCount === 2) {
    preItem = 2; betweenItems = 2; beforeTotal = 3;
  } else if (equivalentItemCount === 3) {
    preItem = 1; betweenItems = 2; beforeTotal = 2;
  } else if (equivalentItemCount === 4) {
    preItem = 1; betweenItems = 1; beforeTotal = 2;
  } else {
    preItem = 1; betweenItems = 1; beforeTotal = 1;
  }

  return { preItem: preItem, betweenItems: betweenItems, beforeTotal: beforeTotal, afterTotal: afterTotal };
}

function calculatePaginationBreakpoints(items) {
  if (items.length === 0) {
    return [{
      pageNumber: 1,
      startItemIndex: 0,
      endItemIndex: -1,
      itemCount: 0,
      contentHeight: SECTION_HEIGHTS.headerFull + SECTION_HEIGHTS.tableHeader +
                     SECTION_HEIGHTS.totalBox + SECTION_HEIGHTS.footerFull,
      includesTotalBox: true,
    }];
  }

  var breakpoints = [];
  var itemHeights = items.map(function(item) { return calculateItemHeight(item); });
  var totalEquivalent = getTotalEquivalentItems(items);
  var globalSpacing = calculateSpacing(totalEquivalent);

  var currentPage = 1;
  var currentPageHeight = 0;
  var startItemIndex = 0;
  var currentItemIndex = 0;

  currentPageHeight = SECTION_HEIGHTS.headerFull + SECTION_HEIGHTS.tableHeader;
  currentPageHeight += globalSpacing.preItem * PAGE_DIMENSIONS.spacerRowHeight;

  while (currentItemIndex < items.length) {
    var itemHeight = itemHeights[currentItemIndex].totalHeight;
    var betweenSpacing = currentItemIndex > startItemIndex
      ? globalSpacing.betweenItems * PAGE_DIMENSIONS.spacerRowHeight
      : 0;

    var isLastItem = currentItemIndex === items.length - 1;
    var reservedSpace = isLastItem
      ? (globalSpacing.beforeTotal * PAGE_DIMENSIONS.spacerRowHeight +
         SECTION_HEIGHTS.totalBox +
         globalSpacing.afterTotal * PAGE_DIMENSIONS.spacerRowHeight +
         SECTION_HEIGHTS.footerFull)
      : 0;

    var projectedHeight = currentPageHeight + betweenSpacing + itemHeight + reservedSpace;

    if (projectedHeight > PAGE_DIMENSIONS.contentHeight && currentItemIndex > startItemIndex) {
      var pageHeightWithFooter = currentPageHeight + SECTION_HEIGHTS.footerSimple;

      breakpoints.push({
        pageNumber: currentPage,
        startItemIndex: startItemIndex,
        endItemIndex: currentItemIndex - 1,
        itemCount: currentItemIndex - startItemIndex,
        contentHeight: pageHeightWithFooter,
        includesTotalBox: false,
      });

      currentPage++;
      startItemIndex = currentItemIndex;
      currentPageHeight = SECTION_HEIGHTS.headerContinuation + SECTION_HEIGHTS.tableHeader;
      currentPageHeight += globalSpacing.preItem * PAGE_DIMENSIONS.spacerRowHeight;
      continue;
    }

    if (currentItemIndex === startItemIndex && projectedHeight > PAGE_DIMENSIONS.contentHeight) {
      currentPageHeight += itemHeight;
      currentItemIndex++;

      if (currentItemIndex < items.length) {
        breakpoints.push({
          pageNumber: currentPage,
          startItemIndex: startItemIndex,
          endItemIndex: currentItemIndex - 1,
          itemCount: 1,
          contentHeight: currentPageHeight + SECTION_HEIGHTS.footerSimple,
          includesTotalBox: false,
        });

        currentPage++;
        startItemIndex = currentItemIndex;
        currentPageHeight = SECTION_HEIGHTS.headerContinuation + SECTION_HEIGHTS.tableHeader;
        currentPageHeight += globalSpacing.preItem * PAGE_DIMENSIONS.spacerRowHeight;
      }
      continue;
    }

    currentPageHeight += betweenSpacing + itemHeight;
    currentItemIndex++;
  }

  if (currentItemIndex > startItemIndex || breakpoints.length === 0) {
    currentPageHeight +=
      globalSpacing.beforeTotal * PAGE_DIMENSIONS.spacerRowHeight +
      SECTION_HEIGHTS.totalBox +
      globalSpacing.afterTotal * PAGE_DIMENSIONS.spacerRowHeight +
      SECTION_HEIGHTS.footerFull;

    breakpoints.push({
      pageNumber: currentPage,
      startItemIndex: startItemIndex,
      endItemIndex: items.length - 1,
      itemCount: items.length - startItemIndex,
      contentHeight: currentPageHeight,
      includesTotalBox: true,
    });
  }

  return breakpoints;
}

// Create mock items
function createMockItems(count, withLongNotes) {
  var result = [];
  for (var i = 0; i < count; i++) {
    result.push({
      title: 'Service Item ' + (i + 1),
      feeType: 'Professional Fee',
      unitPrice: 1000,
      quantity: 1,
      quantityUnit: 'hour',
      notes: withLongNotes && i % 2 === 0
        ? 'This is a longer note. This is a longer note. This is a longer note. This is a longer note. This is a longer note. '
        : 'Short note',
    });
  }
  return result;
}

console.log('=== Pagination Test Results ===\n');

// Test cases
var testCases = [
  { count: 1, description: '1 item' },
  { count: 3, description: '3 items' },
  { count: 5, description: '5 items' },
  { count: 6, description: '6 items' },
  { count: 7, description: '7 items' },
  { count: 10, description: '10 items' },
  { count: 15, description: '15 items' },
];

testCases.forEach(function(tc) {
  var items = createMockItems(tc.count, false);
  var breakpoints = calculatePaginationBreakpoints(items);

  console.log('\n--- ' + tc.description + ' ---');
  console.log('Total pages: ' + breakpoints.length);
  console.log('Item distribution: [' + breakpoints.map(function(bp) { return bp.itemCount; }).join(', ') + ']');

  breakpoints.forEach(function(bp) {
    console.log('  Page ' + bp.pageNumber + ': Items ' + (bp.startItemIndex + 1) + '-' + (bp.endItemIndex + 1) + ' (' + bp.contentHeight + 'px, totalBox: ' + bp.includesTotalBox + ')');
  });
});

// Test with long notes
console.log('\n\n=== With Long Notes ===');
var itemsWithNotes = createMockItems(5, true);
var bpWithNotes = calculatePaginationBreakpoints(itemsWithNotes);
console.log('5 items with long notes: ' + bpWithNotes.length + ' pages');
bpWithNotes.forEach(function(bp) {
  console.log('  Page ' + bp.pageNumber + ': Items ' + (bp.startItemIndex + 1) + '-' + (bp.endItemIndex + 1) + ' (' + bp.contentHeight + 'px)');
});

// Show first page available space calculation
console.log('\n\n=== First Page Available Space ===');
var firstPageFixed = SECTION_HEIGHTS.headerFull + SECTION_HEIGHTS.tableHeader;
var totalBoxAndFooter = SECTION_HEIGHTS.totalBox + SECTION_HEIGHTS.footerFull;
var availableForItems = PAGE_DIMENSIONS.contentHeight - firstPageFixed - totalBoxAndFooter;
console.log('Page content height: ' + PAGE_DIMENSIONS.contentHeight + 'px');
console.log('Header + Table Header: ' + firstPageFixed + 'px');
console.log('Total Box + Footer: ' + totalBoxAndFooter + 'px');
console.log('Available for items + spacing: ' + availableForItems + 'px');
console.log('Item height (no notes): ' + (ITEM_ROW_HEIGHTS.titleRow + ITEM_ROW_HEIGHTS.feeTypeRow) + 'px');
console.log('Approx items per page: ' + Math.floor(availableForItems / (ITEM_ROW_HEIGHTS.titleRow + ITEM_ROW_HEIGHTS.feeTypeRow)));
