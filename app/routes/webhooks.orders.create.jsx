import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }) {
  const { topic, shop, payload } = await authenticate.webhook(request);

  if (topic !== "ORDERS_CREATE") return new Response();

  const orderId = String(payload.id);

  // Collect all "Testee N Patient ID" properties across all line items
  const patientIds = new Set();

  for (const lineItem of payload.line_items || []) {
    for (const prop of lineItem.properties || []) {
      if (/^Testee \d+ Patient ID$/i.test(prop.name) && prop.value) {
        patientIds.add(prop.value.trim());
      }
    }
  }

  if (patientIds.size === 0) return new Response();

  // Create a ProviderOrder log for each patient found in this order
  await prisma.providerOrder.createMany({
    data: Array.from(patientIds).map((patientIdentifier) => ({
      shopifyOrderId:   orderId,
      patientIdentifier,
      status:           "submitted",
    })),
    skipDuplicates: true,
  });

  console.log(`[orders/create] order ${orderId} — logged ${patientIds.size} patient(s):`, [...patientIds]);

  return new Response();
}
