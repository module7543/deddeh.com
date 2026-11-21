import { activation, channel, lookup, quickPick } from './engine.js';
import { data, wallet } from './wallet.js';

const sorts = [
  ['best', 'Best offer'], ['percent', 'Highest percent back'], ['dollar', 'Highest dollar reward'],
  ['rate', 'Reward ÷ spend'], ['az', 'A to Z'], ['za', 'Z to A'], ['expiring', 'Expiring soonest'],
  ['newest', 'Newest added'], ['oldest', 'Oldest added'],
];
const topics = ['Dining', 'Groceries', 'Travel', 'Everyday'];
const defaults = { query: '', where: 'any', active: 'any', sort: 'best', card: '', category: '', panel: 'search', detail: '', group: '', topic: '' };
const swatch = name => ['ochre', 'juniper', 'ink'][wallet.findIndex(c => c.name === name)];
const chip = name => '<i aria-hidden="true" class="mini-card ' + swatch(name) + '"></i>';
const optionList = (options, value) => options.map(([id, label]) => '<option value="' + id + '"' + (value === id ? ' selected' : '') + '>' + label + '</option>').join('');
function switches(key, options, value) {
  return options.map(([id, label]) => '<button type="button" data-setting="' + key + '" data-value="' + id + '" aria-pressed="' + (id === value) + '">' + label + '</button>').join('');
}

function answer(recommendation, where) {
  const { ready, after, merchant, deals } = recommendation;
  const winner = ready.wins[0], alternate = after?.wins[0];
  const action = alternate && alternate.total > winner.total
    ? '<p class="alternate"><b>' + alternate.total + '% after activation</b> · ' + alternate.C.name + (alternate.o?.channel === 'online' ? ' online' : '') + '</p>' : '';
  const deal = deals.find(item => item.value > winner.total);
  const method = deal ? '<p class="alternate"><b>' + deal.o.bonus + '</b> · ' + deal.C.name + '</p>' : '';
  return '<section class="answer" aria-label="Card recommendation"><div class="answer-kicker"><i></i>Use this card <span> / ' + merchant + '</span></div>' +
    '<div class="answer-main"><div><strong>' + winner.C.name + '</strong><small>' + (winner.v ? winner.v.pct + '% offer + ' : '') + winner.base.rate + '% card rate</small></div>' +
    '<div class="yield">' + ready.total + '<span>%</span><small>ready now</small></div></div>' + action + method + '</section>' +
    '<div class="where-switch" role="group" aria-label="Where you’re paying">' + switches('where', [['any','Any'],['store','In store'],['online','Online']], where) + '</div>';
}

function offerRow(o) {
  const [label, tone] = activation(o);
  return '<button class="offer-row" type="button" data-detail="' + o.id + '">' + chip(o.card) +
    '<span><b>' + o.card + '</b><small>' + channel(o) + '</small></span><span class="offer-value"><b>' + o.bonus + '</b>' +
    '<small class="badge ' + tone + '">' + label + '</small></span><span aria-hidden="true">›</span></button>';
}

function groupsView(result, state) {
  if (!result.count) return '<p class="no-offers">No offers match. Try another merchant or change the filters.</p>';
  return '<div class="results-label">Merchant offers <span>' + result.count + (result.count === 1 ? ' offer' : ' offers') + '</span></div>' +
    result.groups.map(({ name, rows, key }, index) => {
      const open = state.group === key || (!state.group && result.groups.length === 1);
      return '<div class="merchant-group" style="--row:' + Math.min(index, 4) + '"><button type="button" class="merchant" data-group="' + key + '" aria-expanded="' + open + '"><b>' +
        name + '</b><span>' + rows.length + (rows.length === 1 ? ' offer' : ' offers') + '</span><i aria-hidden="true">' + (open ? '−' : '+') +
        '</i></button>' + (open ? rows.map(offerRow).join('') : '') + '</div>';
    }).join('');
}

function filterPanel(s) {
  const choices = (label, key, values) => '<fieldset><legend>' + label + '</legend><div class="filter-choices">' + switches(key, values, s[key]) + '</div></fieldset>';
  const select = (label, key, values) => '<label class="filter-select">' + label + '<select data-select="' + key + '">' + optionList(values, s[key]) + '</select></label>';
  return '<div class="panel-title"><h3>Filters &amp; sort</h3><button type="button" data-back>Done</button></div>' +
    choices('Where you’re paying', 'where', [['any','Any'],['store','In store'],['online','Online']]) +
    choices('Activation', 'active', [['any','Any'],['ready','Ready now'],['needs','Needs activation']]) +
    select('Sort by', 'sort', sorts) + select('Card', 'card', [['','All cards'], ...wallet.map(c => [c.name,c.name])]) +
    select('Category', 'category', [['','All categories'], ...data.categories.filter(c => data.offers.some(o => o.category === c)).map(c => [c,c])]);
}

function detailPanel(id) {
  const o = data.offers.find(offer => offer.id === id);
  const fields = [['Reward', o.bonus], ['Minimum spend', o.minimum_spend], ['Spending cap', o.spend_cap], ['Channel', channel(o)],
    ['Activation', activation(o)[0]], ['Expires', o.expires], ['Category', o.category]];
  return '<div class="panel-title"><h3>Offer detail</h3><button type="button" data-back>Back to results</button></div>' +
    '<div class="detail-lead">' + chip(o.card) + '<span>' + o.card + '</span><h4>' + o.merchant + '</h4><p>' + o.bonus + '</p></div><dl class="offer-fields">' +
    fields.filter(([,value]) => value).map(([label,value]) => '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>').join('') +
    '</dl>' + (o.fine_print ? '<p class="fine-print"><b>Fine print</b>' + o.fine_print + '</p>' : '');
}

function quickPanel(selected) {
  const tiles = topics.map(topic => {
    const result = quickPick(topic), card = result.wins[0].C.name;
    return '<button type="button" class="pick" aria-pressed="' + (topic === selected) + '" data-topic="' + topic + '">' + chip(card) +
      '<span>' + topic + '</span><strong>' + result.total + '<small>%</small></strong><b>' + card + '</b></button>';
  }).join('');
  const winner = selected && quickPick(selected).wins[0];
  return '<div class="panel-title"><h3>Quick picks</h3></div><p class="screen-subtitle">Choose the kind of purchase.</p><div class="pick-grid">' + tiles + '</div>' +
    (winner ? '<div class="pick-note"><b>' + selected + '</b><p>' + winner.C.name + ' earns ' + winner.total + '% ' +
      (winner.base.cat ? 'when the purchase codes as ' + selected.toLowerCase() : 'at its everyday rate') + '.</p></div>' : '');
}

export function mountScreen(frame) {
  const screen = document.createElement('div');
  screen.className = 'wallet-screen';
  screen.innerHTML = '<header class="app-bar"><span class="app-name"><i class="app-mark" aria-hidden="true"></i>CardSelector</span>' +
    '<nav aria-label="Demo app"><button type="button" data-panel="search">Search</button><button type="button" data-panel="picks">Quick picks</button></nav></header>' +
    '<div class="screen-scroll" tabindex="0" role="region" aria-label="Sample wallet"><div class="search-area"><h3>Merchant lookup</h3><div class="search-tools">' +
    '<label class="wallet-input"><i aria-hidden="true"></i><input type="search" aria-label="Search a merchant" placeholder="Search a merchant" autocomplete="off"></label>' +
    '<button type="button" data-panel="filters" class="filter-button"><i aria-hidden="true"></i>Filters</button></div></div><div class="screen-body"></div></div>';
  frame.append(screen);
  const scroller = screen.querySelector('.screen-scroll'), input = screen.querySelector('input');
  const content = screen.querySelector('.screen-body'), searchArea = screen.querySelector('.search-area');
  let state;
  function render(resetScroll = false) {
    const { panel } = state;
    input.value = state.query;
    searchArea.hidden = panel !== 'search';
    screen.querySelectorAll('nav button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.panel === (panel === 'picks' ? 'picks' : 'search'))));
    if (panel === 'filters') content.innerHTML = filterPanel(state);
    else if (panel === 'detail') content.innerHTML = detailPanel(state.detail);
    else if (panel === 'picks') content.innerHTML = quickPanel(state.topic);
    else {
      const result = lookup(state);
      const active = state.active !== 'any' || state.where !== 'any' || state.sort !== 'best' || state.card || state.category;
      screen.querySelector('.filter-button').classList.toggle('filtered', Boolean(active));
      const list = '<div class="wallet-results">' + groupsView(result, state) + '</div>';
      content.innerHTML = result.recommendation
        ? '<div class="decision-layout"><div>' + answer(result.recommendation, state.where) + '</div>' + list + '</div>'
        : list;
    }
    if (resetScroll) scroller.scrollTop = 0;
  }
  function update(patch, resetScroll = false) { Object.assign(state, patch); render(resetScroll); }
  input.addEventListener('input', () => update({ query: input.value, group: '' }, true));
  screen.addEventListener('change', e => {
    if (e.target.dataset.select) {
      state[e.target.dataset.select] = e.target.value;
    }
  });
  screen.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.setting) update({ [d.setting]: d.value });
    else if (d.group) update({ group: b.getAttribute('aria-expanded') === 'true' ? '-' : d.group });
    else if (d.detail) update({ detail: d.detail, panel: 'detail' }, true);
    else if (d.topic) update({ topic: d.topic });
    else if (d.panel || b.hasAttribute('data-back')) update({ panel: d.panel || 'search' }, true);
    // Replacing the results must keep keyboard focus inside the live app.
    if (e.detail === 0 && e.isTrusted && !b.isConnected) {
      const destination = [...screen.querySelectorAll('button')].find(node =>
        (d.setting && node.dataset.setting === d.setting && node.dataset.value === d.value) ||
        (d.group && node.dataset.group === d.group) || (d.topic && node.dataset.topic === d.topic));
      (destination || screen.querySelector('[data-back]') || input).focus({ preventScroll: true });
    }
  });
  return { screen, scroller, input, update,
    reset(patch = {}) { state = { ...defaults, ...patch }; render(true); },
  };
}
