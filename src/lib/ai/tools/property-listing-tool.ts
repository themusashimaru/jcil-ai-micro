/**
 * PROPERTY LISTING TOOL — MLS-quality real estate property listing generator.
 * Produces professional listings with property details, features, schools,
 * neighborhood info, and agent contact information.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type PropertyType = 'single_family' | 'condo' | 'townhouse' | 'multi_family' | 'land' | 'commercial';
type ListingStatus = 'active' | 'pending' | 'sold';

interface School {
  name: string;
  distance: string;
  rating?: string;
}

const PROPERTY_LABELS: Record<PropertyType, string> = {
  single_family: 'Single Family Home',
  condo: 'Condominium',
  townhouse: 'Townhouse',
  multi_family: 'Multi-Family',
  land: 'Land / Lot',
  commercial: 'Commercial Property',
};

const STATUS_LABELS: Record<ListingStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  sold: 'Sold',
};

// ============================================================================
// HELPERS
// ============================================================================

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  address: string, price: string, propType: PropertyType, beds: number,
  baths: number, sqft: number, description: string, yearBuilt: number | undefined,
  lotSize: string, parking: string, features: string[], amenities: string[],
  schools: School[], neighborhood: string, hoaFee: string, taxes: string,
  mlsNumber: string, agentName: string, agentPhone: string, agentEmail: string,
  openHouse: string, virtualTourUrl: string, status: ListingStatus,
): string {
  const L: string[] = [];
  L.push(`# ${address}`, '', `**${price}** | ${PROPERTY_LABELS[propType]} | ${STATUS_LABELS[status]}`, '');

  L.push('## Property Details', '', '| Detail | Value |', '|--------|-------|');
  L.push(`| Bedrooms | ${beds} |`, `| Bathrooms | ${baths} |`, `| Square Feet | ${fmtNum(sqft)} |`);
  if (yearBuilt) L.push(`| Year Built | ${yearBuilt} |`);
  if (lotSize) L.push(`| Lot Size | ${lotSize} |`);
  if (parking) L.push(`| Parking | ${parking} |`);
  if (hoaFee) L.push(`| HOA Fee | ${hoaFee} |`);
  if (taxes) L.push(`| Annual Taxes | ${taxes} |`);
  if (mlsNumber) L.push(`| MLS # | ${mlsNumber} |`);
  L.push('');

  if (description) L.push('## Description', '', description, '');

  if (features.length > 0) {
    L.push('## Features', '');
    for (const f of features) L.push(`- ${f}`);
    L.push('');
  }

  if (amenities.length > 0) {
    L.push('## Amenities', '');
    for (const a of amenities) L.push(`- ${a}`);
    L.push('');
  }

  if (neighborhood) L.push('## Neighborhood', '', neighborhood, '');

  if (schools.length > 0) {
    L.push('## Nearby Schools', '', '| School | Distance | Rating |', '|--------|----------|--------|');
    for (const s of schools) L.push(`| ${s.name} | ${s.distance} | ${s.rating ?? 'N/A'} |`);
    L.push('');
  }

  if (agentName || agentPhone || agentEmail) {
    L.push('## Contact Agent', '');
    if (agentName) L.push(`**Agent:** ${agentName}`);
    if (agentPhone) L.push(`**Phone:** ${agentPhone}`);
    if (agentEmail) L.push(`**Email:** ${agentEmail}`);
    L.push('');
  }

  if (openHouse) L.push(`**Open House:** ${openHouse}`, '');
  if (virtualTourUrl) L.push(`**Virtual Tour:** [View Tour](${virtualTourUrl})`, '');

  return L.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#e0e0e0;background:#121225}',
  'h1{color:#c0c8e0;margin-bottom:4px}',
  '.price-bar{font-size:1.6em;font-weight:700;color:#6ab04c;margin-bottom:4px}',
  '.status{display:inline-block;padding:4px 12px;border-radius:12px;font-size:.85em;font-weight:600}',
  '.status-active{background:#1e5631;color:#6ab04c}.status-pending{background:#5a4a10;color:#e8d080}',
  '.status-sold{background:#5a1a1a;color:#e08080}',
  '.type-label{color:#8090b0;font-size:.95em;margin-left:8px}',
  'h2{color:#a0b0d0;margin-top:28px;border-bottom:1px solid #2a2a4e;padding-bottom:6px}',
  '.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:16px 0}',
  '.stat{background:#1a1a2e;padding:14px;border-radius:8px;text-align:center}',
  '.stat-val{font-size:1.3em;font-weight:700;color:#c0c8e0}.stat-lbl{font-size:.8em;color:#8090b0;margin-top:2px}',
  'table{width:100%;border-collapse:collapse;margin:12px 0}',
  'th,td{border:1px solid #2a2a4e;padding:8px 12px;text-align:left}',
  'th{background:#1a1a2e;color:#c0c8e0}tr:nth-child(even){background:#16162a}',
  '.features{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;list-style:none;padding:0;margin:12px 0}',
  '.features li{padding:4px 0;color:#b0b8d0}.features li::before{content:"\\2713 ";color:#6ab04c;font-weight:700}',
  '.neighborhood{background:#16162a;padding:16px 20px;border-radius:8px;border-left:3px solid #4a5a8a;color:#b0b8d0;line-height:1.6}',
  '.agent-card{background:#1a1a2e;padding:20px;border-radius:8px;margin-top:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}',
  '.agent-info{color:#c0c8e0}.agent-info div{margin:4px 0}.agent-label{color:#8090b0;font-weight:600}',
  '.cta{display:inline-block;background:#4a5a8a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:1em}',
  '.cta:hover{background:#5a6a9a}',
  'p{color:#b0b8d0;line-height:1.6}',
  '.school-rating{display:inline-block;background:#1a1a2e;padding:2px 8px;border-radius:4px;font-weight:600;color:#6ab04c}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}h2{color:#2a2a4e}',
  '.stat,.agent-card,.neighborhood{background:#f5f5fa;border-color:#ccc}th{background:#1a1a2e;color:#fff}}',
].join('');

function formatHtml(
  address: string, price: string, propType: PropertyType, beds: number,
  baths: number, sqft: number, description: string, yearBuilt: number | undefined,
  lotSize: string, parking: string, features: string[], amenities: string[],
  schools: School[], neighborhood: string, hoaFee: string, taxes: string,
  mlsNumber: string, agentName: string, agentPhone: string, agentEmail: string,
  openHouse: string, virtualTourUrl: string, status: ListingStatus,
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(address)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);

  const statusClass = `status-${status}`;
  h.push(`<h1>${esc(address)}</h1>`);
  h.push(`<div class="price-bar">${esc(price)} <span class="status ${statusClass}">${STATUS_LABELS[status]}</span><span class="type-label">${PROPERTY_LABELS[propType]}</span></div>`);
  if (mlsNumber) h.push(`<div style="color:#8090b0;font-size:.85em;margin-bottom:16px">MLS# ${esc(mlsNumber)}</div>`);

  // Stats grid
  h.push('<div class="stats">');
  h.push(`<div class="stat"><div class="stat-val">${beds}</div><div class="stat-lbl">Bedrooms</div></div>`);
  h.push(`<div class="stat"><div class="stat-val">${baths}</div><div class="stat-lbl">Bathrooms</div></div>`);
  h.push(`<div class="stat"><div class="stat-val">${fmtNum(sqft)}</div><div class="stat-lbl">Sq Ft</div></div>`);
  if (yearBuilt) h.push(`<div class="stat"><div class="stat-val">${yearBuilt}</div><div class="stat-lbl">Year Built</div></div>`);
  if (lotSize) h.push(`<div class="stat"><div class="stat-val">${esc(lotSize)}</div><div class="stat-lbl">Lot Size</div></div>`);
  h.push('</div>');

  // Additional details table
  const details: [string, string][] = [];
  if (parking) details.push(['Parking', parking]);
  if (hoaFee) details.push(['HOA Fee', hoaFee]);
  if (taxes) details.push(['Annual Taxes', taxes]);
  if (details.length > 0) {
    h.push('<table><thead><tr><th>Detail</th><th>Value</th></tr></thead><tbody>');
    for (const [lbl, val] of details) h.push(`<tr><td>${esc(lbl)}</td><td>${esc(val)}</td></tr>`);
    h.push('</tbody></table>');
  }

  if (description) h.push(`<h2>Description</h2><p>${esc(description)}</p>`);

  if (features.length > 0) {
    h.push('<h2>Features</h2><ul class="features">');
    for (const f of features) h.push(`<li>${esc(f)}</li>`);
    h.push('</ul>');
  }

  if (amenities.length > 0) {
    h.push('<h2>Amenities</h2><ul class="features">');
    for (const a of amenities) h.push(`<li>${esc(a)}</li>`);
    h.push('</ul>');
  }

  if (neighborhood) h.push(`<h2>Neighborhood</h2><div class="neighborhood">${esc(neighborhood)}</div>`);

  if (schools.length > 0) {
    h.push('<h2>Nearby Schools</h2><table><thead><tr><th>School</th><th>Distance</th><th>Rating</th></tr></thead><tbody>');
    for (const s of schools) {
      const rating = s.rating ? `<span class="school-rating">${esc(s.rating)}</span>` : 'N/A';
      h.push(`<tr><td>${esc(s.name)}</td><td>${esc(s.distance)}</td><td>${rating}</td></tr>`);
    }
    h.push('</tbody></table>');
  }

  if (agentName || agentPhone || agentEmail) {
    h.push('<div class="agent-card"><div class="agent-info">');
    if (agentName) h.push(`<div><span class="agent-label">Agent:</span> ${esc(agentName)}</div>`);
    if (agentPhone) h.push(`<div><span class="agent-label">Phone:</span> ${esc(agentPhone)}</div>`);
    if (agentEmail) h.push(`<div><span class="agent-label">Email:</span> ${esc(agentEmail)}</div>`);
    if (openHouse) h.push(`<div><span class="agent-label">Open House:</span> ${esc(openHouse)}</div>`);
    h.push('</div>');
    h.push('<a class="cta" href="#">Schedule Showing</a>');
    h.push('</div>');
  }

  if (virtualTourUrl) h.push(`<p style="text-align:center;margin-top:16px"><a class="cta" href="${esc(virtualTourUrl)}">Take Virtual Tour</a></p>`);

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const propertyListingTool: UnifiedTool = {
  name: 'create_property_listing',
  description: `Generate MLS-quality property listings with details, features, schools, and agent contact.
Use this when the user needs to create a real estate listing, property description, or marketing sheet for a property.
Returns a professional listing with property stats, feature list, school information, and agent contact card.`,
  parameters: {
    type: 'object',
    properties: {
      address: { type: 'string', description: 'Full property address' },
      price: { type: 'string', description: 'Listing price (e.g., "$450,000")' },
      property_type: { type: 'string', enum: ['single_family', 'condo', 'townhouse', 'multi_family', 'land', 'commercial'], description: 'Type of property' },
      bedrooms: { type: 'number', description: 'Number of bedrooms' },
      bathrooms: { type: 'number', description: 'Number of bathrooms' },
      square_feet: { type: 'number', description: 'Total living area in square feet' },
      description: { type: 'string', description: 'Property description / marketing copy' },
      year_built: { type: 'number', description: 'Year the property was built' },
      lot_size: { type: 'string', description: 'Lot size (e.g., "0.25 acres")' },
      parking: { type: 'string', description: 'Parking details (e.g., "2-car garage")' },
      features: { type: 'array', items: { type: 'string' }, description: 'Interior/exterior features' },
      amenities: { type: 'array', items: { type: 'string' }, description: 'Community or building amenities' },
      schools: {
        type: 'array', description: 'Nearby schools',
        items: {
          type: 'object', required: ['name', 'distance'],
          properties: {
            name: { type: 'string', description: 'School name' },
            distance: { type: 'string', description: 'Distance (e.g., "0.5 mi")' },
            rating: { type: 'string', description: 'School rating (e.g., "9/10")' },
          },
        },
      },
      neighborhood: { type: 'string', description: 'Neighborhood description' },
      hoa_fee: { type: 'string', description: 'Monthly HOA fee' },
      taxes: { type: 'string', description: 'Annual property taxes' },
      mls_number: { type: 'string', description: 'MLS listing number' },
      agent_name: { type: 'string', description: 'Listing agent name' },
      agent_phone: { type: 'string', description: 'Agent phone number' },
      agent_email: { type: 'string', description: 'Agent email address' },
      open_house: { type: 'string', description: 'Open house date/time' },
      virtual_tour_url: { type: 'string', description: 'Virtual tour link' },
      status: { type: 'string', enum: ['active', 'pending', 'sold'], description: 'Listing status. Default: "active"' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['address', 'price', 'property_type', 'bedrooms', 'bathrooms', 'square_feet'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isPropertyListingAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executePropertyListing(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    address: string; price: string; property_type: PropertyType;
    bedrooms: number; bathrooms: number; square_feet: number;
    description?: string; year_built?: number; lot_size?: string; parking?: string;
    features?: string[]; amenities?: string[]; schools?: School[];
    neighborhood?: string; hoa_fee?: string; taxes?: string; mls_number?: string;
    agent_name?: string; agent_phone?: string; agent_email?: string;
    open_house?: string; virtual_tour_url?: string;
    status?: ListingStatus; format?: 'markdown' | 'html';
  };

  if (!args.address?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: address parameter is required', isError: true };
  }
  if (!args.price?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: price parameter is required', isError: true };
  }
  if (!args.property_type) {
    return { toolCallId: toolCall.id, content: 'Error: property_type parameter is required', isError: true };
  }
  if (typeof args.bedrooms !== 'number' || args.bedrooms < 0) {
    return { toolCallId: toolCall.id, content: 'Error: bedrooms must be a non-negative number', isError: true };
  }
  if (typeof args.bathrooms !== 'number' || args.bathrooms < 0) {
    return { toolCallId: toolCall.id, content: 'Error: bathrooms must be a non-negative number', isError: true };
  }
  if (typeof args.square_feet !== 'number' || args.square_feet <= 0) {
    return { toolCallId: toolCall.id, content: 'Error: square_feet must be a positive number', isError: true };
  }

  if (args.schools) {
    for (let i = 0; i < args.schools.length; i++) {
      const s = args.schools[i];
      if (!s.name || !s.distance) {
        return { toolCallId: toolCall.id, content: `Error: school at index ${i} is missing required fields (name, distance)`, isError: true };
      }
    }
  }

  const fmt = args.format ?? 'markdown';
  const status = args.status ?? 'active';
  const features = args.features ?? [];
  const amenities = args.amenities ?? [];
  const schools = args.schools ?? [];

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.address, args.price, args.property_type, args.bedrooms, args.bathrooms, args.square_feet, args.description ?? '', args.year_built, args.lot_size ?? '', args.parking ?? '', features, amenities, schools, args.neighborhood ?? '', args.hoa_fee ?? '', args.taxes ?? '', args.mls_number ?? '', args.agent_name ?? '', args.agent_phone ?? '', args.agent_email ?? '', args.open_house ?? '', args.virtual_tour_url ?? '', status)
      : formatMarkdown(args.address, args.price, args.property_type, args.bedrooms, args.bathrooms, args.square_feet, args.description ?? '', args.year_built, args.lot_size ?? '', args.parking ?? '', features, amenities, schools, args.neighborhood ?? '', args.hoa_fee ?? '', args.taxes ?? '', args.mls_number ?? '', args.agent_name ?? '', args.agent_phone ?? '', args.agent_email ?? '', args.open_house ?? '', args.virtual_tour_url ?? '', status);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Property listing created: ${args.address}`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          address: args.address,
          price: args.price,
          property_type: args.property_type,
          bedrooms: args.bedrooms,
          bathrooms: args.bathrooms,
          square_feet: args.square_feet,
          status,
          features_count: features.length,
          amenities_count: amenities.length,
          schools_count: schools.length,
          has_agent: !!args.agent_name,
          mls_number: args.mls_number ?? null,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating property listing: ${(error as Error).message}`,
      isError: true,
    };
  }
}
