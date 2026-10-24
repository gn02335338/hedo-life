import { OWNED_CAR_CATALOG, PRIVATE_GARAGE_RULES, ownershipEligibility, quoteOwnershipAction } from './ownership.js';
import { GARAGE_PALETTE } from './garage.js';
import { isOwnedVehicle, retrieveOwnedVehicle, storeOwnedVehicle } from './ownership-session.js';

const el = (tag, className, text) => { const node = document.createElement(tag); node.className = className || ''; if (text != null) node.textContent = text; return node; };
const button = (label, className, action) => { const node = el('button', className, label); node.type = 'button'; node.addEventListener('click', action); return node; };
const hex = color => '#' + color.toString(16).padStart(6, '0');

function carIllustration(model, color) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 240 112'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('collection-car-art');
  const shape = (tag, attrs) => { const node = document.createElementNS(svg.namespaceURI, tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value); svg.append(node); };
  const suv = model.variant === 'suv', hatch = model.variant === 'hatch';
  shape('ellipse', { cx: 122, cy: 94, rx: 93, ry: 6, fill: '#080911', opacity: '.45' });
  shape('path', { d: `M25 70 Q28 62 42 59 L69 ${suv ? 34 : 43} Q74 37 85 37 L${hatch ? 151 : 157} 37 Q164 39 171 ${suv ? 52 : 59} L207 65 Q215 68 215 76 L213 87 H24 Z`, fill: hex(color), stroke: '#ffffff55', 'stroke-width': 1.3 });
  shape('path', { d: `M76 43 L108 43 V59 H61 Z M114 43 H150 L162 59 H114 Z`, fill: '#1a2c39' });
  shape('path', { d: 'M30 70 H203 M113 62 V84', fill: 'none', stroke: '#15232b', 'stroke-opacity': '.3' });
  shape('path', { d: 'M30 67 H44 M202 68 H211', stroke: '#fff3c5', 'stroke-width': 4, 'stroke-linecap': 'round' });
  for (const cx of [63, 177]) {
    shape('circle', { cx, cy: 85, r: suv ? 14 : 12, fill: '#15171e', stroke: '#0a0c12', 'stroke-width': 3 });
    shape('circle', { cx, cy: 85, r: 7, fill: '#a9b4bc', stroke: '#e1e7e8', 'stroke-width': 1 });
    shape('circle', { cx, cy: 85, r: 3, fill: '#343b48' });
  }
  return svg;
}

export function createCollectionPanel({ progress, fleet, context, tab, message, onAction, onTab, onNavigate, onLocate, onRepair, onClose }) {
  const wrap = el('div', 'collection-panel'); wrap.id = 'collection-panel';
  const eligible = ownershipEligibility(context), ownedIds = progress.ownedVehicleIds || [], activeCar = fleet.find(isOwnedVehicle);
  const summary = el('div', 'garage-summary'), identity = el('div');
  identity.append(el('span', 'garage-eyebrow', 'HEDO MOTOR CLUB / PRIVATE COLLECTION'), el('h3', '', '下一段路，開自己的車。'), el('p', '', '三個私人車位。車色與性能各自保留，想出發時再取車。'));
  const wallet = el('div', 'garage-wallet'); wallet.append(el('small', '', '可用基金'));
  const balance = el('strong', '', '$ ' + progress.money.toLocaleString('en-US')); balance.id = 'collection-balance'; wallet.append(balance); summary.append(identity, wallet); wrap.append(summary);
  const status = el('p', 'garage-status' + (eligible.ok ? ' ready' : ''), eligible.ok ? '已到服務區 · 可以買車、取車與收回保管' : eligible.message); status.id = 'collection-availability'; wrap.append(status);
  const receipt = el('p', 'garage-receipt', message); receipt.id = 'collection-message'; receipt.setAttribute('role', 'status'); receipt.tabIndex = -1; receipt.hidden = !message; wrap.append(receipt);
  if (!eligible.ok) { const route = button('導航到私人車庫 ↗', 'garage-route', onNavigate); route.id = 'collection-route'; wrap.append(route); }
  const tabs = el('div', 'collection-tabs'); tabs.setAttribute('aria-label', '車庫選單');
  for (const [value, label] of [['owned', `我的車庫 ${ownedIds.length} / ${PRIVATE_GARAGE_RULES.capacity}`], ['shop', '選購新車']]) {
    const control = button(label, '', () => onTab(value)); control.dataset.collectionTab = value; control.setAttribute('aria-pressed', String(tab === value)); tabs.append(control);
  }
  wrap.append(tabs);
  const grid = el('div', 'collection-grid');
  const models = OWNED_CAR_CATALOG.filter(model => tab === 'shop' || ownedIds.includes(model.id));
  if (!models.length) {
    const empty = el('div', 'collection-empty'); empty.append(el('span', '', 'YOUR FIRST KEY'), el('h3', '', '車位空著，故事還沒開始。'), el('p', '', '第一輛都會小車 $250。走到車庫就能買，不必先搶車。'), button('看看新車 ↗', 'primary', () => onTab('shop'))); wrap.append(empty);
  }
  for (const model of models) {
    const owned = ownedIds.includes(model.id), live = fleet.find(car => car.id === model.id && isOwnedVehicle(car));
    const customization = progress.customizations?.[model.id], paint = GARAGE_PALETTE.find(item => item.id === customization?.colorId);
    const health = progress.ownedVehicleHealth?.[model.id] ?? 100, tuning = customization?.upgrades || {};
    const card = el('article', 'collection-card' + (live ? ' is-active' : '')); card.dataset.ownedId = model.id;
    const label = el('div', 'collection-card-kicker'); label.append(el('span', '', { hatch: 'CITY / 都會', sedan: 'EXECUTIVE / 轎車', suv: 'TOURING / 休旅' }[model.variant]), el('span', '', owned ? live ? '街上愛車' : '庫內保管' : '新車')); card.append(label);
    card.append(carIllustration(model, paint?.color ?? model.color), el('h3', '', model.name));
    card.append(el('p', 'collection-color', (paint?.name || GARAGE_PALETTE.find(item => item.id === model.colorId)?.name || '原廠車色') + (owned ? ` · 車況 ${health}%` : ' · 原廠性能')));
    if (owned) {
      const specs = el('div', 'collection-specs');
      for (const [key, title] of [['engine', '引擎'], ['brakes', '煞車'], ['handling', '操控']]) specs.append(el('span', '', `${title} ${tuning[key] || 0}/2`));
      card.append(specs);
    } else card.append(el('p', 'collection-price', '$ ' + model.price));
    const actions = el('div', 'collection-card-actions');
    function actionButton(kind, label, available) {
      const transaction = { id: crypto.randomUUID(), kind, vehicleId: model.id };
      const control = button(label, 'garage-buy', () => onAction(transaction));
      control.dataset.collectionAction = kind; control.dataset.vehicleId = model.id;
      control.disabled = !eligible.ok || !available.ok;
      control.title = !eligible.ok ? eligible.message : available.message || label; actions.append(control);
      if (eligible.ok && !available.ok && available.message) actions.append(el('small', 'garage-reason', available.message));
    }
    if (!owned) actionButton('purchase', `購入收藏 · $${model.price}`, quoteOwnershipAction(progress, { kind: 'purchase', vehicleId: model.id }));
    else if (health === 0) {
      const quote = quoteOwnershipAction(progress, { kind: 'recover', vehicleId: model.id });
      actionButton('recover', `救援整備 · $${PRIVATE_GARAGE_RULES.recoverPrice}`, live?.damageStage === 'burning' ? { ok: false, message: '先回街頭，等火勢熄滅後再救援。' } : quote);
    } else if (live) {
      const locate = button('定位愛車 ↗', 'garage-buy', onLocate); locate.dataset.collectionAction = 'locate'; locate.dataset.vehicleId = model.id; actions.append(locate);
    } else actionButton('retrieve', activeCar ? '收回目前愛車，換開這輛 ↗' : '取出愛車 ↗', retrieveOwnedVehicle(progress, fleet, model.id, context));
    card.append(actions); grid.append(card);
  }
  wrap.append(grid);
  if (tab === 'owned' && activeCar) {
    const available = storeOwnedVehicle(progress, fleet, context), row = el('div', 'collection-storage');
    row.append(el('p', '', `街上愛車：${activeCar.name}。收回時保留車況。`));
    const store = button('收回愛車保管', 'secondary', () => onAction({ kind: 'store', vehicleId: activeCar.id })); store.id = 'collection-store'; store.disabled = !available.ok; store.title = available.message || ''; row.append(store); wrap.append(row);
  }
  wrap.append(el('p', 'garage-footnote', '切換時會把上一輛愛車收回，只在街上保留一輛。重開遊戲時以行人出發，愛車都在庫內。車況不會因收存恢復；受損車可到修車廠，報廢愛車可付費救援。'));
  const footer = el('div', 'collection-footer'), leave = button('完成，回到街頭 ↗', 'primary', onClose); leave.id = 'collection-leave'; footer.append(leave, button('查看修車廠', 'text-btn', onRepair)); wrap.append(footer);
  return wrap;
}
