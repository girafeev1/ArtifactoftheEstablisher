/**
 * Core sync logic for Calendar events into Firestore.
 */
var DAY_MS = 24 * 60 * 60 * 1000;

function syncCalendarChanges() {
  abbrCache = {};
  var props = PropertiesService.getScriptProperties();
  var processed = {};
  var now = new Date();
  var token = props.getProperty(CONFIG.SYNC_TOKEN_KEY);
  var lastResponse = null;

  while (true) {
    var params = { singleEvents: true };
    if (token) {
      params.syncToken = token;
    } else {
      params.timeMin = new Date(now.getTime() - CONFIG.BACKFILL_DAYS * DAY_MS).toISOString();
      params.timeMax = now.toISOString();
      params.orderBy = 'updated';
    }

    var pageToken = null;
    try {
      do {
        if (pageToken) params.pageToken = pageToken;
        var response = calendarListWithRetry_(CAL_ID_(), params);
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
      break;
    } catch (err) {
      var msg = err && err.message ? err.message : '';
      if (err && (err.code === 410 || err.code === 400 || msg.toLowerCase().indexOf('sync token') !== -1)) {
        clearSyncToken();
        token = null;
        pageToken = null;
        continue;
      } else {
        Logger.log('Calendar sync error: ' + msg);
        break;
      }
    }
  }

  if (lastResponse && lastResponse.nextSyncToken) {
    props.setProperty(CONFIG.SYNC_TOKEN_KEY, lastResponse.nextSyncToken);
  }
  return { processed: Object.keys(processed).length };
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

  var encodedId = encodeURIComponent(eventId);
  var docPath = 'Sessions/' + encodedId;
  var existing = getDocument_(docPath);
  var prevType = null;
  var prevStart = null;
  var prevEnd = null;
  if (existing && existing.fields) {
    if (existing.fields.sessionType && existing.fields.sessionType.stringValue)
      prevType = existing.fields.sessionType.stringValue;
    if (existing.fields.origStartTimestamp && existing.fields.origStartTimestamp.timestampValue)
      prevStart = new Date(existing.fields.origStartTimestamp.timestampValue);
    if (existing.fields.origEndTimestamp && existing.fields.origEndTimestamp.timestampValue)
      prevEnd = new Date(existing.fields.origEndTimestamp.timestampValue);
  }

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
  if (!existing) data.createdAt = new Date();
  upsertSessionDoc_(docPath, data);

  var historyType = null;
  var historySessionType = sessionType;
  var origStart = start;
  var origEnd = end;
  var newStart = null;
  var newEnd = null;

  if (item.status === 'cancelled') {
    if (prevType !== 'cancelled') {
      historyType = 'Deleted';
      historySessionType = prevType || sessionType;
      origStart = prevStart || start;
      origEnd = prevEnd || end;
    }
  } else if (!existing) {
    historyType = 'Created';
  } else {
    var changed = false;
    if (prevType !== sessionType) changed = true;
    if (!prevStart || prevStart.getTime() !== start.getTime()) changed = true;
    if (!prevEnd || prevEnd.getTime() !== end.getTime()) changed = true;
    if (changed) {
      historyType = 'Changed';
      origStart = prevStart || start;
      origEnd = prevEnd || end;
      newStart = start;
      newEnd = end;
    }
  }

  if (historyType) {
    logEventHistory_(encodedId, {
      type: historyType,
      client: account,
      sessionType: historySessionType,
      origStartTimestamp: origStart,
      origEndTimestamp: origEnd,
      newStartTimestamp: newStart,
      newEndTimestamp: newEnd
    });
  }
}

function calendarListWithRetry_(calendarId, params) {
  var attempts = 0;
  while (attempts < 5) {
    try {
      return Calendar.Events.list(calendarId, params);
    } catch (err) {
      attempts++;
      if (attempts >= 5) throw err;
      Utilities.sleep(8000);
    }
  }
}

function upsertSessionDoc_(path, data) {
  writeFirestoreDoc(path, data);
}

function logEventHistory_(encodedEventId, entry) {
  var histPath = 'Sessions/' + encodedEventId + '/AppointmentHistory';
  var existing = runQuery_({
    from: [{ collectionId: 'AppointmentHistory' }],
    orderBy: [{ field: { fieldPath: 'changeTimestamp' }, direction: 'DESCENDING' }],
    limit: 1
  }, 'Sessions/' + encodedEventId);
  if (existing && existing.length && existing[0].document) {
    var fields = existing[0].document.fields || {};
    if (fields.type && fields.type.stringValue === entry.type &&
        sameTs_(fields.origStartTimestamp, entry.origStartTimestamp) &&
        sameTs_(fields.origEndTimestamp, entry.origEndTimestamp) &&
        sameTs_(fields.newStartTimestamp, entry.newStartTimestamp) &&
        sameTs_(fields.newEndTimestamp, entry.newEndTimestamp)) {
      return;
    }
  }
  var now = new Date();
  var times = formatTime(now);
  entry.dateStamp = times.dateStamp;
  entry.timeStamp = times.timeStamp;
  entry.timestamp = now;
  entry.changeTimestamp = now;
  var historyId = Utilities.getUuid();
  writeFirestoreDoc(histPath + '/' + historyId, entry);
}

function sameTs_(field, date) {
  if (field && field.timestampValue) {
    var cmp = date ? date.toISOString() : null;
    return field.timestampValue === cmp;
  }
  return !date;
}

function setupHourlySyncTrigger() {
  ScriptApp.newTrigger('syncCalendarChanges').timeBased().everyHours(1).create();
}

function cleanupSyncTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncCalendarChanges') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function auditAllEvents() {
  clearSyncToken();
  return syncCalendarChanges();
}

function clearSyncToken() {
  PropertiesService.getScriptProperties().deleteProperty(CONFIG.SYNC_TOKEN_KEY);
}

