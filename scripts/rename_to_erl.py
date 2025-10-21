#!/usr/bin/env python3
import re
from firebase_admin import credentials, firestore, initialize_app
from pathlib import Path

text = Path('.env.local').read_text()

get = lambda name: re.search(fr'{name}="([\s\S]*?)"', text).group(1).replace('\\n', '\n')
cred = credentials.Certificate({
    'type': 'service_account',
    'project_id': get('FIREBASE_ADMIN_PROJECT_ID'),
    'private_key': get('FIREBASE_ADMIN_PRIVATE_KEY'),
    'client_email': get('FIREBASE_ADMIN_CLIENT_EMAIL'),
    'token_uri': 'https://oauth2.googleapis.com/token'
})
app = initialize_app(cred)
db = firestore.client()

PROJECTS_DB = 'tebs-erl'

year = '2025'
count = 0
nested_ref = db.collection('projects').document(PROJECTS_DB).collection('projects').document(year).collection('projects')
for doc in nested_ref.stream():
    doc.reference.update({'subsidiary': 'ERL'})
    count += 1
legacy_ref = db.collection(year)
for doc in legacy_ref.stream():
    doc.reference.update({'subsidiary': 'ERL'})
    count += 1

print(f"Updated {count} documents to ERL")
