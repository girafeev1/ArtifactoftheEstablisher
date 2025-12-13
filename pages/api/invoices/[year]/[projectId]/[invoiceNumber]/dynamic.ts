import type { NextApiRequest, NextApiResponse } from "next";
import { fetchInvoicesForProject } from "../../../../../../lib/projectInvoices";
import { paginateInvoice } from "../../../../../../lib/invoiceTemplates/paginationEngine";
import { composeInvoice } from "../../../../../../lib/invoiceTemplates/layoutComposer";

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
      // Use the new pagination engine
      const paginationResult = paginateInvoice(invoice.items);

      // Compose the full layout
      const composedLayout = composeInvoice(
        paginationResult.pages,
        invoice.items.length,
        paginationResult.layoutMode
      );

      res.status(200).json({
        invoice,
        composedLayout,
        paginationResult: {
          totalPages: paginationResult.totalPages,
          itemDistribution: paginationResult.itemDistribution,
          layoutMode: paginationResult.layoutMode,
        },
      });
    } else {
      res.status(404).json({ error: "Invoice not found" });
    }
  } catch (error) {
    console.error("Dynamic invoice generation error:", error);
    res.status(500).json({
      error: "Failed to generate dynamic invoice",
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
