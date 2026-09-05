#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { LeadStatus, LeadPriority, LeadCategory } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: Refusing to run in production environment.');
    console.error('Set NODE_ENV=development or provide --dev-override to force.');
    process.exit(1);
  }

  const salesUsers = await prisma.user.findMany({
    where: { role: 'SALES', active: true, isDeleted: false },
    select: { id: true, name: true },
  });

  const firstNames =
    ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Sarah', 'Emma', 'William'];
  const lastNames =
    ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Taylor', 'Anderson'];
  const companies =
    ['Acme Corp', 'Globex Inc', 'Stark Industries', 'Wayne Enterprises', 'Oscorp', 'Initech', 'Tyrell Corp', 'Umbrella Corp', 'Cyberdyne Systems', 'Soylent', 'Northwestern Mutual', 'Goldman Sachs'];
  const statuses = ['NEW', 'CONVERTED', 'LOST', 'SPAM', 'ON_HOLD'];
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const categories =
    ['MEDICAL_REPRESENTATIVE', 'RETAILER', 'DOCTOR', 'WHOLESALER', 'DISTRIBUTOR', 'MARKETING', 'THIRD_PARTY', 'FRANCHISE', 'BUSINESS', 'HOSPITAL', 'CLINIC', 'PHARMACY', 'LABORATORY', 'MANUFACTURER', 'CORPORATE', 'GOVERNMENT', 'OTHER'];

  const leadsCreated: Array<{ id: string; name: string; company: string; email: string; status: string; assignedSalesperson: string }> = [];
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < 10; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const company = companies[i % companies.length];
    const index = i + 1;

    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@example.com`;

    const phoneSuffix = Math.floor(Math.random() * 9000 + 1000);
    const phone = `+1-555-${phoneSuffix}`;

    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    const category =
      categories[Math.floor(Math.random() * categories.length)];

    let assignedUserId: string | null = null;
    let assignedSalesperson = 'Unassigned';
    if (salesUsers.length > 0) {
      const randomUser = salesUsers[Math.floor(Math.random() * salesUsers.length)];
      assignedUserId = randomUser.id;
      assignedSalesperson = randomUser.name;
    }

    try {
      const lead = await prisma.lead.create({
        data: {
          displayName: `${firstName} ${lastName}`,
          company,
          email,
          phone,
          status: status as LeadStatus,
          priority: priority as LeadPriority,
          category: category as LeadCategory | null,
          assignedUserId,
        },
      });

      leadsCreated.push({
        id: lead.id,
        name: `${firstName} ${lastName}`,
        company,
        email,
        status,
        assignedSalesperson,
      });
    } catch (error) {
      errors.push({ index: i + 1, error: error instanceof Error ? error.message : String(error) });
    }
  }

  console.log('Created 10 test leads.\n');
  for (let i = 0; i < leadsCreated.length; i++) {
    const lead = leadsCreated[i];
    console.log(
      `${i + 1}. ${lead.name} — ${lead.company} — ${lead.email} — ${lead.status} — ${lead.assignedSalesperson}`,
    );
  }

  if (errors.length > 0) {
    console.error('\nErrors:' );
    for (const err of errors) {
      console.error(`  ${err.index}. ${err.error}`);
    }
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Error creating leads:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });