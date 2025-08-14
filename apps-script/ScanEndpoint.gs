/**
 * Web endpoint for triggering calendar scans.
 */
function doPost(e) {
  var body = {};
  try {
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
  } catch (err) {}
  var action = body.action || 'scanAll';
  if (action === 'scanOne') {
    var account = body.account;
    var daysBack = body.daysBack;
    var daysForward = body.daysForward;
    var result = scanAccountWindow_(account, daysBack, daysForward);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } else {
    if (body.forceFull) clearSyncToken();
    var res = syncCalendarChanges();
    return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return doPost(e);
}

function scanAccountWindow_(account, daysBack, daysForward) {
  abbrCache = {};
  var now = new Date();
  var back = daysBack || 365;
  var forward = daysForward || 90;
  var params = {
    timeMin: new Date(now.getTime() - back * 24 * 60 * 60 * 1000).toISOString(),
    timeMax: new Date(now.getTime() + forward * 24 * 60 * 60 * 1000).toISOString(),
    singleEvents: true,
    orderBy: 'startTime'
  };
  var processed = {};
  var pageToken;
  do {
    if (pageToken) params.pageToken = pageToken;
    var resp = calendarListWithRetry_(CONFIG.COACHING_CALENDAR_ID, params);
    var items = resp.items || [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var parsed = parseAccountAndType_(item.summary);
      if (!parsed.account || parsed.account !== account) continue;
      var eventId = extractEventId(item);
      if (!eventId || processed[eventId]) continue;
      processed[eventId] = true;
      handleCalendarItem_(eventId, item);
    }
    pageToken = resp.nextPageToken;
  } while (pageToken);
  return { processed: Object.keys(processed).length };
}
