// Section 7 RESTORE: full state restore via the app's own portability
// machinery, then the battery user goes away.
import { EMAIL, check, type Ctx } from "./harness";

// ================= 7. RESTORE =================
export async function restoreSnapshot(c: Ctx) {
  console.log("\n--- restore ---");
  const before = c.before;
  const { planImport, commitImport } = await import("@/lib/portable");
  const plan = planImport({ format: "rah.v1", exportedAt: before.bundle.exportedAt, tables: before.bundle.tables });
  check(plan.valid === true, "restore plan accepted", JSON.stringify(plan).slice(0, 150));
  await commitImport(before.bundle.tables);
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
  console.log("restore done (bundle + battery user removed)");
}
