import type { NextApiRequest, NextApiResponse } from "next";
import { fetchInvoicesForProject } from "../../../../../lib/projectInvoices";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { year, projectId, invoiceNumber } = req.query;

  if (typeof year !== "string" || typeof projectId !== "string" || typeof invoiceNumber !== "string") {
    return res.status(400).json({ error: "Invalid parameters" });
  }

  try {
    const invoices = await fetchInvoicesForProject(year, projectId);
    const invoice = invoices.find(inv => inv.invoiceNumber === invoiceNumber);

    if (invoice) {
      res.status(200).json({ invoice });
    } else {
      res.status(404).json({ error: "Invoice not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch invoice" });
  }
}
