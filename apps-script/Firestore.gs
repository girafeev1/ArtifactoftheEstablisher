/**
 * Firestore helper functions for Apps Script (ES5).
 */
function getFirestoreToken_() {
  return ScriptApp.getOAuthToken();
}

function getFirestoreUrl(path) {
  var base = 'https://firestore.googleapis.com/v1/projects/' + CONFIG.FIRESTORE_PROJECT_ID + '/databases/' + encodeURIComponent(CONFIG.FIRESTORE_DB) + '/documents';
  if (path && path.charAt(0) !== '/') path = '/' + path;
  return base + path;
}

function writeFirestoreDoc(path, data) {
  var url = getFirestoreUrl(path);
  var payload = JSON.stringify({ fields: toFirestoreFields(data) });
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + getFirestoreToken_(),
      'Content-Type': 'application/json',
      'X-HTTP-Method-Override': 'PATCH'
    },
    payload: payload,
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 400) {
    Logger.log('Firestore write error %s: %s', path, resp.getContentText().substring(0, 1000));
  }
  return resp;
}

function getDocument_(path) {
  var url = getFirestoreUrl(path);
  var resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + getFirestoreToken_() },
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() === 404) {
    return null;
  }
  return JSON.parse(resp.getContentText());
}

function runQuery_(structuredQuery, parentPath) {
  var url = 'https://firestore.googleapis.com/v1/projects/' +
    CONFIG.FIRESTORE_PROJECT_ID + '/databases/' +
    encodeURIComponent(CONFIG.FIRESTORE_DB) + '/documents:runQuery';
  var body = { structuredQuery: structuredQuery };
  if (parentPath) {
    if (parentPath.charAt(0) === '/') parentPath = parentPath.substring(1);
    body.parent = 'projects/' + CONFIG.FIRESTORE_PROJECT_ID +
      '/databases/' + CONFIG.FIRESTORE_DB + '/documents/' + parentPath;
  }
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + getFirestoreToken_(),
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 400) {
    Logger.log('Firestore query error: %s', resp.getContentText().substring(0, 1000));
  }
  return JSON.parse(resp.getContentText());
}

function toFirestoreFields(obj) {
  var fields = {};
  for (var key in obj) {
    var val = obj[key];
    if (val === null || val === undefined) continue;
    if (Object.prototype.toString.call(val) === '[object Date]') {
      fields[key] = { timestampValue: val.toISOString() };
    } else if (typeof val === 'string') {
      fields[key] = { stringValue: val };
    } else if (typeof val === 'number') {
      if (Math.floor(val) === val) {
        fields[key] = { integerValue: String(val) };
      } else {
        fields[key] = { doubleValue: val };
      }
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    } else if (Object.prototype.toString.call(val) === '[object Array]') {
      var arr = [];
      for (var i = 0; i < val.length; i++) {
        var v = val[i];
        if (typeof v === 'string') {
          arr.push({ stringValue: v });
        }
      }
      fields[key] = { arrayValue: { values: arr } };
    } else if (typeof val === 'object') {
      fields[key] = { mapValue: { fields: toFirestoreFields(val) } };
    }
  }
  return fields;
}
