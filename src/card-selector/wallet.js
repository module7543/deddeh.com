// A fixed, invented statement keeps the tour's dates and comparisons reproducible.
export const statementDate = '2026-04-01';
const market = 'Marketplaces & Department Stores', grocery = 'Groceries & Food Delivery';
const dining = 'Dining', travel = 'Travel', home = 'Home & Garden';
const fold = 'Ochre Fold', reel = 'Juniper Reel', loom = 'Ink Loom';

export const wallet = [
  { name: fold, base_rate: 2, standing: [{ name: 'Dining', rate: 4, app_categories: [dining] }] },
  { name: reel, base_rate: 1, standing: [{ name: 'Groceries', rate: 5, app_categories: [grocery] }] },
  { name: loom, base_rate: 1.5, standing: [{ name: 'Travel', rate: 3, app_categories: [travel] }] },
];

function offer(card, merchant, category, bonus, channel, activation, terms = {}) {
  const slug = name => name.toLowerCase().replaceAll(' ', '-');
  return {
    id: slug(card) + '/' + slug(merchant), card, merchant, category, bonus, channel, activation,
    expires: '2026-04-30', expires_text: null, minimum_spend: null, spend_cap: null,
    other_details: [], fine_print: null, status: 'active', first_seen: statementDate,
    last_read: statementDate, status_since: statementDate, ...terms,
  };
}

const ready = 'already_activated', activate = 'needs_activation';
const both = 'in_store_and_online';
const offers = [
  offer(fold, 'Target', market, '4% back', both, ready, { spend_cap: '$150', fine_print: 'One purchase. Gift cards are excluded.' }),
  offer(reel, 'Target', market, '10% back', 'online', activate, { spend_cap: '$80', fine_print: 'Activate before checkout. Pick up or ship an online order.' }),
  offer(loom, 'Target', market, '3% back', 'in_store', ready),
  offer(loom, 'Amazon', market, '7% back', 'online', activate, { spend_cap: '$120' }),
  offer(fold, 'Amazon', market, '3% back', 'online', ready),
  offer(reel, 'Whole Foods', grocery, '3% back', both, ready),
  offer(loom, 'Whole Foods', grocery, '6% back', 'in_store', activate),
  offer(fold, 'Starbucks', dining, '5% back', 'in_store_and_app', ready),
  offer(loom, 'Uber', travel, 'Spend $25, earn $5', 'online', ready, { minimum_spend: '$25', fine_print: 'One ride. Tips do not count toward the minimum.' }),
  offer(reel, 'Home Depot', home, 'Spend $60, earn $12', both, ready, {
    minimum_spend: '$60', fine_print: 'One purchase of $60 or more before tax. Gift cards and installation services are excluded.',
  }),
  offer(fold, 'Home Depot', home, '4% back', 'in_store', ready, { spend_cap: '$200' }),
];

export const data = {
  categories: [dining, grocery, 'Clothing & Jewelry', 'Beauty & Personal Care', 'Health, Fitness & Vision',
    home, 'Electronics & Software', travel, 'Auto & Gas', 'Streaming & Entertainment', 'Pets & Baby', market, 'Services & Utilities'],
  batches: wallet.map(({ name }) => ({ card: name, read_date: statementDate, offers_found: offers.filter(o => o.card === name).length })),
  offers,
};
