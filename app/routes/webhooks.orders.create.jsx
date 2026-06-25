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

  // If no patient IDs found on line items, still log the order using orderId as identifier
  // so it shows up as a lead in the dashboard
  const identifiers = patientIds.size > 0
    ? Array.from(patientIds)
    : [`order-${orderId}`];

  await prisma.providerOrder.createMany({
    data: identifiers.map((patientIdentifier) => ({
      shopifyOrderId:   orderId,
      patientIdentifier,
      status:           "submitted",
      shop,
    })),
    skipDuplicates: true,
  });

  console.log(`[orders/create] shop=${shop} order=${orderId} — logged ${identifiers.length} lead(s):`, identifiers);

  return new Response();
}
