/**
 * Utility helpers for Calendar syncing.
 */
var abbrCache = {};

function formatTime(date) {
  return {
    dateStamp: Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy-MM-dd'),
    timeStamp: Utilities.formatDate(date, CONFIG.TIMEZONE, 'HH:mm:ss'),
    timestamp: date.toISOString()
  };
}

function extractEventId(item) {
  if (item && item.id) return item.id.split('@')[0];
  if (item && item.iCalUID) return item.iCalUID.split('@')[0];
  return null;
}

function createDummyEvent(item) {
  if (item && item.start && item.start.date && !item.start.dateTime) {
    var start = new Date(item.start.date + 'T00:00:00');
    var end = item.end && item.end.date ? new Date(item.end.date + 'T00:00:00') : new Date(start.getTime() + 24 * 60 * 60 * 1000);
    item.start.dateTime = start.toISOString();
    item.end.dateTime = end.toISOString();
  }
  return item;
}

function parseAccountAndType_(title) {
  if (!title) return { account: null, sessionType: 'physical' };
  var virtual = /\(FaceTime\)/i.test(title);
  var account = title.replace(/\(FaceTime\)/i, '').trim();
  return { account: account, sessionType: virtual ? 'virtual' : 'physical' };
}

function resolveAbbrByAccount_(account) {
  if (!account) return null;
  if (abbrCache[account]) return abbrCache[account];
  var query = {
    from: [{ collectionId: 'Students' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'account' },
        op: 'EQUAL',
        value: { stringValue: account }
      }
    },
    limit: 1
  };
  var resp = runQuery_(query);
  var abbr = null;
  if (resp && resp.length && resp[0].document) {
    var parts = resp[0].document.name.split('/');
    abbr = parts[parts.length - 1];
  }
  abbrCache[account] = abbr;
  return abbr;
}
