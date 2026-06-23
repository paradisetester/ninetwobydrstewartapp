import { data } from "react-router";
import { useLoaderData, useNavigation, Form } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);

  let settings = await prisma.appSetting.findUnique({ where: { shop: session.shop } });

  if (!settings) {
    settings = await prisma.appSetting.create({ data: { shop: session.shop } });
  }

  return data({
    settings: {
      ...settings,
      patientIdSequence: settings.patientIdSequence.toString(),
    },
  });
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  await prisma.appSetting.upsert({
    where: { shop: session.shop },
    update: {
      patientIdPrefix: formData.get("patientIdPrefix"),
      patientIdDigits: Number(formData.get("patientIdDigits")),
      patientIdSequence: BigInt(formData.get("patientIdSequence")),
      apiEndpoint: formData.get("apiEndpoint"),
    },
    create: {
      shop: session.shop,
      patientIdPrefix: formData.get("patientIdPrefix"),
      patientIdDigits: Number(formData.get("patientIdDigits")),
      patientIdSequence: BigInt(formData.get("patientIdSequence")),
      apiEndpoint: formData.get("apiEndpoint"),
    },
  });

  return data({ success: true });
}

export default function Settings() {
  const { settings } = useLoaderData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <s-page heading="Settings">
      <s-section heading="Patient ID Configuration">
        <Form method="post">
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Patient ID Prefix"
              name="patientIdPrefix"
              defaultValue={settings.patientIdPrefix}
              autoComplete="off"
            />
            <s-text-field
              label="Patient ID Digits"
              name="patientIdDigits"
              type="number"
              defaultValue={String(settings.patientIdDigits)}
              autoComplete="off"
            />
            <s-text-field
              label="Starting Sequence"
              name="patientIdSequence"
              defaultValue={settings.patientIdSequence}
              autoComplete="off"
            />
            <s-text-field
              label="Provider API Endpoint"
              name="apiEndpoint"
              defaultValue={settings.apiEndpoint || ""}
              autoComplete="off"
            />
            <s-button
              variant="primary"
              submit
              {...(isSubmitting ? { loading: true } : {})}
            >
              Save Settings
            </s-button>
          </s-stack>
        </Form>
      </s-section>
    </s-page>
  );
}
