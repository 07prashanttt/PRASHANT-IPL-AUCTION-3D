
/* ==========================================
   PRASHANT IPL AUCTION 3D
   Complete Auction Engine
========================================== */

const TEAMS = [
 {id:'CSK',name:'Chennai Super Kings',short:'CSK',color:'#e5b51b'},
 {id:'MI',name:'Mumbai Indians',short:'MI',color:'#1689d5'},
 {id:'RCB',name:'Royal Challengers Bengaluru',short:'RCB',color:'#c62828'},
 {id:'KKR',name:'Kolkata Knight Riders',short:'KKR',color:'#7046a8'},
 {id:'RR',name:'Rajasthan Royals',short:'RR',color:'#e65a9a'},
 {id:'SRH',name:'Sunrisers Hyderabad',short:'SRH',color:'#f47b20'},
 {id:'DC',name:'Delhi Capitals',short:'DC',color:'#1b66b2'},
 {id:'PBKS',name:'Punjab Kings',short:'PBKS',color:'#d43d52'},
 {id:'GT',name:'Gujarat Titans',short:'GT',color:'#2d536d'},
 {id:'LSG',name:'Lucknow Super Giants',short:'LSG',color:'#38a6ad'}
];

const $ = id => document.getElementById(id);

let state = null;
let aiTimer = null;
let soundOn = true;
let selectedTeam = 'CSK';

/* MONEY */

function money(n) {
 return n >= 1
  ? `₹${n.toFixed(2)} Cr`
  : `₹${Math.round(n*100)} lakh`;
}

/* LOGGING */

function log(msg,price='') {
 const el = document.createElement('div');
 el.className = 'feed-row';
 el.textContent = '';

 const message = document.createElement('span');
 message.textContent = msg;

 const amount = document.createElement('b');
 amount.className = 'feed-price';
 amount.textContent = price;

 el.append(message,amount);

 $('activityFeed').prepend(el);

 while ($('activityFeed').children.length > 35) {
  $('activityFeed').lastChild.remove();
 }
}

/* TEAM HELPERS */

function teamBy(id) {
 return state.teams.find(t => t.id === id);
}

function canBuy(team, priceOrPlayer) {
 if (!team || !priceOrPlayer) return false;

 const price = typeof priceOrPlayer === 'number'
  ? priceOrPlayer
  : priceOrPlayer.base;

 const overseas = typeof priceOrPlayer === 'object'
  ? !!priceOrPlayer.overseas
  : !!state?.current?.overseas;

 return (
  Number.isFinite(price) &&
  team.purse >= price &&
  team.players.length < 25 &&
  (!overseas || team.overseas < 8)
 );
}

/* TEAM SELECTION */

function renderTeams() {
 const picker = $('teamPicker');
 picker.innerHTML = '';

 TEAMS.forEach(t => {
  let b = document.createElement('button');

  b.className = 'team-option' +
   (selectedTeam === t.id ? ' selected' : '');

  b.innerHTML = `
   <span class="team-logo" style="--team:${t.color}">
    ${t.short}
   </span>
   <span>
    <b>${t.name}</b>
    <small>Starting purse ₹120 Cr</small>
   </span>
  `;

  b.onclick = () => {
   selectedTeam = t.id;

   document.querySelectorAll('.team-option')
    .forEach(x => x.classList.remove('selected'));

   b.classList.add('selected');
  };

  picker.appendChild(b);
 });
}

/* NEW AUCTION */

function newState(teamId) {
 if (!Array.isArray(window.PLAYER_POOL)) {
  throw new Error('PLAYER_POOL is missing. Check players.js loading.');
 }

 return {
  userTeam: teamId,

  teams: TEAMS.map(t => ({
   ...t,
   purse: 120,
   players: [],
   overseas: 0
  })),

  pool: window.PLAYER_POOL.map(p => ({...p})),

  index: 0,
  current: null,
  bid: 0,
  leader: null,
  bids: 0,
  passed: false,
  sold: false,
  finished: false,
  feed: []
 };
}

function start() {
 try {
  clearInterval(aiTimer);

  state = newState(selectedTeam);

  $('setupView').classList.add('hidden');
  $('gameView').classList.remove('hidden');

  loadPlayer();
  renderAll();

 } catch (error) {
  alert(error.message);
  console.error(error);
 }
}

/* BID INCREMENT */

function increment(price) {
 if (price < 1) return 0.1;
 if (price < 2) return 0.2;
 if (price < 5) return 0.25;
 return 0.5;
}

/* LOAD PLAYER */

function loadPlayer() {
 clearInterval(aiTimer);

 if (state.index >= state.pool.length) {
  state.finished = true;
  state.current = null;

  renderAll();

  $('playerName').textContent = 'AUCTION COMPLETED';
  $('playerCountry').textContent = '🏆 ALL LOTS COMPLETE';
  $('playerRole').textContent = 'SQUADS READY';
  $('playerStats').textContent =
   'You can review team purchases and simulate a match.';

  $('playerPhoto').classList.add('hidden');
  $('playerInitial').textContent = '🏆';

  $('bidBtn').disabled = true;
  $('passBtn').disabled = true;
  $('nextBtn').classList.add('hidden');

  return;
 }

 const p = state.pool[state.index];

 state.current = p;
 state.bid = p.base;
 state.leader = null;
 state.bids = 0;
 state.sold = false;
 state.passed = false;

 $('playerPhoto').classList.add('hidden');
 $('playerPhoto').removeAttribute('src');

 $('playerInitial').textContent =
  p.name.split(' ').map(x => x[0]).join('').slice(0,2);

 $('playerInitial').classList.remove('hidden');

 if (p.photo) {
  $('playerPhoto').src = p.photo;
  $('playerPhoto').classList.remove('hidden');

  $('playerPhoto').onload = () => {
   $('playerInitial').classList.add('hidden');
  };

  $('playerPhoto').onerror = () => {
   $('playerPhoto').classList.add('hidden');
   $('playerInitial').classList.remove('hidden');
  };
 }

 $('lotLabel').textContent =
  `LOT ${String(state.index+1).padStart(3,'0')}`;

 $('categoryLabel').textContent = p.category;
 $('playerCountry').textContent = `${p.flag} ${p.country.toUpperCase()}`;
 $('playerName').textContent = p.name;
 $('playerRole').textContent = p.role.toUpperCase();
 $('playerStats').textContent = `${p.stats} • Rating ${p.rating}`;

 $('basePrice').textContent = money(p.base);
 $('currentBid').textContent = money(p.base);

 $('highestBidder').textContent = 'No bids yet';
 $('bidCount').textContent = '0 BIDS';

 $('soldBanner').classList.add('hidden');

 $('bidBtn').disabled = false;
 $('passBtn').disabled = false;

 $('bidBtn').textContent = '🔨 PLACE BID';
 $('nextBtn').classList.add('hidden');

 $('bidMessage').textContent =
  'Starting price announced. AI franchises are evaluating this player.';

 log(
  `LOT ${String(state.index+1).padStart(3,'0')} • ${p.name} enters auction`,
  money(p.base)
 );

 renderAll();
 startAI();
}

/* PLACE BID */

function placeBid(teamId) {
 if (!state.current || state.sold) return false;

 const t = teamBy(teamId);
 const p = state.current;

 if (!t) return false;

 const next = Number(
  (state.bid + increment(state.bid)).toFixed(2)
 );

 if (!canBuy(t,next)) {
  if (teamId === state.userTeam) {
   $('bidMessage').textContent =
    p.overseas && t.overseas >= 8
     ? 'Overseas limit reached (8/8). Domestic players are still available.'
     : 'Insufficient purse or squad is full.';
  }

  return false;
 }

 state.bid = next;
 state.leader = teamId;
 state.bids++;

 $('currentBid').textContent = money(state.bid);
 $('highestBidder').textContent = t.name;
 $('bidCount').textContent = `${state.bids} BIDS`;

 $('bidMessage').textContent =
  `${t.name} bids ${money(state.bid)}.`;

 log(`${t.short} bids for ${p.name}`,money(state.bid));

 renderLedger();

 return true;
}

/* USER BID */

function userBid() {
 if (!state || state.sold || state.passed) return;

 const t = teamBy(state.userTeam);

 const next = Number(
  (state.bid + increment(state.bid)).toFixed(2)
 );

 if (!canBuy(t,next)) {
  $('bidMessage').textContent =
   state.current.overseas && t.overseas >= 8
    ? 'Overseas limit reached. Domestic players are still available.'
    : 'You cannot afford the next bid or your squad is full.';

  return;
 }

 placeBid(state.userTeam);
}

/* USER PASS */

function pass() {
 if (!state || state.sold) return;

 state.passed = true;

 $('bidBtn').disabled = true;
 $('passBtn').disabled = true;

 $('bidMessage').textContent =
  'You passed on this player. AI teams may continue bidding.';

 log(`${teamBy(state.userTeam).short} passes`);
}

/* AI BIDDING ENGINE */

function startAI() {
 clearInterval(aiTimer);

 let quietRounds = 0;
 let totalRounds = 0;

 aiTimer = setInterval(() => {

  if (!state || !state.current || state.sold || state.finished) {
   clearInterval(aiTimer);
   return;
  }

  totalRounds++;

  const p = state.current;

  const nextPrice = Number(
   (state.bid + increment(state.bid)).toFixed(2)
  );

  const candidates = state.teams.filter(team =>
   team.id !== state.userTeam &&
   canBuy(team,nextPrice)
  );

  if (candidates.length === 0) {
   quietRounds++;
  } else {

   const ranked = candidates.map(team => {

    const sameRole = team.players.filter(
     player =>
      String(player.role).toLowerCase() ===
      String(p.role).toLowerCase()
    ).length;

    const roleNeed = Math.max(0,6-sameRole);

    const budgetStrength = team.purse/120;

    const quality = (p.rating || 50)/100;

    const maximumBudget = Math.min(
     team.purse,
     Math.max(
      p.base*2,
      p.base+(p.rating || 50)*0.035
     )
    );

    const interest =
     roleNeed*12 +
     budgetStrength*15 +
     quality*20 +
     Math.random()*8;

    return {
     team,
     interest,
     maximumBudget
    };
   });

   ranked.sort((a,b) => b.interest-a.interest);

   const interested = ranked.filter(item =>
    nextPrice <= item.maximumBudget
   );

   if (interested.length > 0) {

    const selected = interested[0];

    const shouldBid =
     totalRounds === 1 ||
     Math.random() < Math.min(
      0.88,
      0.35+selected.interest/100
     );

    if (shouldBid) {
     const success = placeBid(selected.team.id);

     if (success) {
      quietRounds = 0;
     } else {
      quietRounds++;
     }

    } else {
     quietRounds++;
    }

   } else {
    quietRounds++;
   }
  }

  if (quietRounds >= 4 || totalRounds >= 18) {
   clearInterval(aiTimer);

   setTimeout(() => {
    if (state && !state.sold && state.current) {
     sellCurrent();
    }
   },1800);
  }

 },1600);
}

/* SELL PLAYER */

function sellCurrent() {
 if (!state || state.sold || !state.current) return;

 clearInterval(aiTimer);

 state.sold = true;

 const p = state.current;

 if (state.leader) {

  const t = teamBy(state.leader);

  if (!t || t.purse < state.bid || t.players.length >= 25) {
   state.leader = null;
  } else {

   t.purse = Number((t.purse-state.bid).toFixed(2));

   t.players.push(p);

   if (p.overseas) {
    t.overseas++;
   }

   $('soldBanner').textContent =
    `🔨 SOLD TO ${t.name.toUpperCase()} FOR ${money(state.bid)}`;

   $('soldBanner').classList.remove('hidden');

   log(`${p.name} SOLD to ${t.name}`,money(state.bid));
  }
 }

 if (!state.leader) {
  $('soldBanner').textContent =
   'UNSOLD • NO FRANCHISE PLACED A BID';

  $('soldBanner').classList.remove('hidden');

  log(`${p.name} goes UNSOLD`);
 }

 $('bidBtn').disabled = true;
 $('passBtn').disabled = true;

 $('nextBtn').classList.remove('hidden');

 $('bidMessage').textContent =
  'Lot closed. Continue to the next player.';

 renderAll();
}

/* NEXT PLAYER */

function nextPlayer() {
 if (!state || !state.sold) return;

 state.index++;
 loadPlayer();
}

/* TEAM LEDGER */

function renderLedger() {
 let html = '';

 state.teams.forEach(t => {

  html += `
   <div class="ledger-row">
    <span class="ledger-logo" style="--team:${t.color}">
     ${t.short}
    </span>

    <div>
     <b>${t.name}</b>
     <small>
      ${t.players.length} players • ${t.overseas}/8 overseas
     </small>
    </div>

    <div class="ledger-purse">
     ${money(t.purse)}
    </div>
   </div>
  `;
 });

 $('teamLedger').innerHTML = html;
}

/* PLAYER QUEUE */

function renderQueue() {
 const from = state.index;

 const items = state.pool.slice(from,from+10);

 $('queueCount').textContent =
  `${state.pool.length-from} LEFT`;

 $('playerQueue').innerHTML = items.map((p,i) => `
  <div class="queue-item ${i===0?'current':''}">
   <span>
    <b>${String(from+i+1).padStart(3,'0')}.</b>
    ${p.name}
    <small> • ${p.category}</small>
   </span>

   <b>${money(p.base)}</b>
  </div>
 `).join('');
}

/* PURCHASE FEED */

function renderPurchases() {
 let arr = [];

 state.teams.forEach(t => {
  t.players.slice().reverse().forEach(p => {
   arr.push({team:t.name,p});
  });
 });

 $('purchaseFeed').innerHTML = arr.length
  ? arr.slice(0,12).map(x => `
    <div class="purchase-row">
     <span>
      <b>${x.p.name}</b>
      <small>${x.team} • ${x.p.role}</small>
     </span>

     <b class="feed-price">Purchased</b>
    </div>
   `).join('')
  : '<div class="empty">No players sold yet.</div>';
}

/* USER SQUAD */

function renderSquad() {
 const t = teamBy(state.userTeam);

 $('mySquad').innerHTML = t.players.length
  ? t.players.map(p => `
    <div class="squad-row">
     <span>
      <b>${p.flag} ${p.name}</b>
      <small>
       ${p.role} • ${p.overseas?'Overseas':'Domestic'}
      </small>
     </span>

     <b>${p.category}</b>
    </div>
   `).join('')
  : '<div class="empty">Your purchased players will appear here.</div>';

 $('squadCount').textContent = `${t.players.length} / 25`;
}

/* MAIN RENDER */

function renderAll() {
 if (!state) return;

 const t = teamBy(state.userTeam);

 $('yourTeamName').textContent = t.name;
 $('yourPurse').textContent = money(t.purse);
 $('yourOverseas').textContent = `${t.overseas} / 8`;

 $('scoreStrip').innerHTML = `
  <div class="score-card">
   <small>YOUR TEAM</small>
   <b>${t.short}</b>
  </div>

  <div class="score-card">
   <small>REMAINING PURSE</small>
   <b>${money(t.purse)}</b>
  </div>

  <div class="score-card">
   <small>SQUAD SIZE</small>
   <b>${t.players.length}/25</b>
  </div>

  <div class="score-card">
   <small>OVERSEAS</small>
   <b>${t.overseas}/8</b>
  </div>

  <div class="score-card">
   <small>LOTS LEFT</small>
   <b>${Math.max(0,state.pool.length-state.index)}</b>
  </div>
 `;

 renderLedger();
 renderQueue();
 renderPurchases();
 renderSquad();
}

/* SAVE AUCTION */

function save() {
 if (!state) return;

 localStorage.setItem(
  'prashantAuctionSave',
  JSON.stringify(state)
 );

 $('bidMessage').textContent =
  'Auction saved on this device.';
}

/* RESTORE AUCTION */

function restore() {
 let raw = localStorage.getItem('prashantAuctionSave');

 if (!raw) return false;

 try {
  state = JSON.parse(raw);

  $('setupView').classList.add('hidden');
  $('gameView').classList.remove('hidden');

  if (state.current) {

   const p = state.current;

   $('playerName').textContent = p.name;
   $('playerCountry').textContent = `${p.flag} ${p.country.toUpperCase()}`;
   $('playerRole').textContent = p.role.toUpperCase();
   $('playerStats').textContent = p.stats;

   $('basePrice').textContent = money(p.base);
   $('currentBid').textContent = money(state.bid);

   $('highestBidder').textContent =
    state.leader ? teamBy(state.leader).name : 'No bids yet';

   $('lotLabel').textContent =
    `LOT ${String(state.index+1).padStart(3,'0')}`;

   $('categoryLabel').textContent = p.category;

   if (p.photo) {
    $('playerPhoto').src = p.photo;
    $('playerPhoto').classList.remove('hidden');
   }

   $('bidBtn').disabled = state.sold || state.passed;
   $('passBtn').disabled = state.sold || state.passed;

   if (state.sold) {
    $('nextBtn').classList.remove('hidden');
   } else {
    $('nextBtn').classList.add('hidden');
    startAI();
   }
  }

  renderAll();

  return true;

 } catch(e) {
  console.error('Restore error:',e);
  return false;
 }
}

/* MATCH SIMULATOR */

function simulateMatch() {
 const t = teamBy(state.userTeam);

 if (t.players.length < 2) {
  $('matchResult').innerHTML =
   'Buy at least 2 players to unlock the quick match simulator.';
  return;
 }

 const rating = t.players.reduce(
  (a,p) => a+p.rating,0
 )/t.players.length;

 const score = Math.round(
  105+rating*.75+Math.random()*65
 );

 const wickets = Math.floor(Math.random()*8)+2;

 const opp = state.teams
  .filter(x => x.id !== t.id)
  .sort((a,b) => b.players.length-a.players.length)[0];

 const oppScore = Math.round(110+Math.random()*65);

 const winner = score >= oppScore ? t.name : opp.name;

 $('matchResult').innerHTML = `
  <b>${t.name}</b> ${score}/${wickets} (20 overs)
  <br>
  <b>${opp.name}</b> ${oppScore}/${Math.floor(Math.random()*8)+2} (20 overs)
  <br><br>
  <b>${winner} win the simulated match!</b>
  <br>
  <span class="muted">
   Quick simulation based on squad strength and random match events.
  </span>
 `;
}

/* BUTTON EVENTS */

$('startBtn').onclick = start;

$('bidBtn').onclick = userBid;

$('passBtn').onclick = pass;

$('nextBtn').onclick = nextPlayer;

$('saveBtn').onclick = save;

$('resetBtn').onclick = () => {

 if (confirm('Start a new auction? Current saved progress will be lost.')) {

  clearInterval(aiTimer);

  localStorage.removeItem('prashantAuctionSave');

  $('gameView').classList.add('hidden');
  $('setupView').classList.remove('hidden');

  state = null;

  renderTeams();
 }
};

$('matchBtn').onclick = simulateMatch;

$('soundBtn').onclick = () => {
 soundOn = !soundOn;

 $('soundBtn').textContent = soundOn ? '🔊' : '🔇';
};

/* INITIALIZATION */

renderTeams();

if (localStorage.getItem('prashantAuctionSave')) {

 let b = document.createElement('button');

 b.className = 'secondary-btn full';
 b.style.marginTop = '10px';

 b.textContent = '↻ CONTINUE SAVED AUCTION';

 b.onclick = restore;

 $('startBtn').after(b);
}
