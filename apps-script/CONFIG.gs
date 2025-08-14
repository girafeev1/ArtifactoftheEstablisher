/**
 * Configuration for Calendar sync.
 * Replace placeholder values with actual IDs before deployment.
 */
var CONFIG = {
  COACHING_CALENDAR_ID: 'primary',
  FIRESTORE_PROJECT_ID: 'aote-pms',
  FIRESTORE_DB: '(default)',
  BACKFILL_DAYS: 365,
  TIMEZONE: 'Asia/Hong_Kong',
  SYNC_TOKEN_KEY: 'calendarSyncToken'
};

function CAL_ID_() {
  var prop = PropertiesService.getScriptProperties().getProperty('COACHING_CALENDAR_ID');
  return prop || CONFIG.COACHING_CALENDAR_ID;
}
