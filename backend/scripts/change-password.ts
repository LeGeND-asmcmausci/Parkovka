
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const prisma = new PrismaClient();

const rl = readline.createInterface({ input, output });

async function main() {
  try {
    console.log("\n=== SMART PARKING: PAROLNI O'ZGARTIRISH ===\n");

    const email = await rl.question("Akkaunt emailini kiriting: ");

    const user = await prisma.user.findUnique({
      where: { email: email.trim() },
    });

    if (!user) {
      console.log("Bunday email bilan akkaunt topilmadi.");
      return;
    }

    console.log(`\nAkkaunt: ${user.name ?? user.email}`);
    console.log(`Rol: ${user.role}`);

    const newPassword = await rl.question("\nYangi parol: ");
    const confirmPassword = await rl.question("Parolni qayta kiriting: ");

    if (newPassword.length < 8) {
      console.log("Parol kamida 8 ta belgidan iborat bo'lishi kerak.");
      return;
    }

    if (newPassword !== confirmPassword) {
      console.log("Parollar mos kelmadi!");
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),

      prisma.refreshToken.updateMany({
        where: { userId: user.id, revoked: false },
        data: {
          revoked: true,
          revokedAt: new Date(),
        },
      }),
    ]);

    console.log("\nParol muvaffaqiyatli o'zgartirildi!");
    console.log("Eski refresh tokenlar bekor qilindi.");
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error("Xatolik:", error.message);
  await prisma.$disconnect();
  process.exitCode = 1;
});
