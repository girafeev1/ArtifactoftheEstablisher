# ArtifactoftheEstablisher

## Firestore Structure

Each student document lives under the `Students` collection. Certain pieces of
information are recorded as time stamped history in subcollections. When a value
is edited a new document is added to the appropriate subcollection with a
`timestamp` field so the history can be audited.

Required subcollections and fields:

- `legalName` – documents contain `firstName`, `lastName` and `timestamp`.
- `sex` – documents contain `sex` and `timestamp`.
- `birthDate` – documents contain `birthDate` and `timestamp`.
- `billingType` – documents contain `billingType` and `timestamp`.

All subcollection document IDs can be auto generated.
 
