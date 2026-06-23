import { data } from "react-router";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const PAGE_SIZE = 20;
const SORT_FIELDS = ["createdAt", "patientName", "patientIdentifier", "gender", "dob"];
const SORT_DIRS = ["desc", "asc"];

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const page     = Math.max(1, Number(url.searchParams.get("page") || 1));
  const search   = url.searchParams.get("search") || "";
  const sortBy   = SORT_FIELDS.includes(url.searchParams.get("sortBy")) ? url.searchParams.get("sortBy") : "createdAt";
  const sortDir  = SORT_DIRS.includes(url.searchParams.get("sortDir")) ? url.searchParams.get("sortDir") : "desc";

  const where = {
    shop: session.shop,
    ...(search ? {
      OR: [
        { patientName:       { contains: search } },
        { patientIdentifier: { contains: search } },
        { email:             { contains: search } },
        { gender:            { contains: search } },
      ],
    } : {}),
  };

  const [total, patients] = await Promise.all([
    prisma.patient.count({ where }),
    prisma.patient.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { patientIdentifier: true, patientName: true, email: true, gender: true, dob: true, createdAt: true },
    }),
  ]);

  // Fetch latest order per patient in one query
  const identifiers = patients.map((p) => p.patientIdentifier);
  const orders = await prisma.providerOrder.findMany({
    where: { patientIdentifier: { in: identifiers } },
    orderBy: { createdAt: "desc" },
  });

  // Keep only the latest order per patient
  const latestOrder = {};
  for (const o of orders) {
    if (!latestOrder[o.patientIdentifier]) latestOrder[o.patientIdentifier] = o;
  }

  return data({
    total, page, sortBy, sortDir, search,
    shop: session.shop,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    patients: patients.map((p) => {
      const order = latestOrder[p.patientIdentifier] || null;
      return {
        ...p,
        dob: p.dob.toISOString().split("T")[0],
        createdAt: p.createdAt.toISOString().split("T")[0],
        orderId: order?.shopifyOrderId || null,
        orderStatus: order?.status || null,
      };
    }),
  });
}

const th = { textAlign: "left", padding: "8px 12px", borderBottom: "2px solid #ddd", fontSize: "11px", color: "#6d7175", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" };
const td = { padding: "10px 12px", borderBottom: "1px solid #f1f2f3", fontSize: "13px" };

const STATUS_COLOR = {
  submitted: { bg: "#e3f1ec", text: "#008060" },
  pending:   { bg: "#fdf3d0", text: "#b98900" },
  completed: { bg: "#e3f1ec", text: "#008060" },
  failed:    { bg: "#fde8e8", text: "#d72c0d" },
};

export default function Patients() {
  const { total, patients, page, totalPages, sortBy, sortDir, search, shop } = useLoaderData();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  function buildUrl(overrides) {
    const params = new URLSearchParams({ page, search, sortBy, sortDir, ...overrides });
    return "?" + params.toString();
  }

  function toggleSort(field) {
    const newDir = sortBy === field && sortDir === "desc" ? "asc" : "desc";
    navigate(buildUrl({ sortBy: field, sortDir: newDir, page: 1 }));
  }

  function SortIcon({ field }) {
    if (sortBy !== field) return <span style={{ color: "#ccc" }}> ↕</span>;
    return <span style={{ color: "#008060" }}>{sortDir === "desc" ? " ↓" : " ↑"}</span>;
  }

  const columns = [
    { label: "Patient ID", field: "patientIdentifier" },
    { label: "Name",       field: "patientName" },
    { label: "Email",      field: null },
    { label: "Gender",     field: "gender" },
    { label: "DOB",        field: "dob" },
    { label: "Registered", field: "createdAt" },
    { label: "Order",      field: null },
  ];

  return (
    <s-page heading="Patients">
      <s-section heading={`${total} patient${total !== 1 ? "s" : ""}`}>

        {/* Search + sort controls */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="search"
            placeholder="Search name, ID, email, gender…"
            defaultValue={search}
            onChange={(e) => {
              clearTimeout(window._patientSearchTimer);
              window._patientSearchTimer = setTimeout(() => {
                navigate(buildUrl({ search: e.target.value, page: 1 }));
              }, 350);
            }}
            style={{ flex: "1", minWidth: "220px", padding: "8px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
          />
          <select
            value={`${sortBy}:${sortDir}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split(":");
              navigate(buildUrl({ sortBy: field, sortDir: dir, page: 1 }));
            }}
            style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
          >
            <option value="createdAt:desc">Registered: Newest first</option>
            <option value="createdAt:asc">Registered: Oldest first</option>
            <option value="patientName:asc">Name: A → Z</option>
            <option value="patientName:desc">Name: Z → A</option>
            <option value="patientIdentifier:asc">Patient ID: Ascending</option>
            <option value="patientIdentifier:desc">Patient ID: Descending</option>
            <option value="dob:desc">DOB: Newest</option>
            <option value="dob:asc">DOB: Oldest</option>
          </select>
          {search && (
            <a href={buildUrl({ search: "", page: 1 })} style={{ fontSize: "13px", color: "#d72c0d", textDecoration: "none" }}>
              ✕ Clear
            </a>
          )}
        </div>

        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr>
                {columns.map(({ label, field }) => (
                  <th key={label} style={th} onClick={() => field && toggleSort(field)}>
                    {label}{field && <SortIcon field={field} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.patientIdentifier}>
                  <td style={{ ...td, fontFamily: "monospace" }}>{p.patientIdentifier}</td>
                  <td style={td}>{p.patientName}</td>
                  <td style={{ ...td, color: "#6d7175" }}>{p.email || "—"}</td>
                  <td style={td}>{p.gender}</td>
                  <td style={td}>{p.dob}</td>
                  <td style={{ ...td, color: "#6d7175" }}>{p.createdAt}</td>
                  <td style={td}>
                    {p.orderId ? (
                      <a
                        href={`https://${shop}/admin/orders/${p.orderId}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: 600,
                          textDecoration: "none",
                          textTransform: "capitalize",
                          background: (STATUS_COLOR[p.orderStatus]?.bg || "#f1f2f3"),
                          color: (STATUS_COLOR[p.orderStatus]?.text || "#6d7175"),
                        }}
                      >
                        {p.orderStatus || "view"} ↗
                      </a>
                    ) : (
                      <span style={{ color: "#ccc", fontSize: "12px" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
              {patients.length === 0 && (
                <tr><td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#6d7175" }}>
                  {search ? `No patients matching "${search}"` : "No patients found"}
                </td></tr>
              )}
            </tbody>
          </table>
        </s-box>

        {totalPages > 1 && (
          <div style={{ marginTop: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
            {page > 1 && <s-link href={buildUrl({ page: page - 1 })}>← Previous</s-link>}
            <span style={{ color: "#6d7175", fontSize: "13px" }}>Page {page} of {totalPages}</span>
            {page < totalPages && <s-link href={buildUrl({ page: page + 1 })}>Next →</s-link>}
          </div>
        )}
      </s-section>
    </s-page>
  );
}
