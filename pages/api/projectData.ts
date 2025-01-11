// pages/api/projectData.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { initializeUserApis, initializeServiceAccountApis } from '../../lib/googleApi';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getSession({ req });
  if (!session?.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { fileId, values } = req.body;
  if (!fileId || !values) {
    return res.status(400).json({ error: 'Missing fileId or values' });
  }

  try {
    // 1) Check if user can see the file
    const { drive } = initializeUserApis(session.accessToken);
    await drive.files.get({ fileId, fields: 'id' });
    // If the user has no permission, this should 404 or 403.

    // 2) Perform the write with the service account
    const { sheets } = initializeServiceAccountApis();
    await sheets.spreadsheets.values.append({
      spreadsheetId: fileId,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values, // e.g. [ ["col1", "col2"], ["data1", "data2"] ]
      },
    });

    res.status(200).json({ message: 'Data appended successfully' });
  } catch (error: any) {
    console.error('Error writing data:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
