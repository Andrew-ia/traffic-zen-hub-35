import { validateMetaPayload } from '../../server/api/integrations/meta/create-campaign.js';

function assertValid(name: string, objective: string, payload: any) {
  try {
    validateMetaPayload(objective, payload);
    console.log(`✅ ${name}`);
  } catch (e: any) {
    console.error(`❌ ${name}:`, e?.message || e);
    process.exitCode = 1;
  }
}

function main() {
  const baseTargeting = {
    geo_locations: { countries: ['BR'] },
    publisher_platforms: ['facebook', 'instagram'],
  };

  const engagement = {
    destination_type: 'ON_POST',
    promoted_object: { page_id: '000000000000000' },
    targeting: baseTargeting,
  };
  assertValid('Engagement ON_POST + page_id', 'OUTCOME_ENGAGEMENT', engagement);

  const leadsWhatsApp = {
    destination_type: 'MESSAGING_APP',
    promoted_object: { page_id: '000000000000000' },
    targeting: baseTargeting,
  };
  assertValid('Leads WhatsApp MESSAGING_APP + page_id', 'OUTCOME_LEADS', leadsWhatsApp);

  const salesWebsite = {
    destination_type: 'WEBSITE',
    promoted_object: { pixel_id: '111111111111111', custom_event_type: 'PURCHASE' },
    targeting: baseTargeting,
  };
  assertValid('Sales Website + pixel', 'OUTCOME_SALES', salesWebsite);
}

main();
