(function(){
    const VERSION = '1.8.0';
    const SAVE_KEY = 'homestead-save-v1';

    // Safe DOM getter
    const el = window.__homesteadEl || (window.__homesteadEl = (id) => document.getElementById(id));

    // Load seed catalog safely even if seeds.js failed to register globals
    const seedsCatalog = Array.isArray(window.SEEDS) ? window.SEEDS : [];
    const SEED_BY_ID = (window.SEED_BY_ID && typeof window.SEED_BY_ID === 'object')
      ? window.SEED_BY_ID
      : (() => {
          const map = {};
          for (const seed of seedsCatalog) {
            map[seed.id] = seed;
          }
          return map;
        })();

    const ICONS = Object.freeze({
      gold: '🪙',
      wood: '🪵',
      stone: '🪨',
      eggs: '🥚',
      axe: '🪓',
      chainsaw: '🪚',
      tractor: '🚜',
      hoe: '⛏️',
      shed: '🛖',
      house: '🏠',
      chicken: '🐔',
      seed: '🌱',
      timer: '⏳',
      warning: '⚠️',
      broom: '🧹'
    });
    const $ = {
      version: el('version'), resources: el('resources'), log: el('log'), seedList: el('seedList'), cropList: el('cropList'),
      tabGame: el('tabGame'), tabMarket: el('tabMarket'), viewGame: el('viewGame'), viewMarket: el('viewMarket'),
      chopBtn: el('chopBtn'), chopBar: el('chopBar'), axeStatus: el('axeStatus'),
      forageBtn: el('forageBtn'), forageBar: el('forageBar'),
      seedSelect: el('seedSelect'), tillBtn: el('tillBtn'), plantBtn: el('plantBtn'), harvestBtn: el('harvestBtn'), gardenBar: el('gardenBar'), gardenStatus: el('gardenStatus'), veggiesReadyLine: el('veggiesReadyLine'),
      buyChickenBtn: el('buyChickenBtn'), collectEggsBtn: el('collectEggsBtn'), animalStatus: el('animalStatus'), eggsReadyLine: el('eggsReadyLine'),
      sellWoodBtn: el('sellWoodBtn'), sellStoneBtn: el('sellStoneBtn'), sellVegBtn: el('sellVegBtn'), sellEggBtn: el('sellEggBtn'),
      buyChainsawBtn: el('buyChainsawBtn'), buyTractorBtn: el('buyTractorBtn'), chainsawOwned: el('chainsawOwned'), tractorOwned: el('tractorOwned'),
      craftAxeBtn: el('craftAxeBtn'), craftHoeBtn: el('craftHoeBtn'), buildShedBtn: el('buildShedBtn'), buildHouseBtn: el('buildHouseBtn'),
      passiveList: el('passiveList'),
      saveBtn: el('saveBtn'), exportBtn: el('exportBtn'), importBtn: el('importBtn'), resetBtn: el('resetBtn'), autosaveToggle: el('autosaveToggle'), muteToggle: el('muteToggle'), resetCookiesBtn: el('resetCookiesBtn'), saveInfo: el('saveInfo'),
    };

    const state = {
      resources: {
        gold: 0,
        wood: 0, stone: 0, eggs: 0, veggies: 0,
        seeds: {},
        crops: {},
        tools: { axe:false, hoe:false, chainsaw:false, tractor:false }
      },
      garden: { tilled:false, planted:false, plantId:null, growProgress:0, growTime:20, task:null },
      animals: { chickens: 0, eggsReady: 0 },
      buildings: { shed:false, house:false },
      meta: { lastTick: Date.now(), lastSave: 0, autosave:true, muted:false, log: [] }
    };

    // Helpers
    function escapeHtml(text){
      if(!text) return '';
      return text.replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    }

    function log(message){
      const time = new Date().toLocaleTimeString();
      state.meta.log.unshift(`[${time}] ${message}`);
      state.meta.log = state.meta.log.slice(0, 200);
      if($.log){
        $.log.innerHTML = state.meta.log.map(entry => `<div>${escapeHtml(entry)}</div>`).join('');
        $.log.scrollTop = 0;
      }
    }

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const fmt = number => Math.floor(number).toLocaleString('nl-NL');

    function listPills(obj, dict, target){
      if(!target) return;
      const items = Object.entries(obj || {})
        .filter(([, qty]) => qty > 0)
        .sort((a, b) => (b[1] || 0) - (a[1] || 0));
      if(items.length === 0){
        target.innerHTML = '<span class="small">Nog geen voorraad</span>';
        return;
      }
      target.innerHTML = items.map(([id, qty]) => {
        const meta = dict[id] || { icon: ICONS.seed, name: id };
        return `<span class="pill">${meta.icon} ${escapeHtml(meta.name)}: <strong class="qty">${fmt(qty)}</strong></span>`;
      }).join('');
    }

    function renderSeedSelect(){
      if(!$.seedSelect) return;
      const owned = Object.entries(state.resources.seeds || {}).filter(([, qty]) => qty > 0);
      const current = $.seedSelect.value;
      const options = ['<option value="" disabled selected>Kies zaad...</option>'];
      for(const [id, qty] of owned){
        const meta = SEED_BY_ID[id];
        if(!meta) continue;
        options.push(`<option value="${id}">${meta.icon} ${escapeHtml(meta.name)} (x${qty})</option>`);
      }
      $.seedSelect.innerHTML = options.join('');
      if(current && state.resources.seeds[current] > 0){
        $.seedSelect.value = current;
      } else if($.seedSelect.options.length){
        $.seedSelect.selectedIndex = 0;
      }
    }

    const chopDuration = () => state.resources.tools.chainsaw ? 3 : 5;
    const tillDuration = () => state.resources.tools.tractor ? 2 : 4;
    const plantDuration = () => state.resources.tools.tractor ? 1 : 3;

    function render(){
      const r = state.resources;
      const g = state.garden;
      if($.resources){
        $.resources.innerHTML = `
        <span class="pill">${ICONS.gold} Munten: <strong class="qty">${fmt(r.gold)}</strong></span>
        <span class="pill">${ICONS.wood} Hout: <strong class="qty">${fmt(r.wood)}</strong></span>
        <span class="pill">${ICONS.stone} Steen: <strong class="qty">${fmt(r.stone)}</strong></span>
        <span class="pill">${ICONS.eggs} Eieren: <strong class="qty">${fmt(r.eggs)}</strong></span>
        <span class="pill">${ICONS.axe} Bijl: <strong>${r.tools.axe ? 'ja' : 'nee'}</strong></span>
        <span class="pill">${ICONS.chainsaw} Kettingzaag: <strong>${r.tools.chainsaw ? 'ja' : 'nee'}</strong></span>
        <span class="pill">${ICONS.tractor} Tractor: <strong>${r.tools.tractor ? 'ja' : 'nee'}</strong></span>
        <span class="pill">${ICONS.hoe} Schoffel: <strong>${r.tools.hoe ? 'ja' : 'nee'}</strong></span>
        <span class="pill">${ICONS.shed} Schuur: <strong>${state.buildings.shed ? 'ja' : 'nee'}</strong></span>
        <span class="pill">${ICONS.house} Huis: <strong>${state.buildings.house ? 'ja' : 'nee'}</strong></span>`;
      }

      listPills(r.seeds, SEED_BY_ID, $.seedList);
      const cropMeta = (() => {
        const out = {};
        for (const seed of seedsCatalog) {
          out[seed.id] = { icon: seed.icon, name: seed.crop };
        }
        return out;
      })();
      listPills(r.crops, cropMeta, $.cropList);

      if($.axeStatus) $.axeStatus.textContent = r.tools.chainsaw ? 'kettingzaag klaar' : (r.tools.axe ? 'bijl klaar' : 'geen bijl');
      if($.gardenStatus){
        const meta = g.plantId ? SEED_BY_ID[g.plantId] : null;
        let status = 'onbewerkt';
        if(g.planted && meta) status = `${meta.name} groeit...`;
        else if(g.task === 'till') status = 'grond losmaken...';
        else if(g.tilled) status = 'klaar om te zaaien';
        $.gardenStatus.textContent = status;
      }
      if($.veggiesReadyLine){
        $.veggiesReadyLine.textContent = `Groei: ${g.planted ? Math.floor(g.growProgress * 100) : 0}%`;
      }

      if($.harvestBtn) $.harvestBtn.disabled = !(g.planted && g.growProgress >= 1);
      if($.plantBtn) $.plantBtn.disabled = !g.tilled;

      if($.chainsawOwned) $.chainsawOwned.textContent = state.resources.tools.chainsaw ? ' (in bezit)' : '';
      if($.tractorOwned) $.tractorOwned.textContent = state.resources.tools.tractor ? ' (in bezit)' : '';
      if($.collectEggsBtn) $.collectEggsBtn.disabled = Math.floor(state.animals.eggsReady) <= 0;

      renderSeedSelect();

      if($.passiveList){
        const passive = [];
        if(state.resources.tools.chainsaw) passive.push(`${ICONS.chainsaw} +1 hout / 3s`);
        if(state.buildings.shed) passive.push(`${ICONS.shed} +10% hout uit hakken`);
        if(state.buildings.house) passive.push(`${ICONS.house} +1 groente / 30s`);
        if(state.animals.chickens > 0) passive.push(`${ICONS.chicken} ${state.animals.chickens} kip(pen): 1 ei / kip / 60s`);
        $.passiveList.innerHTML = passive.length ? passive.map(item => `<li>${item}</li>`).join('') : '<li class="small">Nog geen passieve productie</li>';
      }

      if($.saveInfo){
        $.saveInfo.textContent = state.meta.lastSave
          ? `Laatste save: ${new Date(state.meta.lastSave).toLocaleTimeString()}`
          : 'Nog niet opgeslagen';
      }

      if($.eggsReadyLine) $.eggsReadyLine.textContent = `Eieren klaar: ${Math.floor(state.animals.eggsReady)}`;
      if($.animalStatus) $.animalStatus.textContent = state.animals.chickens > 0 ? `${state.animals.chickens} kip(pen)` : 'geen dieren';
    }

    const timers = { chop: 0, forage: 0, gardenTask: null };

    function tick(dt){
      if(state.garden.planted){
        state.garden.growProgress = clamp(state.garden.growProgress + (dt / (state.garden.growTime || 20)), 0, 1);
        if($.gardenBar) $.gardenBar.style.width = (state.garden.growProgress * 100).toFixed(1) + '%';
      } else if(!timers.gardenTask && $.gardenBar){
        $.gardenBar.style.width = '0%';
      }

      if(state.animals.chickens > 0){
        state.animals.eggsReady += dt * (state.animals.chickens / 60);
      }
      if(state.buildings.house){
        state.resources.veggies += dt / 30;
      }
      if(state.resources.tools.chainsaw){
        state.resources.wood += dt / 3;
      }

      render();
    }

    function loop(){
      const now = Date.now();
      const dt = (now - state.meta.lastTick) / 1000;
      state.meta.lastTick = now;

      if(timers.chop > 0){
        timers.chop = clamp(timers.chop - dt, 0, 999);
        if($.chopBar){
          const progress = 1 - (timers.chop / chopDuration());
          $.chopBar.style.width = (progress * 100).toFixed(1) + '%';
        }
        if(timers.chop === 0){
          let base = 3;
          if(state.resources.tools.chainsaw) base = 20;
          else if(state.resources.tools.axe) base = 8;
          const bonus = state.buildings.shed ? base * 0.1 : 0;
          const gained = Math.round(base + bonus);
          state.resources.wood += gained;
          log(`${ICONS.wood} Je vond hout (+${gained}).`);
          render();
        }
      } else if($.chopBar){
        $.chopBar.style.width = '0%';
      }

      if(timers.forage > 0){
        timers.forage = clamp(timers.forage - dt, 0, 999);
        if($.forageBar){
          const progress = 1 - (timers.forage / 6);
          $.forageBar.style.width = (progress * 100).toFixed(1) + '%';
        }
        if(timers.forage === 0){
          const roll = Math.random();
          if(roll < 0.30){
            state.resources.stone += 1;
            log(`${ICONS.stone} Je vindt een losse steen (+1).`);
          } else if(roll < 0.60){
            const extra = 1 + Math.floor(Math.random() * 2);
            state.resources.wood += extra;
            log(`${ICONS.wood} Je raapt losse takken (+${extra} hout).`);
          } else if(roll < 0.90 && seedsCatalog.length){
            const seed = seedsCatalog[Math.floor(Math.random() * seedsCatalog.length)];
            state.resources.seeds[seed.id] = (state.resources.seeds[seed.id] || 0) + 1;
            log(`${seed.icon || ICONS.seed} Je vindt ${seed.name.toLowerCase()} (+1).`);
          } else {
            log(`${ICONS.timer} Je zoekt rond maar vindt niets.`);
          }
          render();
        }
      } else if($.forageBar){
        $.forageBar.style.width = '0%';
      }

      tick(dt);

      if(timers.gardenTask){
        timers.gardenTask.remaining = clamp(timers.gardenTask.remaining - dt, 0, timers.gardenTask.duration);
        if($.gardenBar){
          const progress = 1 - (timers.gardenTask.remaining / timers.gardenTask.duration);
          $.gardenBar.style.width = (progress * 100).toFixed(1) + '%';
        }
        if(timers.gardenTask.remaining === 0){
          const onDone = timers.gardenTask.onDone;
          timers.gardenTask = null;
          if(typeof onDone === 'function'){
            onDone();
          }
        }
      }

      requestAnimationFrame(loop);
    }

    function offline(){
      const now = Date.now();
      const last = state.meta.lastTick || now;
      const dt = Math.max(0, Math.min((now - last) / 1000, 60 * 60 * 12));
      if(dt > 2){
        const temp = JSON.parse(JSON.stringify(state));
        if(temp.animals.chickens > 0){
          temp.animals.eggsReady += dt * (temp.animals.chickens / 60);
        }
        if(temp.buildings.house){
          temp.resources.veggies += dt / 30;
        }
        if(temp.resources.tools && temp.resources.tools.chainsaw){
          temp.resources.wood += dt / 3;
        }
        const eggsGain = Math.floor(temp.animals.eggsReady) - Math.floor(state.animals.eggsReady);
        const vegGain = temp.resources.veggies - state.resources.veggies;
        const woodGain = Math.floor(temp.resources.wood - state.resources.wood);
        if(eggsGain > 0) state.resources.eggs += eggsGain;
        if(vegGain > 0) state.resources.veggies += vegGain;
        if(woodGain > 0) state.resources.wood += woodGain;
        log(`${ICONS.timer} Weg: ${Math.floor(dt / 60)} min -> +${Math.max(0, eggsGain)} eieren, +${Math.floor(Math.max(0, vegGain))} groente${woodGain > 0 ? `, +${woodGain} hout` : ''}.`);
      }
      state.meta.lastTick = now;
    }

    function showTab(which){
      [$.tabGame, $.tabMarket].forEach(btn => btn && btn.classList.remove('active'));
      [$.viewGame, $.viewMarket].forEach(view => view && view.classList.add('hidden'));
      if(which === 'market'){
        if($.tabMarket) $.tabMarket.classList.add('active');
        if($.viewMarket) $.viewMarket.classList.remove('hidden');
      } else {
        if($.tabGame) $.tabGame.classList.add('active');
        if($.viewGame) $.viewGame.classList.remove('hidden');
      }
    }

    if($.tabGame) $.tabGame.addEventListener('click', () => showTab('game'));
    if($.tabMarket) $.tabMarket.addEventListener('click', () => showTab('market'));

    if($.chopBtn) $.chopBtn.addEventListener('click', () => {
      if(timers.chop === 0){
        timers.chop = chopDuration();
        log(`${ICONS.wood} Zoeken naar hout...`);
      }
    });
    if($.forageBtn) $.forageBtn.addEventListener('click', () => {
      if(timers.forage === 0){
        timers.forage = 6;
        log(`${ICONS.seed} Je zoekt rond...`);
      }
    });

    if($.tillBtn) $.tillBtn.addEventListener('click', () => {
      if(!state.resources.tools.hoe) return warn('Je hebt een schoffel nodig.');
      if(state.garden.planted || state.garden.tilled) return warn('Tuin is al bezig of klaar om te zaaien.');
      if(timers.gardenTask) return warn('Tuinactie bezig.');
      const duration = tillDuration();
      state.garden.tilled = false;
      state.garden.task = 'till';
      log(`${ICONS.hoe} Je spit de moestuin om...`);
      timers.gardenTask = {
        type: 'till',
        duration,
        remaining: duration,
        onDone: () => {
          state.garden.tilled = true;
          state.garden.task = null;
          log('De aarde is losgemaakt.');
          render();
        }
      };
      render();
    });

    if($.plantBtn) $.plantBtn.addEventListener('click', () => {
      if(!state.garden.tilled) return warn('Eerst spitten.');
      const id = $.seedSelect && $.seedSelect.value;
      if(!id) return warn('Kies eerst een zaad.');
      if((state.resources.seeds[id] || 0) < 1) return warn('Je hebt dit zaad niet.');
      const meta = SEED_BY_ID[id];
      state.resources.seeds[id] -= 1;
      log(`${ICONS.seed} Je begint met zaaien...`);
      const duration = plantDuration();
      setTimeout(() => {
        state.garden.planted = true;
        state.garden.tilled = false;
        state.garden.plantId = id;
        state.garden.growProgress = 0;
        state.garden.growTime = meta ? meta.grow : 20;
        if(state.resources.tools.tractor){
          state.garden.growTime = Math.max(10, Math.round(state.garden.growTime * 0.85));
        }
        log(`${meta?.icon || ICONS.seed} Je zaait ${meta ? meta.name.toLowerCase() : 'gewas'} (x1).`);
        render();
      }, duration * 1000);
    });

    if($.harvestBtn) $.harvestBtn.addEventListener('click', () => {
      if(!(state.garden.planted && state.garden.growProgress >= 1)) return warn('Nog niet rijp.');
      const id = state.garden.plantId;
      const meta = SEED_BY_ID[id];
      if(!meta) return warn('Onbekend gewas.');
      const [minYield, maxYield] = meta.yield;
      let amount = Math.floor(minYield + Math.random() * (maxYield - minYield + 1));
      if(state.resources.tools.tractor){
        amount = Math.max(1, Math.floor(amount * 1.25));
      }
      state.resources.crops[id] = (state.resources.crops[id] || 0) + amount;
      if(id === 'basic'){
        state.resources.veggies = (state.resources.veggies || 0) + amount;
      }
      state.garden = { tilled:false, planted:false, plantId:null, growProgress:0, growTime:meta.grow, task:null };
      log(`${meta.icon || ICONS.seed} Je oogst ${meta.crop.toLowerCase()} (+${amount}).`);
      render();
    });

    if($.buyChickenBtn) $.buyChickenBtn.addEventListener('click', () => {
      if(state.resources.wood < 10 || state.resources.veggies < 5) return warn('Benodigd: 10 hout & 5 groente');
      state.resources.wood -= 10;
      state.resources.veggies -= 5;
      state.animals.chickens += 1;
      log(`${ICONS.chicken} Je koopt een kip.`);
      render();
    });

    if($.collectEggsBtn) $.collectEggsBtn.addEventListener('click', () => {
      const eggs = Math.floor(state.animals.eggsReady);
      if(eggs <= 0) return warn('Nog geen eieren.');
      state.animals.eggsReady -= eggs;
      state.resources.eggs += eggs;
      log(`${ICONS.eggs} Je verzamelt ${eggs} ei(eren).`);
      render();
    });

    if($.craftAxeBtn) $.craftAxeBtn.addEventListener('click', () => {
      if(state.resources.tools.axe) return warn('Je hebt al een bijl.');
      if(state.resources.wood < 15) return warn('Benodigd: 15 hout');
      state.resources.wood -= 15;
      state.resources.tools.axe = true;
      log(`${ICONS.axe} Bijl gemaakt!`);
      render();
    });

    if($.craftHoeBtn) $.craftHoeBtn.addEventListener('click', () => {
      if(state.resources.tools.hoe) return warn('Je hebt al een schoffel.');
      if(state.resources.wood < 10) return warn('Benodigd: 10 hout');
      state.resources.wood -= 10;
      state.resources.tools.hoe = true;
      log(`${ICONS.hoe} Schoffel gemaakt!`);
      render();
    });

    if($.buildShedBtn) $.buildShedBtn.addEventListener('click', () => {
      if(state.buildings.shed) return warn('Schuur bestaat al.');
      if(state.resources.wood < 50) return warn('Benodigd: 50 hout');
      state.resources.wood -= 50;
      state.buildings.shed = true;
      log(`${ICONS.shed} Schuur gebouwd! (+10% hout uit hakken)`);
      render();
    });

    if($.buildHouseBtn) $.buildHouseBtn.addEventListener('click', () => {
      if(state.buildings.house) return warn('Huis bestaat al.');
      if(state.resources.wood < 150) return warn('Benodigd: 150 hout');
      state.resources.wood -= 150;
      state.buildings.house = true;
      log(`${ICONS.house} Huis opgezet! (+1 groente/30s)`);
      render();
    });

    function totalCrops(){
      return Object.values(state.resources.crops || {}).reduce((sum, qty) => sum + (qty || 0), 0);
    }

    function removeCrops(amount){
      let need = amount;
      const entries = Object.entries(state.resources.crops || {}).sort((a, b) => {
        if(a[0] === 'basic' && b[0] !== 'basic') return -1;
        if(b[0] === 'basic' && a[0] !== 'basic') return 1;
        return (b[1] || 0) - (a[1] || 0);
      });
      for(const [id, qty] of entries){
        if(need <= 0) break;
        const take = Math.min(qty || 0, need);
        if(take > 0){
          state.resources.crops[id] -= take;
          need -= take;
        }
      }
      return amount - need;
    }

    function sellCrops(count, price){
      const available = totalCrops() + (state.resources.veggies || 0);
      if(available < count) return warn(`Je hebt niet genoeg groenten om ${count} te verkopen.`);
      let removed = removeCrops(count);
      if(removed < count){
        const rest = Math.min(count - removed, state.resources.veggies || 0);
        state.resources.veggies -= rest;
        removed += rest;
      }
      if(removed > 0){
        state.resources.gold += price;
        log(`${ICONS.gold} Je verkoopt ${count} groenten voor ${price} munten.`);
        render();
      }
    }

    if($.sellWoodBtn) $.sellWoodBtn.addEventListener('click', () => {
      if(state.resources.wood < 10) return warn('Je hebt 10 hout nodig.');
      state.resources.wood -= 10;
      state.resources.gold += 5;
      log(`${ICONS.gold} Je verkoopt 10 hout voor 5 munten.`);
      render();
    });

    if($.sellStoneBtn) $.sellStoneBtn.addEventListener('click', () => {
      if(state.resources.stone < 5) return warn('Je hebt 5 steen nodig.');
      state.resources.stone -= 5;
      state.resources.gold += 7;
      log(`${ICONS.gold} Je verkoopt 5 steen voor 7 munten.`);
      render();
    });

    if($.sellVegBtn) $.sellVegBtn.addEventListener('click', () => sellCrops(5, 10));

    if($.sellEggBtn) $.sellEggBtn.addEventListener('click', () => {
      if(state.resources.eggs < 5) return warn('Je hebt 5 eieren nodig.');
      state.resources.eggs -= 5;
      state.resources.gold += 8;
      log(`${ICONS.gold} Je verkoopt 5 eieren voor 8 munten.`);
      render();
    });

    if($.buyChainsawBtn) $.buyChainsawBtn.addEventListener('click', () => {
      if(state.resources.tools.chainsaw) return warn('Je hebt al een kettingzaag.');
      if(state.resources.gold < 150) return warn('Benodigd: 150 munten');
      state.resources.gold -= 150;
      state.resources.tools.chainsaw = true;
      log(`${ICONS.chainsaw} Je koopt een kettingzaag! Hout gaat nu veel sneller en komt nu ook passief binnen.`);
      render();
    });

    if($.buyTractorBtn) $.buyTractorBtn.addEventListener('click', () => {
      if(state.resources.tools.tractor) return warn('Je hebt al een tractor.');
      if(state.resources.gold < 300) return warn('Benodigd: 300 munten');
      state.resources.gold -= 300;
      state.resources.tools.tractor = true;
      log(`${ICONS.tractor} Je koopt een tractor! Moestuin taken worden sneller en opbrengst hoger.`);
      render();
    });

    function save(){
      try{
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        state.meta.lastSave = Date.now();
        render();
      } catch(err){
        console.warn('Kon save niet opslaan', err);
      }
    }

    function deepMerge(target, source){
      for(const key of Object.keys(source || {})){
        const value = source[key];
        if(value && typeof value === 'object' && !Array.isArray(value)){
          if(!target[key] || typeof target[key] !== 'object') target[key] = {};
          deepMerge(target[key], value);
        } else {
          target[key] = value;
        }
      }
      return target;
    }

    function migrate(){
      if(typeof state.resources.seeds === 'number'){
        state.resources.seeds = { basic: state.resources.seeds };
      }
      if(!state.resources.crops) state.resources.crops = {};
      if(!state.resources.tools) state.resources.tools = { axe:false, hoe:false, chainsaw:false, tractor:false };
      if(state.resources.tools.pick) delete state.resources.tools.pick;
      if(!state.garden) state.garden = { tilled:false, planted:false, plantId:null, growProgress:0, growTime:20, task:null };
      if(state.garden && state.garden.growTime == null) state.garden.growTime = 20;
      if(state.garden && typeof state.garden.task === 'undefined') state.garden.task = null;
      if(state.garden && state.garden.plantId && !SEED_BY_ID[state.garden.plantId]){
        state.garden.plantId = 'basic';
      }
      if(typeof state.resources.gold !== 'number') state.resources.gold = 0;
    }

    function load(){
      const raw = localStorage.getItem(SAVE_KEY);
      if(!raw) return;
      try{
        const data = JSON.parse(raw);
        deepMerge(state, data);
        migrate();
      } catch(err){
        console.warn('Kon save niet lezen', err);
      }
    }

    if($.saveBtn) $.saveBtn.addEventListener('click', () => { save(); toast('Opgeslagen.'); });
    if($.exportBtn) $.exportBtn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'homestead-save.json';
      link.click();
      URL.revokeObjectURL(url);
    });
    if($.importBtn) $.importBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = () => {
        const file = input.files && input.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try{
            const data = JSON.parse(reader.result);
            deepMerge(state, data);
            migrate();
            save();
            render();
            log('Save import voltooid.');
          } catch(err){
            warn('Kon save niet importeren.');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });
    if($.resetBtn) $.resetBtn.addEventListener('click', () => {
      if(confirm('Weet je zeker dat je opnieuw wilt beginnen?')){
        localStorage.removeItem(SAVE_KEY);
        location.reload();
      }
    });

    if($.autosaveToggle) $.autosaveToggle.addEventListener('change', (event) => {
      state.meta.autosave = !!event.target.checked;
    });
    if($.muteToggle) $.muteToggle.addEventListener('change', (event) => {
      state.meta.muted = !!event.target.checked;
    });
    if($.resetCookiesBtn) $.resetCookiesBtn.addEventListener('click', () => {
      if(confirm('Cookies wissen? Dit verwijdert websitecookies voor dit spel.')){
        clearCookies();
      }
    });


    function toast(text){
      const pane = document.createElement('div');
      pane.textContent = text;
      pane.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#1f2937;border:1px solid #334155;padding:10px 12px;border-radius:10px;color:#e5e7eb;box-shadow:0 10px 30px rgba(0,0,0,.35);z-index:9999;';
      document.body.appendChild(pane);
      setTimeout(() => { pane.style.opacity = '0'; pane.style.transition = 'opacity .4s'; }, 1600);
      setTimeout(() => pane.remove(), 2100);
    }

    function clearCookies(){
      const source = document.cookie;
      if(!source){
        toast('Geen cookies gevonden.');
        log(`${ICONS.warning} Geen cookies gevonden.`);
        return;
      }
      const cookies = source.split(';');
      let cleared = 0;
      cookies.forEach(entry => {
        const eq = entry.indexOf('=');
        const name = (eq > -1 ? entry.slice(0, eq) : entry).trim();
        if(!name) return;
        const expires = 'Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = `${name}=;expires=${expires};path=/`;
        if(location.hostname){
          document.cookie = `${name}=;expires=${expires};path=/;domain=${location.hostname}`;
        }
        cleared += 1;
      });
      if(cleared === 0){
        toast('Geen cookies gevonden.');
        log(`${ICONS.warning} Geen cookies gevonden.`);
        return;
      }
      toast('Cookies gewist.');
      log(`${ICONS.broom} Cookies gewist.`);
    }

    function warn(msg){
      toast(msg);
      log(`${ICONS.warning} ${msg}`);
    }

    window.addEventListener('error', (event) => {
      try{
        log(`${ICONS.warning} Scriptfout: ${(event.message || event.error || 'onbekend')}`);
      } catch(_){}
    });

    function boot(){
      if($.version) $.version.textContent = 'v' + VERSION;
      load();
      offline();
      render();
      loop();
      if(state.meta.autosave){
        setInterval(() => {
          if(state.meta.autosave) save();
        }, 10000);
      }
      window.addEventListener('beforeunload', save);
    }

    boot();
})();





















