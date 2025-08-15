/**
 * Core sync logic for Calendar events into Firestore.
 */
function syncCalendarChanges() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty(CONFIG.SYNC_TOKEN_KEY);
  var isFull = !token;
  var now = new Date();
  var params = { singleEvents: true };
  if (token) {
    params.syncToken = token;
  } else {
    params.timeMin = new Date(now.getTime() - CONFIG.BACKFILL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    params.timeMax = now.toISOString();
    params.orderBy = 'updated';
  }
  var processed = {};
  var pageToken;
  var lastResponse = null;
  do {
    if (pageToken) params.pageToken = pageToken;
    var response = Calendar.Events.list(CONFIG.COACHING_CALENDAR_ID, params);
    lastResponse = response;
    var items = response.items || [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var eventId = extractEventId(item);
      if (!eventId || processed[eventId]) continue;
      processed[eventId] = true;
      handleCalendarItem_(eventId, item);
    }
    pageToken = response.nextPageToken;
  } while (pageToken);
  if (lastResponse && lastResponse.nextSyncToken) {
    props.setProperty(CONFIG.SYNC_TOKEN_KEY, lastResponse.nextSyncToken);
  }
  return {
    ok: true,
    processed: Object.keys(processed).length,
    message: isFull ? 'Full rescan complete' : 'Incremental scan complete'
  };
}

function handleCalendarItem_(eventId, item) {
  if (!item || !item.summary) {
    Logger.log('Skipping event %s with no title', eventId);
    return;
  }
  item = createDummyEvent(item);
  var parsed = parseAccountAndType_(item.summary);
  var account = parsed.account;
  if (!account) {
    Logger.log('Skipping event %s missing account', eventId);
    return;
  }
  var sessionType = parsed.sessionType;
  if (item.status === 'cancelled') sessionType = 'cancelled';
  var start = new Date(item.start.dateTime || item.start.date);
  var end = new Date(item.end.dateTime || item.end.date);
  var abbr = resolveAbbrByAccount_(account);
  var docPath = 'Sessions/' + eventId;
  var existing = getDocument_(docPath);
  var isNew = !existing;
  var data = {
    sessionName: account,
    account: account,
    abbr: abbr,
    sessionType: sessionType,
    origStartTimestamp: start,
    origEndTimestamp: end,
    updatedAt: new Date(),
    source: 'calendar'
  };
  if (isNew) data.createdAt = new Date();
  upsertSessionDoc_(docPath, data);
  var historyType = 'Created';
  if (!isNew) historyType = sessionType === 'cancelled' ? 'Deleted' : 'Changed';
  logEventHistory_(eventId, {
    type: historyType,
    client: account,
    sessionType: sessionType,
    origStartTimestamp: start,
    origEndTimestamp: end,
    newStartTimestamp: historyType === 'Changed' ? start : null,
    newEndTimestamp: historyType === 'Changed' ? end : null
  });
}

function upsertSessionDoc_(path, data) {
  writeFirestoreDoc(path, data);
}

function logEventHistory_(eventId, entry) {
  var now = new Date();
  var times = formatTime(now);
  entry.dateStamp = times.dateStamp;
  entry.timeStamp = times.timeStamp;
  entry.timestamp = now;
  entry.changeTimestamp = now;
  var historyId = Utilities.getUuid();
  writeFirestoreDoc('Sessions/' + eventId + '/AppointmentHistory/' + historyId, entry);
}

function auditAllEvents() {
  clearSyncToken();
  return syncCalendarChanges();
}

function clearSyncToken() {
  PropertiesService.getScriptProperties().deleteProperty(CONFIG.SYNC_TOKEN_KEY);
}
