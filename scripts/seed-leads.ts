#!/usr/bin/env tsx
import "dotenv/config";
import { PrismaClient, LeadStatus, LeadPriority, LeadCategory } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const firstNames = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
  "David", "Sarah", "Emma", "William", "Olivia", "Daniel", "Sophia", "Henry",
  "Ava", "Alexander", "Isabella", "Benjamin", "Mia", "Ethan", "Charlotte", "Lucas",
  "Amelia", "Mason", "Harper", "Logan", "Evelyn", "Owen", "Abigail", "Liam",
  "Emily", "Noah", "Ella", "Jack", "Scarlett", "Aiden", "Grace", "Matthew",
  "Lily", "Jackson", "Chloe", "Sebastian", "Zoey", "Caleb", "Nora", "Ryan",
  "Riley", "Nathan", "Aria", "Samuel", "Luna", "Leo", "Hannah", "Isaac",
  "Ellie", "Gabriel", "Stella", "Anthony", "Aurora", "Dylan", "Penelope", "Julian",
  "Layla", "Luke", "Victoria", "Lincoln", "Madelyn", "Joshua", "Claire", "Adrian",
  "Paisley", "Christian", "Anna", "Hunter", "Caroline", "Connor", "Nova", "Elijah",
  "Genesis", "Aaron", "Savannah", "Thomas", "Aaliyah", "Jeremiah", "Elena", "Nicholas",
];

const lastNames = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Anderson", "Taylor", "Thomas", "Moore", "Jackson", "Lee",
  "Perez", "Thompson", "White", "Harris", "Clark", "Lewis", "Robinson", "Walker",
  "Young", "Allen", "King", "Wright", "Hill", "Scott", "Green", "Baker",
  "Adams", "Nelson", "Carter", "Mitchell", "Perez", "Roberts", "Turner", "Phillips",
  "Campbell", "Parker", "Evans", "Edwards", "Collins", "Stewart", "Sanchez", "Morris",
  "Rogers", "Reed", "Cook", "Morgan", "Bell", "Murphy", "Bailey", "Rivera",
  "Cooper", "Richardson", "Cox", "Howard", "Ward", "Torres", "Peterson", "Gray",
  "Ramirez", "James", "Watson", "Brooks", "Kelly", "Sanders", "Price", "Bennett",
  "Wood", "Barnes", "Ross", "Henderson", "Coleman", "Jenkins", "Perry", "Powell",
  "Long", "Patterson", "Hughes", "Flores", "Washington", "Butler", "Simmons", "Foster",
];

const companies = [
  "Apex Medical Supplies", "HealthFirst Distributors", "MedCore Solutions", "BioVita Pharmaceuticals",
  "CarePoint Hospital Systems", "ProHealth Devices", "VitalSign Monitoring Co.", "MedTech Innovations",
  "Summit Healthcare Partners", "Pinnacle Medical Group", "Global Pharma Trading", "Zenith Health Systems",
  "Evergreen Medical Supplies", "Atlas Diagnostic Labs", "Sterling Health Corp", "Horizon Medical Inc",
  "Crestview Health Solutions", "Pacific Medical Devices", "Alpine Pharma Group", "Redwood Clinical Supplies",
  "Meridian Health Services", "BlueStar Medical", "NovaCure Labs", "SilverLine Healthcare",
  "Golden Gate Pharma", "Everest Medical Systems", "Coastal Health Partners", "PrimeMed Solutions",
  "NexGen Diagnostics", "TrueNorth Medical", "Verde Health Group", "Lighthouse Clinical",
  "Catalyst Medical Innovations", "Bridgewater Health Corp", "ClearPath Diagnostics", "Apex Wellness Labs",
  "Pioneer Medical Trading", "Elevate Health Systems", "Integra Pharma Solutions", "Vanguard Clinical Labs",
  "Skyline Medical Partners", "Anchor Health Services", "Beacon Medical Devices", "Threshold Pharma Inc",
  "Keystone Healthcare", "Fusion Medical Group", "Crestline Health", "Optimal Care Systems",
  "Radiant Medical Supplies", "Vista Health Partners",
];

const cities = [
  "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
  "San Antonio", "San Diego", "Dallas", "Austin", "San Francisco", "Seattle",
  "Denver", "Boston", "Nashville", "Portland", "Las Vegas", "Miami",
  "Atlanta", "Minneapolis", "Tampa", "Detroit", "Charlotte", "Phoenixville",
  "Raleigh", "Salt Lake City", "Pittsburgh", "Cincinnati", "Orlando", "St. Louis",
  "Cleveland", "Kansas City", "Indianapolis", "Columbus", "Milwaukee", "San Jose",
  "Jacksonville", "Memphis", "Baltimore", "Louisville", "Oklahoma City", "Tucson",
  "Sacramento", "Mesa", "Omaha", "Raleigh", "Colorado Springs", "Virginia Beach",
  "Long Beach", "Des Moines",
];

const statesByCity: Record<string, string> = {
  "New York": "New York", "Los Angeles": "California", "Chicago": "Illinois",
  "Houston": "Texas", "Phoenix": "Arizona", "Philadelphia": "Pennsylvania",
  "San Antonio": "Texas", "San Diego": "California", "Dallas": "Texas",
  "Austin": "Texas", "San Francisco": "California", "Seattle": "Washington",
  "Denver": "Colorado", "Boston": "Massachusetts", "Nashville": "Tennessee",
  "Portland": "Oregon", "Las Vegas": "Nevada", "Miami": "Florida",
  "Atlanta": "Georgia", "Minneapolis": "Minnesota", "Tampa": "Florida",
  "Detroit": "Michigan", "Charlotte": "North Carolina", "Phoenixville": "Pennsylvania",
  "Raleigh": "North Carolina", "Salt Lake City": "Utah", "Pittsburgh": "Pennsylvania",
  "Cincinnati": "Ohio", "Orlando": "Florida", "St. Louis": "Missouri",
  "Cleveland": "Ohio", "Kansas City": "Missouri", "Indianapolis": "Indiana",
  "Columbus": "Ohio", "Milwaukee": "Wisconsin", "San Jose": "California",
  "Jacksonville": "Florida", "Memphis": "Tennessee", "Baltimore": "Maryland",
  "Louisville": "Kentucky", "Oklahoma City": "Oklahoma", "Tucson": "Arizona",
  "Sacramento": "California", "Mesa": "Arizona", "Omaha": "Nebraska",
  "Colorado Springs": "Colorado", "Virginia Beach": "Virginia",
  "Long Beach": "California", "Des Moines": "Iowa",
};

const products = [
  "Digital Blood Pressure Monitor", "Pulse Oximeter", "ECG Machine",
  "Portable Ultrasound System", "Defibrillator", "Patient Monitor",
  "Infusion Pump", "Surgical Instruments Set", "Nebulizer",
  "Wheelchair Model X", "Hospital Bed Electric", "Pulse Thermometer",
  "X-Ray Film Processor", "Lab Centrifuge", "Autoclave Sterilizer",
  "Glucose Monitoring Kit", "Stethoscope Pro", "Ventilator Unit",
  "Physiology Monitor", "Dental Unit Chair", "Ophthalmoscope Set",
  "Medical Gloves (Box)", "Surgical Masks (Case)", "IV Cannula Set",
  "Blood Collection Tubes", "Rapid Test Kits", "Sharps Container",
  "Medical Refrigerator", "Anesthesia Machine", "Suction Pump",
  "Oxygen Concentrator", "CPAP Device", "Hearing Aid Module",
  "Endoscope Camera", "C-Arm Fluoroscopy", "TENS Unit",
  "Phototherapy Unit", "Incubator Neonatal", "Fetal Doppler",
  "Bone Density Scanner", "Spirometer", "Digital Scale Medical",
  "Examination Light LED", "Medical Trolley Cart", "Physiotherapy Ultrasound",
  "Laser Therapy Device", "Microscope Clinical", "Autoclave Portable",
  "Defibrillator Pads", "Electrosurgical Unit",
];

const requirements = [
  "Looking for pricing and availability for 50 units of this product for our hospital network.",
  "Interested in a recurring supply agreement for the next 12 months with bulk discount options.",
  "Needs a quotation and delivery timeline for our new clinic opening next quarter.",
  "Requesting product demo and technical specifications before making a purchase decision.",
  "Seeking a reliable supplier for ongoing medical equipment maintenance and service contracts.",
  "Want to compare pricing across multiple vendors for our annual procurement cycle.",
  "Looking for FDA-approved devices with warranty coverage for at least 3 years.",
  "Interested in lease-to-own options for high-value diagnostic equipment.",
  "Need emergency supply of PPE and consumables for our urgent care facility.",
  "Exploring options for equipping a new 100-bed hospital wing with monitoring systems.",
  "Looking for training and onboarding support along with the equipment purchase.",
  "Need a customized solution for our rural health clinic with limited power supply.",
  "Interested in portable devices for our mobile health screening program.",
  "Seeking volume discounts for distributing to our network of 25 pharmacies.",
  "Need equipment that integrates with our existing electronic health records system.",
  "Looking for refurbished equipment with certified quality assurance.",
  "Want to set up a trial period before committing to a large order.",
  "Interested in exclusive distribution rights for our state territory.",
  "Need equipment serviced and calibrated on a quarterly basis.",
  "Looking for pediatric-specific medical devices for our children's hospital.",
  "Requesting compliance documentation for JCI accreditation requirements.",
  "Need a complete laboratory setup including reagents and consumables.",
  "Looking for telemedicine equipment to expand our remote consultation services.",
  "Interested in AI-powered diagnostic tools for radiology department.",
  "Want to discuss partnership opportunities for medical device manufacturing.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateEmail(firstName: string, lastName: string, salt: number): string {
  const rand = Math.random().toString(36).substring(2, 6);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}-${salt}-${rand}@example.com`;
}

function generatePhone(): string {
  const area = Math.floor(Math.random() * 800) + 200;
  const mid = Math.floor(Math.random() * 900) + 100;
  const end = Math.floor(Math.random() * 9000) + 1000;
  return `+1-${area}-${mid}-${end}`;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("ERROR: Refusing to run in production environment.");
    process.exit(1);
  }

  const [salesUsers, leadSources] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SALES", active: true, isDeleted: false },
      select: { id: true, name: true },
    }),
    prisma.leadSource.findMany({
      where: { active: true },
      select: { id: true, name: true },
    }),
  ]);

  if (salesUsers.length === 0) {
    console.warn("WARNING: No active SALES users found. Leads will be created unassigned.");
  }
  if (leadSources.length === 0) {
    console.warn("WARNING: No active LeadSource records found. Leads will be created without a source.");
  }

  const statusPool: LeadStatus[] = [
    "NEW", "NEW", "NEW", "NEW", "NEW",
    "ON_HOLD", "ON_HOLD", "ON_HOLD",
    "CONVERTED", "CONVERTED",
    "LOST", "LOST",
    "SPAM",
  ];

  const priorityPool: LeadPriority[] = [
    "LOW", "LOW", "LOW",
    "MEDIUM", "MEDIUM", "MEDIUM", "MEDIUM",
    "HIGH", "HIGH", "HIGH",
    "URGENT",
  ];

  const categoryPool: LeadCategory[] = [
    "HOSPITAL", "CLINIC", "PHARMACY", "LABORATORY", "DOCTOR",
    "DISTRIBUTOR", "WHOLESALER", "RETAILER", "MANUFACTURER",
    "MEDICAL_REPRESENTATIVE", "CORPORATE", "BUSINESS", "MARKETING",
    "FRANCHISE", "GOVERNMENT", "THIRD_PARTY", "OTHER",
  ];

  const leadsCreated: Array<{
    name: string;
    company: string;
    email: string;
    status: string;
    priority: string;
    category: string;
    source: string;
    city: string;
    state: string;
    assignedSalesperson: string;
  }> = [];
  const errors: Array<{ index: number; error: string }> = [];

  const timestamp = Date.now();

  for (let i = 0; i < 25; i++) {
    const firstName = pick(firstNames);
    const lastName = pick(lastNames);
    const name = `${firstName} ${lastName}`;
    const company = pick(companies);
    const email = generateEmail(firstName, lastName, timestamp + i);
    const phone = generatePhone();
    const city = pick(cities);
    const state = statesByCity[city] ?? "California";
    const product = pick(products);
    const requirement = pick(requirements);
    const status = pick(statusPool);
    const priority = pick(priorityPool);
    const category = pick(categoryPool);

    let assignedUserId: string | null = null;
    let assignedSalesperson = "Unassigned";
    if (salesUsers.length > 0) {
      const user = pick(salesUsers);
      assignedUserId = user.id;
      assignedSalesperson = user.name;
    }

    let sourceId: string | null = null;
    let sourceName = "None";
    if (leadSources.length > 0) {
      const source = pick(leadSources);
      sourceId = source.id;
      sourceName = source.name;
    }

    try {
      await prisma.lead.create({
        data: {
          displayName: name,
          company,
          email,
          phone,
          city,
          state,
          product,
          requirement,
          status,
          priority,
          category,
          sourceId,
          assignedUserId,
        },
      });

      leadsCreated.push({
        name,
        company,
        email,
        status,
        priority,
        category,
        source: sourceName,
        city,
        state,
        assignedSalesperson,
      });
    } catch (error) {
      errors.push({
        index: i + 1,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(`Created ${leadsCreated.length} test leads.\n`);
  for (let i = 0; i < leadsCreated.length; i++) {
    const l = leadsCreated[i];
    console.log(
      `${i + 1}. ${l.name} — ${l.company} — ${l.status} — ${l.priority} — ${l.category} — ${l.source} — ${l.city}/${l.state} — ${l.assignedSalesperson}`,
    );
  }

  console.log(`\nSuccessfully created: ${leadsCreated.length}`);
  console.log(`Failed: ${errors.length}`);

  if (errors.length > 0) {
    console.error("\nErrors:");
    for (const err of errors) {
      console.error(`  Lead ${err.index}: ${err.error}`);
    }
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("Error creating leads:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });