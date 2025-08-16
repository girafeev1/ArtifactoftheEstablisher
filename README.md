# ArtifactoftheEstablisher

## Firestore Structure

Each student document lives under the `Students` collection. Certain pieces of
information are recorded as time stamped history in subcollections. When a value
is edited a new document is added to the appropriate subcollection with a
`timestamp` field so the history can be audited.

Required subcollections and fields:

- `firstName` – documents contain `firstName` and `timestamp`.
- `lastName` – documents contain `lastName` and `timestamp`.
- `sex` – documents contain `sex` and `timestamp`.
- `birthDate` – documents contain `birthDate` and `timestamp`.
- `billingType` – documents contain `billingType` and `timestamp`.

### Document ID scheme

Each history record is stored in a new document whose ID encodes the field and
the order of the edit:

`<abbr>-<field>-<index>-<YYYYMMDD>`

- `abbr` – the student document ID
- `field` – the field number from the tables below
- `index` – three digit count of how many entries exist for that field (001,
  002, ...)
- `YYYYMMDD` – the date the record was created

Field numbers are:

**Personal (A)**

| Number | Field |
| ------ | ----------------- |
| A1     | firstName |
| A2     | lastName |
| A3     | sex |
| A4     | birthDate |

**Billing (B)**

| Number | Field |
| ------ | ------------------- |
| B1     | billingCompany |
| B2     | defaultBillingType |
| B3     | baseRate |
| B5     | lastPaymentDate |
| B6     | balanceDue |
| B7     | voucherBalance |

Each document stores only the edited value and a `timestamp` so the full history
can be tracked.

### Retainers

Each student has a `Retainers` subcollection storing individual retainer
documents with the following fields:

- `retainerStarts` (Timestamp)
- `retainerEnds` (Timestamp)
- `retainerRate` (Number)
- `timestamp` (Timestamp)
- `editedBy` (String)

Document IDs follow the same `<abbr>-RT-<index>-<YYYYMMDD>` scheme used by
other history records.

## Placeholder Display

When values are not available from Firestore the UI must remain responsive and show placeholders instead of failing. Empty strings, `null`, or `undefined` values render as **N/A**, while retrieval errors display as **Error**. Numeric or date values that are unavailable should show a dash (`-`).
 

## Environment Variables

Set the following in `.env.local`:

- `CALENDAR_SCAN_URL` – URL of the Apps Script endpoint.
- `SCAN_SECRET` – shared secret used for calendar scans.

## Documentation

- [Task Log — Vol. 1](docs/task-log-vol-1.md)
