import { data } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const PAGE_SIZE = 50;
const SORT_FIELDS = ["createdAt", "shopifyOrderId", "patientIdentifier", "status"];
const SORT_DIRS   = ["desc", "asc"];

const STATUS_COLOR = {
  submitted: "#008060",
  pending:   "#b98900",
  completed: "#008060",
  failed:    "#d72c0d",
};

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const page    = Math.max(1, Number(url.searchParams.get("page") || 1));
  const search  = url.searchParams.get("search") || "";
  const status  = url.searchParams.get("status") || "";
  const sortBy  = SORT_FIELDS.includes(url.searchParams.get("sortBy")) ? url.searchParams.get("sortBy") : "createdAt";
  const sortDir = SORT_DIRS.includes(url.searchParams.get("sortDir")) ? url.searchParams.get("sortDir") : "desc";

  const shopPatients = await prisma.patient.findMany({
    where: { shop: session.shop },
    select: { patientIdentifier: true, patientName: true },
  });
  const identifiers = shopPatients.map((p) => p.patientIdentifier);
  const nameMap = Object.fromEntries(shopPatients.map((p) => [p.patientIdentifier, p.patientName]));

  const where = {
    patientIdentifier: { in: identifiers },
    ...(status ? { status } : {}),
    ...(search ? {
      OR: [
        { shopifyOrderId:    { contains: search } },
        { patientIdentifier: { contains: search } },
        { providerOrderId:   { contains: search } },
        { status:            { contains: search } },
      ],
    } : {}),
  };

  const [total, logs] = await Promise.all([
    prisma.providerOrder.count({ where }),
    prisma.providerOrder.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return data({
    total, page, sortBy, sortDir, search, status,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    logs: logs.map((l) => ({
      ...l,
      patientName: nameMap[l.patientIdentifier] || "—",
      createdAt: l.createdAt.toISOString().replace("T", " ").split(".")[0],
    })),
  });
}

const th = { textAlign: "left", padding: "8px 12px", borderBottom: "2px solid #ddd", fontSize: "11px", color: "#6d7175", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" };
const td = { padding: "10px 12px", borderBottom: "1px solid #f1f2f3", fontSize: "13px" };

export default function Logs() {
  const { total, logs, page, totalPages, sortBy, sortDir, search, status } = useLoaderData();
  const navigate = useNavigate();

  function buildUrl(overrides) {
    const params = new URLSearchParams({ page, search, sortBy, sortDir, status, ...overrides });
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
    { label: "Order ID",          field: "shopifyOrderId" },
    { label: "Patient ID",        field: "patientIdentifier" },
    { label: "Patient Name",      field: null },
    { label: "Provider Order ID", field: null },
    { label: "Status",            field: "status" },
    { label: "Date",              field: "createdAt" },
  ];

  return (
    <s-page heading="Submission Logs">
      <s-section heading={`${total} submission${total !== 1 ? "s" : ""}`}>

        {/* Filters */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="search"
            placeholder="Search order ID, patient ID, status…"
            defaultValue={search}
            onChange={(e) => {
              clearTimeout(window._logsSearchTimer);
              window._logsSearchTimer = setTimeout(() => {
                navigate(buildUrl({ search: e.target.value, page: 1 }));
              }, 350);
            }}
            style={{ flex: "1", minWidth: "220px", padding: "8px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
          />
          <select
            value={status}
            onChange={(e) => navigate(buildUrl({ status: e.target.value, page: 1 }))}
            style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
          >
            <option value="">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={`${sortBy}:${sortDir}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split(":");
              navigate(buildUrl({ sortBy: field, sortDir: dir, page: 1 }));
            }}
            style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px" }}
          >
            <option value="createdAt:desc">Date: Newest first</option>
            <option value="createdAt:asc">Date: Oldest first</option>
            <option value="shopifyOrderId:asc">Order ID: Ascending</option>
            <option value="shopifyOrderId:desc">Order ID: Descending</option>
            <option value="status:asc">Status: A → Z</option>
            <option value="status:desc">Status: Z → A</option>
          </select>
          {(search || status) && (
            <a href={buildUrl({ search: "", status: "", page: 1 })} style={{ fontSize: "13px", color: "#d72c0d", textDecoration: "none" }}>
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
              {logs.map((l) => (
                <tr key={l.id} style={{ background: "#fff" }}>
                  <td style={{ ...td, fontFamily: "monospace" }}>{l.shopifyOrderId}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{l.patientIdentifier}</td>
                  <td style={td}>{l.patientName}</td>
                  <td style={{ ...td, fontFamily: "monospace", color: "#6d7175" }}>{l.providerOrderId || "—"}</td>
                  <td style={td}>
                    <span style={{
                      background: (STATUS_COLOR[l.status] || "#888") + "18",
                      color: STATUS_COLOR[l.status] || "#1a1a1a",
                      padding: "2px 8px", borderRadius: "20px",
                      fontSize: "12px", fontWeight: 600, textTransform: "capitalize",
                    }}>
                      {l.status}
                    </span>
                  </td>
                  <td style={{ ...td, color: "#6d7175", whiteSpace: "nowrap" }}>{l.createdAt}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#6d7175" }}>
                  {search || status ? "No submissions match your filters" : "No submissions yet"}
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
