// pages/api/sheets.js

import { google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Handling request for sheets API');
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  async function fetchProjectOverviews() {
    console.log('Fetching Project Overviews');
    const files = await drive.files.list({
      q: "name contains 'Project Overview' and mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id, name)'
    });

    let overviews = files.data.files.map(file => {
      const [year, companyId] = file.name.match(/^(\d{4})\s(.*)\sProject\sOverview$/).slice(1);
      return { id: file.id, year, companyId };
    });

    console.log('Searching for PMS Reference Log');
    const referenceLog = await drive.files.list({
      q: "name = 'PMS Reference Log' and mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id)'
    });

    if (referenceLog.data.files.length === 0) {
      console.error("PMS Reference Log not found");
      throw new Error("PMS Reference Log not found");
    }

    const referenceLogId = referenceLog.data.files[0].id;

    console.log('Fetching company names from reference log');
    const referenceSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: referenceLogId,
      range: 'Reference of Subsidiary Names!A2:B'
    });
    const companies = referenceSheet.data.values.reduce((acc, row) => {
      acc[row[0]] = row[1];
      return acc;
    }, {});

    console.log('Creating project overviews by year');
    return overviews.reduce((acc, overview) => {
      if (!acc[overview.year]) acc[overview.year] = [];
      acc[overview.year].push({
        id: overview.id,
        name: companies[overview.companyId] || overview.companyId
      });
      return acc;
    }, {});
  }

  try {
    const projectOverviews = await fetchProjectOverviews();
    console.log('Sending project overviews response');
    res.status(200).json(projectOverviews);
  } catch (error) {
    console.error('Error in fetchProjectOverviews:', error);
    res.status(500).json({ error: error.message });
  }
}
