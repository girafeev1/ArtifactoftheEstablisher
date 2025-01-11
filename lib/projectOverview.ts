// lib/projectOverview.ts

import { drive_v3 } from 'googleapis';

/**
 * Lists all spreadsheet files containing "Project Overview" in name.
 * Then organizes them by { [yearOrCode]: [...] }.
 */
export async function listProjectOverviewFiles(
  drive: drive_v3.Drive,
  subsidiaryData: any[] = []
): Promise<Record<string, any[]>> {
  try {
    const response = await drive.files.list({
      q: "name contains 'Project Overview' and mimeType = 'application/vnd.google-apps.spreadsheet'",
      fields: 'files(id, name)',
      pageSize: 100,
      corpora: 'allDrives',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    const files = response.data.files || [];
    if (!files.length) {
      console.log('No Project Overview files found.');
      return {};
    }

    const projectsByCategory: Record<string, any[]> = {};

    // Example pattern: "2024 ERL Project Overview"
    // We'll assume "YYYY <Abbreviation> Project Overview"
    files.forEach((file) => {
      const fileName = file.name || '';
      const match = fileName.match(/^([A-Za-z0-9]{4})\s+(\S+)\s+Project Overview\s*$/i);
      if (match) {
        const [_, year, companyId] = match;
        if (!projectsByCategory[year]) projectsByCategory[year] = [];

        // Attempt to map abbreviation -> fullName
        const mapping = subsidiaryData.find(
          (row: any) => row.categoryIdentifier === companyId
        );

        projectsByCategory[year].push({
          companyIdentifier: companyId,
          fullCompanyName: mapping ? mapping.fullCompanyName : companyId,
          file,
        });
      } else {
        console.warn(
          `File "${fileName}" doesn't match "YYYY <Abbrev> Project Overview" pattern. Skipping.`
        );
      }
    });

    return projectsByCategory;
  } catch (error) {
    console.error('Error listing Project Overview files:', error);
    throw error;
  }
}
