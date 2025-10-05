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
      sellWoodRange: el('sellWoodRange'), sellStoneRange: el('sellStoneRange'), sellVegRange: el('sellVegRange'), sellEggRange: el('sellEggRange'),
      sellWoodCount: el('sellWoodCount'), sellStoneCount: el('sellStoneCount'), sellVegCount: el('sellVegCount'), sellEggCount: el('sellEggCount'),
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
      meta: { lastTick: Date.now(), lastSave: 0, autosave:true, muted:false, lastInventoryWarn:0, log: [] }
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

    const inventoryCapacity = () => state.buildings.house ? 5000 : (state.buildings.shed ? 500 : 200);

    function sumValues(obj = {}, filter) {
      if(typeof obj !== 'object' || !obj) return 0;
      const shouldInclude = typeof filter === 'function' ? filter : (() => true);
      return Object.entries(obj).reduce((sum, [key, qty]) => sum + (shouldInclude(key) ? (qty || 0) : 0), 0);
    }

    function inventoryUsage(){
      const r = state.resources;
      const veggies = Math.max(r.veggies || 0, (r.crops && r.crops.basic) || 0);
      const otherCrops = sumValues(r.crops, key => key !== 'basic');
      const seeds = sumValues(r.seeds);
      return (r.wood || 0) + (r.stone || 0) + (r.eggs || 0) + veggies + otherCrops + seeds;
    }

    function availableInventorySpace(){
      return inventoryCapacity() - inventoryUsage();
    }

    function warnInventoryFull(){
      const now = Date.now();
      if(now - (state.meta.lastInventoryWarn || 0) < 2000) return;
      state.meta.lastInventoryWarn = now;
      warn('Opslag zit vol.');
    }

    function reserveInventory(amount, opts = {}){
      if(amount <= 0) return 0;
      const available = availableInventorySpace();
      const allowed = Math.max(0, Math.min(amount, available));
      if(amount > 0 && allowed < amount && !opts.silent){
        warnInventoryFull();
      }
      return allowed;
    }


    const SELL_INFO = Object.freeze({
      wood: { rate: 0.5, label: 'hout' },
      stone: { rate: 7/5, label: 'steen' },
      veggies: { rate: 2, label: 'groenten' },
      eggs: { rate: 8/5, label: 'eieren' }
    });

    function addInventoryResource(key, amount, opts){
      const allowed = reserveInventory(amount, opts);
      if(allowed <= 0) return 0;
      state.resources[key] = (state.resources[key] || 0) + allowed;
      return allowed;
    }


    function updateSellControls(){
      if(!$.sellWoodRange && !$.sellStoneRange && !$.sellVegRange && !$.sellEggRange) return;
      const configs = [
        { key:'wood', range: $.sellWoodRange, count: $.sellWoodCount, button: $.sellWoodBtn, max: () => Math.max(0, Math.floor(state.resources.wood || 0)) },
        { key:'stone', range: $.sellStoneRange, count: $.sellStoneCount, button: $.sellStoneBtn, max: () => Math.max(0, Math.floor(state.resources.stone || 0)) },
        { key:'veggies', range: $.sellVegRange, count: $.sellVegCount, button: $.sellVegBtn, max: () => Math.max(0, Math.floor(totalCrops() + (state.resources.veggies || 0))) },
        { key:'eggs', range: $.sellEggRange, count: $.sellEggCount, button: $.sellEggBtn, max: () => Math.max(0, Math.floor(state.resources.eggs || 0)) },
      ];
      configs.forEach(cfg => {
        const info = SELL_INFO[cfg.key];
        if(!info) return;
        const slider = cfg.range;
        const button = cfg.button;
        const counter = cfg.count;
        if(!slider || !button || !counter) return;
        const max = cfg.max();
        slider.max = String(max);
        if(max <= 0){
          slider.value = '0';
          slider.disabled = true;
          slider.dataset.prevMax = '0';
        } else {
          slider.disabled = false;
          const prevMax = Number(slider.dataset.prevMax || '0');
          let current = Math.max(0, Math.floor(Number(slider.value) || 0));
          if(prevMax <= 0 && current === 0){
            current = max;
          }
          slider.value = String(Math.min(current, max));
          slider.dataset.prevMax = String(max);
        }
        const amount = max <= 0 ? 0 : Math.max(0, Math.min(max, Math.floor(Number(slider.value) || 0)));
        counter.textContent = `${amount} / ${max}`;
        const coins = amount > 0 ? Math.floor(amount * info.rate) : 0;
        button.textContent = `Verkoop ${info.label} (+${coins} munten)`;
        button.disabled = amount <= 0 || coins <= 0;
      });
    }

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
        const capacity = inventoryCapacity();
        const usedStorage = Math.max(0, Math.floor(inventoryUsage()));
        const storageNote = usedStorage >= capacity ? ' (vol)' : '';
        $.resources.innerHTML = `
        <span class="pill">${ICONS.gold} Munten: <strong class="qty">${fmt(r.gold)}</strong></span>
        <span class="pill">${ICONS.wood} Hout: <strong class="qty">${fmt(r.wood)}</strong></span>
        <span class="pill">${ICONS.stone} Steen: <strong class="qty">${fmt(r.stone)}</strong></span>
        <span class="pill">${ICONS.eggs} Eieren: <strong class="qty">${fmt(r.eggs)}</strong></span>
        <span class="pill">${ICONS.seed} Groente: <strong class="qty">${fmt(r.veggies || 0)}</strong></span>
        <span class="pill">Opslag: <strong class="qty">${fmt(usedStorage)}</strong> / ${fmt(capacity)}${storageNote}</span>
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
      updateSellControls();

      if($.passiveList){
        const passive = [];
        if(state.resources.tools.chainsaw) passive.push(`${ICONS.chainsaw} +1 hout / 3s`);
        if(state.resources.tools.tractor) passive.push(`${ICONS.tractor} +1 groente / 30s (moestuintaken sneller)`);
        if(state.animals.chickens > 0) passive.push(`${ICONS.chicken} ${state.animals.chickens} kip(pen): 1 ei / kip / 60s`);
        $.passiveList.innerHTML = passive.length ? passive.map(item => `<li>${item}</li>`).join('') : '<li class="small">Nog geen passieve bonussen</li>';
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
      if(state.resources.tools.tractor){
        addInventoryResource('veggies', dt / 30, { silent:true });
      }
      if(state.resources.tools.chainsaw){
        addInventoryResource('wood', dt / 3, { silent:true });
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
          const stored = addInventoryResource('wood', gained);
          if(stored > 0){
            const note = stored < gained ? ' (opslag vol, rest blijft liggen)' : '';
            log(`${ICONS.wood} Je vond hout (+${stored})${note}.`);
          } else {
            log(`${ICONS.warning} Geen ruimte voor hout; je laat de vondst liggen.`);
          }
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
            const storedStone = addInventoryResource('stone', 1);
            if(storedStone > 0){
              log(`${ICONS.stone} Je vindt een losse steen (+${storedStone}).`);
            } else {
              log(`${ICONS.warning} Geen ruimte voor stenen; je laat deze liggen.`);
            }
          } else if(roll < 0.60){
            const extra = 1 + Math.floor(Math.random() * 2);
            const storedWood = addInventoryResource('wood', extra);
            if(storedWood > 0){
              const note = storedWood < extra ? ' (opslag vol, rest blijft liggen)' : '';
              log(`${ICONS.wood} Je raapt losse takken (+${storedWood} hout)${note}.`);
            } else {
              log(`${ICONS.warning} Geen ruimte voor extra hout; je laat de takken liggen.`);
            }
          } else if(roll < 0.90 && seedsCatalog.length){
            const seed = seedsCatalog[Math.floor(Math.random() * seedsCatalog.length)];
            const storedSeed = reserveInventory(1);
            if(storedSeed > 0){
              state.resources.seeds[seed.id] = (state.resources.seeds[seed.id] || 0) + storedSeed;
              log(`${seed.icon || ICONS.seed} Je vindt ${seed.name.toLowerCase()} (+${storedSeed}).`);
            } else {
              log(`${ICONS.warning} Geen ruimte voor ${seed.name.toLowerCase()}-zaad; je laat het liggen.`);
            }
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
        if(temp.resources.tools && temp.resources.tools.tractor){
          temp.resources.veggies += dt / 30;
        }
        if(temp.resources.tools && temp.resources.tools.chainsaw){
          temp.resources.wood += dt / 3;
        }
        const eggsGain = Math.floor(temp.animals.eggsReady) - Math.floor(state.animals.eggsReady);
        const vegGain = temp.resources.veggies - state.resources.veggies;
        const woodGain = Math.floor(temp.resources.wood - state.resources.wood);
        const eggsStored = eggsGain > 0 ? addInventoryResource('eggs', eggsGain, { silent:true }) : 0;
        const vegStored = vegGain > 0 ? addInventoryResource('veggies', vegGain, { silent:true }) : 0;
        const woodStored = woodGain > 0 ? addInventoryResource('wood', woodGain, { silent:true }) : 0;
        const eggsLost = Math.max(0, eggsGain - eggsStored);
        const vegLost = Math.max(0, vegGain - vegStored);
        const woodLost = Math.max(0, woodGain - woodStored);
        if(eggsStored > 0 || vegStored > 0 || woodStored > 0){
          const eggText = eggsStored > 0 ? `+${eggsStored} eieren` : null;
          const vegText = vegStored > 0 ? `+${Math.floor(vegStored)} groente` : null;
          const woodText = woodStored > 0 ? `+${woodStored} hout` : null;
          const parts = [eggText, vegText, woodText].filter(Boolean);
          log(`${ICONS.timer} Weg: ${Math.floor(dt / 60)} min -> ${parts.join(', ')}${(eggsLost || vegLost || woodLost) ? ' (opslag vol, rest gemist)' : ''}.`);
        } else if(eggsLost > 0 || vegLost > 0 || woodLost > 0){
          log(`${ICONS.timer} Weg: ${Math.floor(dt / 60)} min -> opslag vol, niets meegenomen.`);
        }
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

    [$.sellWoodRange, $.sellStoneRange, $.sellVegRange, $.sellEggRange].forEach(range => {
      if(range) range.addEventListener('input', updateSellControls);
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
      const stored = reserveInventory(amount);
      if(stored <= 0){
        warn('Geen opslagruimte voor de oogst. Maak ruimte vrij en probeer opnieuw.');
        return;
      }
      state.resources.crops[id] = (state.resources.crops[id] || 0) + stored;
      if(id === 'basic'){
        state.resources.veggies = (state.resources.veggies || 0) + stored;
      }
      state.garden = { tilled:false, planted:false, plantId:null, growProgress:0, growTime:meta.grow, task:null };
      const note = stored < amount ? ' (opslag vol, rest blijft achter)' : '';
      log(`${meta?.icon || ICONS.seed} Je oogst ${meta?.crop.toLowerCase() || 'gewas'} (+${stored})${note}.`);
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
      const stored = addInventoryResource('eggs', eggs);
      if(stored <= 0) return;
      state.animals.eggsReady -= stored;
      const note = stored < eggs ? ' (opslag vol, rest blijft in het hok)' : '';
      log(`${ICONS.eggs} Je verzamelt ${stored} ei(eren)${note}.`);
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
      log(`${ICONS.shed} Schuur gebouwd! (+10% hout uit hakken, opslag tot 500).`);
      render();
    });

    if($.buildHouseBtn) $.buildHouseBtn.addEventListener('click', () => {
      if(state.buildings.house) return warn('Huis bestaat al.');
      if(state.resources.wood < 150) return warn('Benodigd: 150 hout');
      state.resources.wood -= 150;
      state.buildings.house = true;
      log(`${ICONS.house} Huis opgezet! Opslaglimiet verhoogd naar 5000.`);
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
      const slider = $.sellWoodRange;
      const amount = slider ? Math.min(Math.floor(Number(slider.value) || 0), Math.floor(state.resources.wood || 0)) : 0;
      if(amount <= 0) return warn('Kies eerst een hoeveelheid hout.');
      const coins = Math.floor(amount * SELL_INFO.wood.rate);
      if(coins <= 0) return warn('Deze hoeveelheid levert niets op.');
      state.resources.wood -= amount;
      state.resources.gold += coins;
      log(`${ICONS.gold} Je verkoopt ${amount} hout voor ${coins} munten.`);
      render();
    });

    if($.sellStoneBtn) $.sellStoneBtn.addEventListener('click', () => {
      const slider = $.sellStoneRange;
      const amount = slider ? Math.min(Math.floor(Number(slider.value) || 0), Math.floor(state.resources.stone || 0)) : 0;
      if(amount <= 0) return warn('Kies eerst een hoeveelheid steen.');
      const coins = Math.floor(amount * SELL_INFO.stone.rate);
      if(coins <= 0) return warn('Deze hoeveelheid levert niets op.');
      state.resources.stone -= amount;
      state.resources.gold += coins;
      log(`${ICONS.gold} Je verkoopt ${amount} steen voor ${coins} munten.`);
      render();
    });

    if($.sellVegBtn) $.sellVegBtn.addEventListener('click', () => {
      const slider = $.sellVegRange;
      const available = totalCrops() + (state.resources.veggies || 0);
      const amount = slider ? Math.min(Math.floor(Number(slider.value) || 0), Math.floor(available)) : 0;
      if(amount <= 0) return warn('Kies eerst een hoeveelheid groenten.');
      const coins = Math.floor(amount * SELL_INFO.veggies.rate);
      if(coins <= 0) return warn('Deze hoeveelheid levert niets op.');
      sellCrops(amount, coins);
    });

    if($.sellEggBtn) $.sellEggBtn.addEventListener('click', () => {
      const slider = $.sellEggRange;
      const amount = slider ? Math.min(Math.floor(Number(slider.value) || 0), Math.floor(state.resources.eggs || 0)) : 0;
      if(amount <= 0) return warn('Kies eerst een hoeveelheid eieren.');
      const coins = Math.floor(amount * SELL_INFO.eggs.rate);
      if(coins <= 0) return warn('Deze hoeveelheid levert niets op.');
      state.resources.eggs -= amount;
      state.resources.gold += coins;
      log(`${ICONS.gold} Je verkoopt ${amount} eieren voor ${coins} munten.`);
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
      log(`${ICONS.tractor} Je koopt een tractor! Moestuintaken worden sneller, opbrengst hoger en +1 groente / 30s.`);
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
      if(!state.meta){
        state.meta = { lastTick: Date.now(), lastSave: 0, autosave:true, muted:false, lastInventoryWarn:0, log: [] };
      } else if(typeof state.meta.lastInventoryWarn !== 'number'){
        state.meta.lastInventoryWarn = 0;
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





















