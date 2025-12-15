import type { NextApiRequest, NextApiResponse } from "next";
import { fetchInvoicesForProject } from "../../../../../../lib/projectInvoices";
import { paginateInvoice } from "../../../../../../lib/invoiceTemplates/paginationEngine";
import { composeInvoicePackage, type InvoiceVariant } from "../../../../../../lib/invoiceTemplates/layoutComposer";

const VALID_VARIANTS: InvoiceVariant[] = ['B', 'B2', 'A', 'A2', 'bundle'];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { year, projectId, invoiceNumber, variant } = req.query;

  if (typeof year !== "string" || typeof projectId !== "string" || typeof invoiceNumber !== "string") {
    return res.status(400).json({ error: "Invalid parameters" });
  }

  // Parse variant parameter (default to 'bundle' for full invoice package)
  let invoiceVariant: InvoiceVariant = 'bundle';
  if (typeof variant === 'string' && VALID_VARIANTS.includes(variant as InvoiceVariant)) {
    invoiceVariant = variant as InvoiceVariant;
  }

  try {
    const invoices = await fetchInvoicesForProject(year, projectId);
    const invoice = invoices.find(inv => inv.invoiceNumber === invoiceNumber);

    if (invoice) {
      // Use the new pagination engine
      const paginationResult = paginateInvoice(invoice.items);

      // Compose the full invoice package with additional pages based on variant
      const composedLayout = composeInvoicePackage(
        paginationResult.pages,
        invoice.items.length,
        paginationResult.layoutMode,
        invoiceVariant
      );

      res.status(200).json({
        invoice,
        composedLayout,
        paginationResult: {
          totalPages: paginationResult.totalPages,
          itemDistribution: paginationResult.itemDistribution,
          layoutMode: paginationResult.layoutMode,
        },
        variant: invoiceVariant,
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
