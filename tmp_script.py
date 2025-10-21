import re
from firebase_admin import firestore, credentials, initialize_app
text=open('.env.local').read()
get=lambda name: re.search(fr'{name}="([\s\S]*?)"', text).group(1).replace('\\n','\n')
cred=credentials.Certificate({
    'type': 'service_account',
    'project_id': get('FIREBASE_ADMIN_PROJECT_ID'),
    'private_key': get('FIREBASE_ADMIN_PRIVATE_KEY'),
    'client_email': get('FIREBASE_ADMIN_CLIENT_EMAIL'),
    'token_uri': 'https://oauth2.googleapis.com/token'
})
initialize_app(cred)
db=firestore.client()
print([c.id for c in db.collections()])
