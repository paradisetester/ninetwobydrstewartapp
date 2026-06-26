import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shopPatients = await prisma.patient.findMany({
    where: { shop: session.shop },
    select: { patientIdentifier: true },
  });
  const identifiers = shopPatients.map((p) => p.patientIdentifier);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalPatients, todayPatients, totalSubmissions, pendingSubmissions, recentPatients] =
    await Promise.all([
      prisma.patient.count({ where: { shop: session.shop } }),
      prisma.patient.count({ where: { shop: session.shop, createdAt: { gte: today } } }),
      prisma.providerOrder.count({ where: { shop: session.shop } }),
      prisma.providerOrder.count({
        where: { shop: session.shop, status: "pending" },
      }),
      prisma.patient.findMany({
        where: { shop: session.shop },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { patientIdentifier: true, patientName: true, gender: true, createdAt: true },
      }),
    ]);

  return {
    totalPatients,
    todayPatients,
    totalSubmissions,
    pendingSubmissions,
    recentPatients: recentPatients.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString().split("T")[0],
    })),
  };
};

export default function Index() {
  const { totalPatients, todayPatients, totalSubmissions, pendingSubmissions, recentPatients } =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="Testee Information">
      {/* Description */}
      <s-section heading="About This App">
        <s-paragraph>
          Testee Information automatically assigns a unique patient identifier to every customer
          at checkout. It syncs patient records, tracks lab order submissions, and gives you a
          central place to manage patient data, monitor submission status, and configure your
          identifier series — all without leaving Shopify.
        </s-paragraph>
        <s-stack direction="inline" gap="base" style={{ marginTop: "12px" }}>
          <s-button variant="primary" href="/app/patients">View Patients</s-button>
          <s-button href="/app/logs">View Logs</s-button>

        </s-stack>
      </s-section>

      {/* Stats */}
      <s-section heading="Overview">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px",
          }}
        >
          {[
            { label: "Total Patients", value: totalPatients, color: "#008060" },
            { label: "Registered Today", value: todayPatients, color: "#1a1a1a" },
            { label: "Total Submissions", value: totalSubmissions, color: "#2c6ecb" },
            { label: "Pending Submissions", value: pendingSubmissions, color: "#b98900" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                background: "#fff",
                border: "1px solid #e1e3e5",
                borderRadius: "12px",
                padding: "20px 24px",
                borderTop: `4px solid ${color}`,
              }}
            >
              <div style={{ fontSize: "32px", fontWeight: 700, color, lineHeight: 1 }}>
                {value}
              </div>
              <div style={{ fontSize: "13px", color: "#6d7175", marginTop: "6px" }}>{label}</div>
            </div>
          ))}
        </div>
      </s-section>

      {/* Recent Patients */}
      <s-section heading="Recently Registered Patients">
        {recentPatients.length === 0 ? (
          <s-paragraph>No patients registered yet.</s-paragraph>
        ) : (
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Patient ID", "Name", "Gender", "Registered"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "8px 12px",
                        borderBottom: "1px solid #ddd",
                        fontSize: "12px",
                        color: "#6d7175",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentPatients.map((p) => (
                  <tr key={p.patientIdentifier}>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f2f3", fontFamily: "monospace", fontSize: "13px" }}>
                      {p.patientIdentifier}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f2f3" }}>{p.patientName}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f2f3" }}>{p.gender}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f2f3", color: "#6d7175", fontSize: "13px" }}>
                      {p.createdAt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </s-box>
        )}
        <div style={{ marginTop: "12px" }}>
          <s-link href="/app/patients">View all patients →</s-link>
        </div>
      </s-section>

      {/* Quick Actions aside */}
      <s-section slot="aside" heading="Quick Links">
        <s-unordered-list>
          <s-list-item><s-link href="/app/patients">Manage Patients</s-link></s-list-item>
          <s-list-item><s-link href="/app/logs">Submission Logs</s-link></s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="How It Works">
        <s-paragraph>
          <s-text variant="strong">1. Patient Registration</s-text>
        </s-paragraph>
        <s-paragraph>
          When a customer completes checkout, their info is matched or created as a patient record
          with a unique ID.
        </s-paragraph>
        <s-paragraph>
          <s-text variant="strong">2. Order Submission</s-text>
        </s-paragraph>
        <s-paragraph>
          Each order is submitted to your provider API and tracked with a status log.
        </s-paragraph>
        <s-paragraph>
          <s-text variant="strong">3. Configuration</s-text>
        </s-paragraph>
        <s-paragraph>
          Customize your patient ID prefix, digit length, and sequence from the Settings page.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
