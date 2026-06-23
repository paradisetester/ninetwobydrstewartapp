import prisma from "../db.server";
import { generatePatientID } from "../utils/patient.server";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function loader({ request }) {
  // Handle OPTIONS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  return new Response(JSON.stringify({ status: "OK" }), { headers: CORS });
}

export async function action({ request }) {
  // Handle OPTIONS preflight sent to POST route
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS });
    }

    const { shop, customerId, name, email, dob, gender, orderId } = body;

    if (!shop || !name || !dob || !gender) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: shop, name, dob, gender" }),
        { status: 422, headers: CORS }
      );
    }

    const dobDate = new Date(dob);
    if (isNaN(dobDate.getTime())) {
      return new Response(JSON.stringify({ error: "Invalid date format for dob" }), {
        status: 422,
        headers: CORS,
      });
    }

    // Normalise customerId — null if blank so unique constraint behaves consistently
    const normalizedCustomerId = customerId || null;

    let patient = await prisma.patient.findFirst({
      where: {
        shop,
        patientName: name,
        dob: dobDate,
        gender,
      },
    });

    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          shop,
          customerId: normalizedCustomerId,
          patientName: name,
          email: email || null,
          dob: dobDate,
          gender,
          patientIdentifier: await generatePatientID(shop),
        },
      });
    }

    if (orderId) {
      await prisma.providerOrder.create({
        data: {
          shopifyOrderId: String(orderId),
          patientIdentifier: patient.patientIdentifier,
          status: "submitted",
        },
      });
    }

    return new Response(JSON.stringify({ patientId: patient.patientIdentifier }), {
      headers: CORS,
    });
  } catch (err) {
    console.error("[api.patient] error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: err.message }),
      { status: 500, headers: CORS }
    );
  }
}
