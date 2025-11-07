import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MOCK_ASSETS = [
  {
    externalId: 'mock-asset-1',
    name: 'Product Intro Reel',
    durationSec: 95,
    checksum: 'mock-sha1-product-intro',
  },
  {
    externalId: 'mock-asset-2',
    name: 'Founder Interview',
    durationSec: 210,
    checksum: 'mock-sha1-founder-interview',
  },
  {
    externalId: 'mock-asset-3',
    name: 'Testimonials Montage',
    durationSec: 145,
    checksum: 'mock-sha1-testimonials',
  },
  {
    externalId: 'mock-asset-4',
    name: 'Event Highlights',
    durationSec: 180,
    checksum: 'mock-sha1-event-highlights',
  },
  {
    externalId: 'mock-asset-5',
    name: 'Product Closeups',
    durationSec: 120,
    checksum: 'mock-sha1-product-closeups',
  },
];

export async function GET() {
  return NextResponse.json({ assets: MOCK_ASSETS });
}

