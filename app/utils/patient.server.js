import prisma from "../db.server";

export async function generatePatientID(shop) {
  // Ensure settings row exists
  await prisma.appSetting.upsert({
    where: { shop },
    update: {},
    create: { shop },
  });

  // Atomically increment and return new value
  const settings = await prisma.appSetting.update({
    where: { shop },
    data: { patientIdSequence: { increment: 1 } },
    select: {
      patientIdPrefix: true,
      patientIdDigits: true,
      patientIdSequence: true,
    },
  });

  const seq = settings.patientIdSequence.toString();
  const padded = seq.padStart(settings.patientIdDigits, "0");
  return settings.patientIdPrefix + padded;
}
