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
  var t = title.replace(/^Vocal Sessions Booking System[:\s-]*/i, '');
  var virtual = false;
  t = t.replace(/\((FaceTime|Zoom|Online)\)/gi, function () {
    virtual = true;
    return '';
  });
  t = t.replace(/\s(?:-|\|)\s.*$/, '');
  t = t.replace(/\s+/g, ' ').trim();
  return { account: t || null, sessionType: virtual ? 'virtual' : 'physical' };
}

function resolveAbbrByAccount_(account) {
  if (!account) return null;
  var norm = account.toLowerCase().trim();
  if (abbrCache[norm]) return abbrCache[norm];
  var query = {
    from: [{ collectionId: 'Students' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'account' },
        op: 'EQUAL',
        value: { stringValue: account.trim() }
      }
    },
    limit: 1
  };
  var abbr = extractAbbrFromDocs_(runQuery_(query), norm);
  if (!abbr) {
    var aliasQuery = {
      from: [{ collectionId: 'Students' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'aliases' },
          op: 'ARRAY_CONTAINS',
          value: { stringValue: account.trim() }
        }
      },
      limit: 5
    };
    abbr = extractAbbrFromDocs_(runQuery_(aliasQuery), norm);
  }
  if (!abbr) {
    abbr = extractAbbrFromDocs_(runQuery_({ from: [{ collectionId: 'Students' }], limit: 1000 }), norm);
  }
  abbrCache[norm] = abbr;
  return abbr;
}

function extractAbbrFromDocs_(resp, norm) {
  if (!resp || !resp.length) return null;
  for (var i = 0; i < resp.length; i++) {
    if (!resp[i].document) continue;
    var doc = resp[i].document;
    var fields = doc.fields || {};
    var acc = fields.account && fields.account.stringValue ? fields.account.stringValue.toLowerCase().trim() : '';
    if (acc === norm) {
      var parts = doc.name.split('/');
      return parts[parts.length - 1];
    }
    if (fields.aliases && fields.aliases.arrayValue && fields.aliases.arrayValue.values) {
      var arr = fields.aliases.arrayValue.values;
      for (var j = 0; j < arr.length; j++) {
        var a = arr[j].stringValue ? arr[j].stringValue.toLowerCase().trim() : '';
        if (a === norm) {
          var p = doc.name.split('/');
          return p[p.length - 1];
        }
      }
    }
  }
  return null;
}
