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

    const ICONS = {
      gold: '&#x1F4B0;',
      wood: '&#x1F333;',
      stone: '&#x26CF;',
      eggs: '&#x1F95A;',
      axe: '&#x2692;',
      chainsaw: '&#x2699;',
      trekker: '&#x1F69C;',
      hoe: '&#x1F6E0;',
      shed: '&#x1F3E0;',
      silo: '&#x1F3E2;',
      house: '&#x1F3E1;',
      chicken: '&#x1F414;',
      seed: '&#x1F331;',
      metal: '&#x1F529;',
      brick: '&#x1F9F1;',
      glass: '&#x1FA9F;',
      timer: '&#x23F2;',
      warning: '&#x26A0;',
      broom: '&#x2728;'
    };
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
      buyChainsawBtn: el('buyChainsawBtn'), buyTrekkerBtn: el('buyTrekkerBtn'), buyMetalBtn: el('buyMetalBtn'), buyBrickBtn: el('buyBrickBtn'), buyGlassBtn: el('buyGlassBtn'), chainsawOwned: el('chainsawOwned'), trekkerOwned: el('trekkerOwned'),
      craftAxeBtn: el('craftAxeBtn'), craftHoeBtn: el('craftHoeBtn'), buildShedBtn: el('buildShedBtn'), buildSiloBtn: el('buildSiloBtn'), buildHouseBtn: el('buildHouseBtn'),
      passiveList: el('passiveList'), dlcList: el('dlcList'),
      saveBtn: el('saveBtn'), exportBtn: el('exportBtn'), importBtn: el('importBtn'), resetBtn: el('resetBtn'), autosaveToggle: el('autosaveToggle'), muteToggle: el('muteToggle'), resetGameBtn: el('resetGameBtn'), saveInfo: el('saveInfo'),
    };

    const state = {
      resources: {
        gold: 0,
        wood: 0, stone: 0, eggs: 0, veggies: 0, milk: 0, pork: 0, metalPlates: 0, bricks: 0, glass: 0,
        seeds: {},
        crops: {},
        tools: { axe:false, hoe:false, chainsaw:false, trekker:false }
      },
      garden: { tilled:false, planted:false, plantId:null, growProgress:0, growTime:20, task:null },
      animals: { chickens: 0, eggsReady: 0 },
      buildings: { sheds: 0, silos: 0, house:false },
      meta: { lastTick: Date.now(), lastSave: 0, autosave:true, muted:false, lastInventoryWarn:0, lastSiloWarn:0, modules:{}, log: [] }
    };

    let autosaveTimer = null;

    // Helpers
    function escapeHtml(text){
      if(!text) return '';
      return text.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
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

    const MAX_SHEDS = 5;
    const MAX_SILOS = 2;
    const SHED_WOOD_COST = 50;
    const SHED_METAL_COST = 5;
    const SILO_WOOD_COST = 200;
    const SILO_METAL_COST = 8;
    const HOUSE_WOOD_COST = 150;
    const HOUSE_BRICK_COST = 40;
    const HOUSE_GLASS_COST = 20;

    const inventoryCapacity = () => {
      if(state.buildings.house) return 5000;
      const sheds = state.buildings.sheds || 0;
      return 200 + Math.max(0, Math.min(MAX_SHEDS, sheds)) * 300;
    };

    const veggieCapacity = () => {
      const silos = Math.max(0, Math.min(MAX_SILOS, state.buildings.silos || 0));
      if(silos === 0) return 50;
      if(silos === 1) return 200;
      return 250;
    };

    const DLC_REGISTRY = Array.isArray(window.__HOMESTEAD_DLC_MODULES) ? window.__HOMESTEAD_DLC_MODULES.slice() : [];
    const moduleEntries = new Map();
    let moduleRenderHooks = [];
    let moduleTickHooks = [];

    function createModuleContext(entry){
      const cleanup = [];
      const ctx = {
        id: entry.def.id,
        state,
        ICONS,
        icons: ICONS,
        fmt,
        clamp,
        log,
        document,
        root: document.body,
        $,
        registerIcon(key, value){ if(key && value) ICONS[key] = value; },
        addCleanup(fn){ if(typeof fn === 'function') cleanup.push(fn); },
        addInventoryResource: (key, amount, opts) => addInventoryResource(key, amount, opts),
        reserveInventory: (amount, opts) => reserveInventory(amount, opts),
        render: () => render(),
        warn,
        toast,
        warnInventoryFull,
        warnSiloFull
      };
      Object.defineProperty(ctx, '_cleanup', { value: cleanup });
      return ctx;
    }

    function runModuleCleanup(entry){
      const cleanup = entry.ctx && entry.ctx._cleanup;
      if(Array.isArray(cleanup)){
        while(cleanup.length){
          const fn = cleanup.pop();
          try{ fn(); } catch(err){ console.warn(`[DLC:${entry.def.id}] cleanup faalde`, err); }
        }
      }
    }

    function setupModulesRegistry(){
      if(!state.meta.modules || typeof state.meta.modules !== 'object') state.meta.modules = {};
      DLC_REGISTRY.forEach(def => {
        const stored = Object.prototype.hasOwnProperty.call(state.meta.modules, def.id)
          ? !!state.meta.modules[def.id]
          : def.defaultEnabled !== false;
        state.meta.modules[def.id] = stored;
        moduleEntries.set(def.id, { def, enabled: stored, ctx: null, resetHook: null, teardownHook: null });
      });
    }

    function activateModule(id, opts = {}){
      const entry = moduleEntries.get(id);
      if(!entry || entry.enabled) return;
      entry.enabled = true;
      state.meta.modules[id] = true;
      const ctx = createModuleContext(entry);
      entry.ctx = ctx;
      try{
        if(entry.def.registerIcon) entry.def.registerIcon(ctx);
      } catch(err){
        console.warn(`[DLC:${id}] registerIcon faalde`, err);
      }
      try{
        if(entry.def.hooks && typeof entry.def.hooks.init === 'function') entry.def.hooks.init(ctx);
      } catch(err){
        console.error(`[DLC:${id}] init faalde`, err);
      }
      if(entry.def.hooks){
        if(typeof entry.def.hooks.render === 'function'){
          moduleRenderHooks.push({ id, run: () => {
            try { entry.def.hooks.render(ctx); } catch(err){ console.error(`[DLC:${id}] render faalde`, err); }
          }});
        }
        if(typeof entry.def.hooks.tick === 'function'){
          moduleTickHooks.push({ id, run: (dt) => {
            try { entry.def.hooks.tick(ctx, dt); } catch(err){ console.error(`[DLC:${id}] tick faalde`, err); }
          }});
        }
        if(typeof entry.def.hooks.reset === 'function'){
          entry.resetHook = (options) => {
            try { entry.def.hooks.reset(ctx, options); } catch(err){ console.error(`[DLC:${id}] reset faalde`, err); }
          };
        } else {
          entry.resetHook = null;
        }
        entry.teardownHook = (typeof entry.def.hooks.teardown === 'function') ? entry.def.hooks.teardown : null;
      }
      if(!opts.silent) render();
    }

    function deactivateModule(id, opts = {}){
      const entry = moduleEntries.get(id);
      if(!entry || !entry.enabled) return;
      entry.enabled = false;
      state.meta.modules[id] = false;
      moduleRenderHooks = moduleRenderHooks.filter(h => h.id !== id);
      moduleTickHooks = moduleTickHooks.filter(h => h.id !== id);
      if(entry.teardownHook){
        try { entry.teardownHook(entry.ctx); } catch(err){ console.error(`[DLC:${id}] teardown faalde`, err); }
      }
      runModuleCleanup(entry);
      entry.ctx = null;
      entry.resetHook = null;
      entry.teardownHook = null;
      if(!opts.silent) render();
    }

    function handleDlcToggle(event){
      const target = event.target;
      if(!target || target.type !== 'checkbox') return;
      const id = target.getAttribute('data-dlc-id');
      if(!id) return;
      if(target.checked){
        activateModule(id);
      } else {
        deactivateModule(id);
      }
    }

    function renderModuleList(){
      if(!$.dlcList) return;
      if(moduleEntries.size === 0){
        $.dlcList.innerHTML = '<p class="small">Geen modules gevonden.</p>';
        return;
      }
      const fragments = [];
      moduleEntries.forEach(entry => {
        const def = entry.def;
        const version = def.version ? ` <span class="tiny">v${escapeHtml(def.version)}</span>` : '';
        const description = def.description ? `<div class="tiny">${escapeHtml(def.description)}</div>` : '';
        fragments.push(`<label class="small"><input type="checkbox" data-dlc-id="${escapeHtml(def.id)}"${entry.enabled ? ' checked' : ''}> ${escapeHtml(def.name || def.id)}${version}${description}</label>`);
      });
      const html = fragments.join('');
      if($.dlcList.__lastHtml !== html){
        $.dlcList.innerHTML = html;
        $.dlcList.__lastHtml = html;
      }
    }

    function applyInitialModules(){
      moduleEntries.forEach((entry, id) => {
        if(entry.enabled){
          activateModule(id, { silent:true });
        }
      });
    }

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
      const materials = (r.metalPlates || 0) + (r.bricks || 0) + (r.glass || 0);
      const livestockGoods = (r.milk || 0) + (r.pork || 0);
      return (r.wood || 0) + (r.stone || 0) + (r.eggs || 0) + veggies + otherCrops + seeds + materials + livestockGoods;
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

    function warnSiloFull(){
      const now = Date.now();
      if(now - (state.meta.lastSiloWarn || 0) < 2000) return;
      state.meta.lastSiloWarn = now;
      warn('Silo zit vol.');
    }

    function reserveInventory(amount, opts = {}){
      if(amount <= 0) return 0;
      const available = availableInventorySpace();
      let allowed = Math.max(0, Math.min(amount, available));
      let cappedBySilo = false;
      if(opts.key === 'veggies'){
        const capacityLeft = Math.max(0, veggieCapacity() - (state.resources.veggies || 0));
        if(capacityLeft < allowed){
          allowed = capacityLeft;
        }
        if(capacityLeft < amount){
          cappedBySilo = true;
        }
      }
      if(amount > 0 && allowed < amount && !opts.silent){
        if(opts.key === 'veggies' && cappedBySilo) warnSiloFull();
        else warnInventoryFull();
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
      const options = Object.assign({}, opts, { key });
      const allowed = reserveInventory(amount, options);
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
    const tillDuration = () => state.resources.tools.trekker ? 2 : 4;
    const plantDuration = () => state.resources.tools.trekker ? 1 : 3;

    function render(){
      const r = state.resources;
      const g = state.garden;
      const vegCap = veggieCapacity();
      const sheds = state.buildings.sheds || 0;
      const silos = state.buildings.silos || 0;
      if($.resources){
        const capacity = inventoryCapacity();
        const usedStorage = Math.max(0, Math.floor(inventoryUsage()));
        const storageNote = usedStorage >= capacity ? ' (vol)' : '';
        const vegTotal = Math.floor(r.veggies || 0);
        $.resources.innerHTML = `
        <span class="pill">${ICONS.gold} Munten: <strong class="qty">${fmt(r.gold)}</strong></span>
        <span class="pill">${ICONS.wood} Hout: <strong class="qty">${fmt(r.wood)}</strong></span>
        <span class="pill">${ICONS.stone} Steen: <strong class="qty">${fmt(r.stone)}</strong></span>
        <span class="pill">${ICONS.eggs} Eieren: <strong class="qty">${fmt(r.eggs)}</strong></span>
        <span class="pill">${ICONS.metal} Metalen platen: <strong class="qty">${fmt(r.metalPlates || 0)}</strong></span>
        <span class="pill">${ICONS.brick} Bakstenen: <strong class="qty">${fmt(r.bricks || 0)}</strong></span>
        <span class="pill">${ICONS.glass} Glas: <strong class="qty">${fmt(r.glass || 0)}</strong></span>
        <span class="pill">${ICONS.seed} Groente: <strong class="qty">${fmt(vegTotal)}</strong> / ${fmt(vegCap)}</span>
        <span class="pill">Opslag: <strong class="qty">${fmt(usedStorage)}</strong> / ${fmt(capacity)}${storageNote}</span>
        <span class="pill">${ICONS.axe} Bijl: <strong>${r.tools.axe ? 'ja' : 'nee'}</strong></span>
        <span class="pill">${ICONS.chainsaw} Kettingzaag: <strong>${r.tools.chainsaw ? 'ja' : 'nee'}</strong></span>
        <span class="pill">${ICONS.trekker} Trekker: <strong>${r.tools.trekker ? 'ja' : 'nee'}</strong></span>
        <span class="pill">${ICONS.hoe} Schoffel: <strong>${r.tools.hoe ? 'ja' : 'nee'}</strong></span>
        <span class="pill">${ICONS.shed} Schuren: <strong>${sheds}/${MAX_SHEDS}</strong></span>
        <span class="pill">${ICONS.silo} Silo's: <strong>${silos}/${MAX_SILOS}</strong></span>
        <span class="pill">${ICONS.house} Huis: <strong>${state.buildings.house ? 'ja' : 'nee'}</strong></span>`;
      }

      if($.buildShedBtn){
        $.buildShedBtn.disabled = sheds >= MAX_SHEDS;
        $.buildShedBtn.textContent = sheds >= MAX_SHEDS
          ? `Max schuren (${MAX_SHEDS})`
          : `Bouw schuur (${SHED_WOOD_COST} hout, ${SHED_METAL_COST} platen) [${sheds}/${MAX_SHEDS}]`;
      }
      if($.buildSiloBtn){
        const nextCap = silos >= MAX_SILOS ? vegCap : (silos === 0 ? 200 : 250);
        $.buildSiloBtn.disabled = silos >= MAX_SILOS;
        $.buildSiloBtn.textContent = silos >= MAX_SILOS
          ? `Max silo's (${MAX_SILOS})`
          : `Bouw silo (${SILO_WOOD_COST} hout, ${SILO_METAL_COST} platen) [${silos}/${MAX_SILOS}] -> opslag ${fmt(nextCap)}`;
      }
      if($.buildHouseBtn){
        $.buildHouseBtn.disabled = !!state.buildings.house;
        $.buildHouseBtn.textContent = state.buildings.house
          ? 'Huis staat al (5000 opslag)'
          : `Zet huis op (${HOUSE_WOOD_COST} hout, ${HOUSE_BRICK_COST} baksteen, ${HOUSE_GLASS_COST} glas)`;
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
      if($.trekkerOwned) $.trekkerOwned.textContent = state.resources.tools.trekker ? ' (in bezit)' : '';
      if($.collectEggsBtn) $.collectEggsBtn.disabled = Math.floor(state.animals.eggsReady) <= 0;

      renderSeedSelect();
      updateSellControls();

      if($.passiveList){
        const passive = [];
        if(sheds > 0){
          const woodBonus = sheds * 10;
          passive.push(`${ICONS.shed} ${sheds} schuur(s): +${woodBonus}% hout uit hakken`);
        }
        if(state.resources.tools.chainsaw) passive.push(`${ICONS.chainsaw} +1 hout / 3s`);
        if(state.resources.tools.trekker) passive.push(`${ICONS.trekker} +1 groente / 30s (moestuintaken sneller)`);
        if(silos > 0) passive.push(`${ICONS.silo} ${silos} silo(s): Groente opslag ${fmt(vegCap)}`);
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

      renderModuleList();
      moduleRenderHooks.forEach(h => h.run());
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
      if(state.resources.tools.trekker){
        addInventoryResource('veggies', dt / 30, { silent:true });
      }
      if(state.resources.tools.chainsaw){
        addInventoryResource('wood', dt / 3, { silent:true });
      }

      moduleTickHooks.forEach(h => h.run(dt));
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
          const shedBonus = (state.buildings.sheds || 0) * 0.1;
          const bonus = base * shedBonus;
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
        if(temp.resources.tools && temp.resources.tools.trekker){
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
        if(state.resources.tools.trekker){
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
      if(state.resources.tools.trekker){
        amount = Math.max(1, Math.floor(amount * 1.25));
      }
      const stored = reserveInventory(amount, { key: id === 'basic' ? 'veggies' : undefined });
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
      const current = state.buildings.sheds || 0;
      if(current >= MAX_SHEDS) return warn(`Maximaal ${MAX_SHEDS} schuren.`);
      if(state.resources.wood < SHED_WOOD_COST) return warn(`Benodigd: ${SHED_WOOD_COST} hout`);
      if((state.resources.metalPlates || 0) < SHED_METAL_COST) return warn(`Benodigd: ${SHED_METAL_COST} metalen platen`);
      state.resources.wood -= SHED_WOOD_COST;
      state.resources.metalPlates -= SHED_METAL_COST;
      state.buildings.sheds = current + 1;
      const bonus = state.buildings.sheds * 10;
      log(`${ICONS.shed} Schuur gebouwd (${state.buildings.sheds}/${MAX_SHEDS}). Houtbonus: +${bonus}%.`);
      render();
    });

    if($.buildSiloBtn) $.buildSiloBtn.addEventListener('click', () => {
      const current = state.buildings.silos || 0;
      if(current >= MAX_SILOS) return warn(`Maximaal ${MAX_SILOS} silo's.`);
      if(state.resources.wood < SILO_WOOD_COST) return warn(`Benodigd: ${SILO_WOOD_COST} hout`);
      if((state.resources.metalPlates || 0) < SILO_METAL_COST) return warn(`Benodigd: ${SILO_METAL_COST} metalen platen`);
      state.resources.wood -= SILO_WOOD_COST;
      state.resources.metalPlates -= SILO_METAL_COST;
      state.buildings.silos = current + 1;
      const cap = veggieCapacity();
      if(state.resources.veggies > cap){
        state.resources.veggies = cap;
      }
      log(`${ICONS.silo} Silo gebouwd (${state.buildings.silos}/${MAX_SILOS}). Groente opslag: ${fmt(cap)}.`);
      render();
    });

    if($.buildHouseBtn) $.buildHouseBtn.addEventListener('click', () => {
      if(state.buildings.house) return warn('Huis bestaat al.');
      if(state.resources.wood < HOUSE_WOOD_COST) return warn(`Benodigd: ${HOUSE_WOOD_COST} hout`);
      if((state.resources.bricks || 0) < HOUSE_BRICK_COST) return warn(`Benodigd: ${HOUSE_BRICK_COST} bakstenen`);
      if((state.resources.glass || 0) < HOUSE_GLASS_COST) return warn(`Benodigd: ${HOUSE_GLASS_COST} glas`);
      state.resources.wood -= HOUSE_WOOD_COST;
      state.resources.bricks -= HOUSE_BRICK_COST;
      state.resources.glass -= HOUSE_GLASS_COST;
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

    if($.buyTrekkerBtn) $.buyTrekkerBtn.addEventListener('click', () => {
      if(state.resources.tools.trekker) return warn('Je hebt al een trekker.');
      if(state.resources.gold < 300) return warn('Benodigd: 300 munten');
      state.resources.gold -= 300;
      state.resources.tools.trekker = true;
      log(`${ICONS.trekker} Je koopt een trekker! Moestuintaken worden sneller, opbrengst hoger en +1 groente / 30s.`);
      render();
    });

    if($.buyMetalBtn) $.buyMetalBtn.addEventListener('click', () => {
      const cost = 40;
      if(state.resources.gold < cost) return warn(`Benodigd: ${cost} munten`);
      const stored = addInventoryResource('metalPlates', 1);
      if(stored <= 0){
        warnInventoryFull();
        return;
      }
      state.resources.gold -= cost;
      log(`${ICONS.metal} Je koopt een metalen plaat (-${cost} munten).`);
      render();
    });

    if($.buyBrickBtn) $.buyBrickBtn.addEventListener('click', () => {
      const cost = 25;
      if(state.resources.gold < cost) return warn(`Benodigd: ${cost} munten`);
      const stored = addInventoryResource('bricks', 1);
      if(stored <= 0){
        warnInventoryFull();
        return;
      }
      state.resources.gold -= cost;
      log(`${ICONS.brick} Je koopt een baksteen (-${cost} munten).`);
      render();
    });

    if($.buyGlassBtn) $.buyGlassBtn.addEventListener('click', () => {
      const cost = 30;
      if(state.resources.gold < cost) return warn(`Benodigd: ${cost} munten`);
      const stored = addInventoryResource('glass', 1);
      if(stored <= 0){
        warnInventoryFull();
        return;
      }
      state.resources.gold -= cost;
      log(`${ICONS.glass} Je koopt glas (-${cost} munten).`);
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
      if(!state.resources.tools) state.resources.tools = { axe:false, hoe:false, chainsaw:false, trekker:false };
      if(typeof state.resources.milk !== 'number') state.resources.milk = 0;
      if(typeof state.resources.pork !== 'number') state.resources.pork = 0;
      if(typeof state.resources.metalPlates !== 'number') state.resources.metalPlates = 0;
      if(typeof state.resources.bricks !== 'number') state.resources.bricks = 0;
      if(typeof state.resources.glass !== 'number') state.resources.glass = 0;
      if(state.resources.tools.pick) delete state.resources.tools.pick;
      if(!state.garden) state.garden = { tilled:false, planted:false, plantId:null, growProgress:0, growTime:20, task:null };
      if(state.garden && state.garden.growTime == null) state.garden.growTime = 20;
      if(state.garden && typeof state.garden.task === 'undefined') state.garden.task = null;
      if(state.garden && state.garden.plantId && !SEED_BY_ID[state.garden.plantId]){
        state.garden.plantId = 'basic';
      }
      if(!state.buildings) state.buildings = { sheds:0, silos:0, house:false };
      if(typeof state.buildings.sheds !== 'number'){
        state.buildings.sheds = state.buildings.shed ? 1 : 0;
      }
      if(typeof state.buildings.silos !== 'number') state.buildings.silos = state.buildings.silo || 0;
      if('shed' in state.buildings) delete state.buildings.shed;
      if('silo' in state.buildings) delete state.buildings.silo;
      state.buildings.sheds = Math.max(0, Math.min(MAX_SHEDS, state.buildings.sheds || 0));
      state.buildings.silos = Math.max(0, Math.min(MAX_SILOS, state.buildings.silos || 0));
      const migratedVegCap = veggieCapacity();
      if(typeof state.resources.veggies === 'number' && state.resources.veggies > migratedVegCap){
        state.resources.veggies = migratedVegCap;
      }
      if(!state.meta){
        state.meta = { lastTick: Date.now(), lastSave: 0, autosave:true, muted:false, lastInventoryWarn:0, lastSiloWarn:0, modules:{}, log: [] };
      } else {
        if(typeof state.meta.lastInventoryWarn !== 'number') state.meta.lastInventoryWarn = 0;
        if(typeof state.meta.lastSiloWarn !== 'number') state.meta.lastSiloWarn = 0;
        if(!state.meta.modules || typeof state.meta.modules !== 'object') state.meta.modules = {};
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
    if($.resetBtn) $.resetBtn.addEventListener('click', async () => {
      if(!confirm('Weet je zeker dat je opnieuw wilt beginnen?')) return;
      await resetGameProgress();
    });

    if($.autosaveToggle) $.autosaveToggle.addEventListener('change', (event) => {
      state.meta.autosave = !!event.target.checked;
    });
    if($.muteToggle) $.muteToggle.addEventListener('change', (event) => {
      state.meta.muted = !!event.target.checked;
    });
    if($.resetGameBtn) $.resetGameBtn.addEventListener('click', async () => {
      if(!confirm('Spel resetten? Alle voortgang wordt gewist en het spel start opnieuw.')) return;
      await resetGameProgress();
    });


    function toast(text){
      const pane = document.createElement('div');
      pane.textContent = text;
      pane.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#1f2937;border:1px solid #334155;padding:10px 12px;border-radius:10px;color:#e5e7eb;box-shadow:0 10px 30px rgba(0,0,0,.35);z-index:9999;';
      document.body.appendChild(pane);
      setTimeout(() => { pane.style.opacity = '0'; pane.style.transition = 'opacity .4s'; }, 1600);
      setTimeout(() => pane.remove(), 2100);
    }

    async function resetGameProgress(){
      state.meta.autosave = false;
      if(autosaveTimer){
        clearInterval(autosaveTimer);
        autosaveTimer = null;
      }
      try {
        window.removeEventListener('beforeunload', save);
      } catch(_){}
      try {
        await clearCache({ silent:true });
      } catch(err){
        console.warn('Kon cache niet wissen tijdens reset', err);
      }
      try {
        clearCookiesFallback(null, { silent:true });
      } catch(err){
        console.warn('Kon cookies niet wissen tijdens reset', err);
      }
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch(err){
        console.warn('Kon save niet verwijderen', err);
      }
      try {
        sessionStorage.removeItem(SAVE_KEY);
      } catch(_){}
      state.meta.lastSave = 0;
      state.meta.lastInventoryWarn = 0;
      state.meta.lastSiloWarn = 0;
      moduleEntries.forEach(entry => {
        if(entry.enabled && typeof entry.resetHook === 'function'){
          entry.resetHook({ hard:true });
        }
      });
      toast('Reset voltooid. Spel wordt opnieuw geladen...');
      log(`${ICONS.warning} Reset uitgevoerd, spel wordt opnieuw geladen.`);
      setTimeout(() => location.reload(), 400);
    }

    async function clearCache(options = {}){
      const silent = !!options.silent;
      const fallback = (reason) => clearCookiesFallback(reason, options);
      const notify = (icon, message) => {
        if(silent) return;
        if(message) toast(message);
        if(icon && message) log(`${icon} ${message}`);
      };
      if(!('caches' in window)){
        return { cacheCleared:false, fallbackUsed:true, cookiesCleared:fallback('Cache API niet beschikbaar') };
      }
      try {
        const keys = await caches.keys();
        if(!keys || keys.length === 0){
          return { cacheCleared:false, fallbackUsed:true, cookiesCleared:fallback('Geen cache gevonden') };
        }
        let cleared = 0;
        await Promise.all(keys.map(async (key) => {
          const success = await caches.delete(key);
          if(success) cleared += 1;
        }));
        if(cleared === 0){
          return { cacheCleared:false, fallbackUsed:true, cookiesCleared:fallback('Geen cache gevonden') };
        }
        const opslagSuffix = cleared === 1 ? '' : 'en';
        const cacheSuffix = cleared === 1 ? '' : 's';
        notify(ICONS.broom, `Cache gewist (${cleared} opslag${opslagSuffix}).`);
        return { cacheCleared:true, fallbackUsed:false, cookiesCleared:false, cleared };
      } catch(err){
        console.warn('Kon cache niet wissen', err);
        const cookiesCleared = fallback('Cache wissen mislukt');
        if(!cookiesCleared) notify(ICONS.warning, 'Cache wissen mislukt.');
        return { cacheCleared:false, fallbackUsed:true, cookiesCleared };
      }
    }

    function clearCookiesFallback(reason, options = {}){
      const silent = !!options.silent;
      const prefix = reason ? `${reason}. ` : '';
      const source = document.cookie;
      const notify = (icon, message) => {
        if(silent) return;
        toast(message);
        log(`${icon} ${message}`);
      };
      if(!source){
        notify(ICONS.warning, `${prefix}Geen cookies gevonden.`.trim());
        return false;
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
        notify(ICONS.warning, `${prefix}Geen cookies gevonden.`.trim());
        return false;
      }
      notify(ICONS.broom, `${prefix}Cookies gewist (${cleared}).`.trim());
      return true;
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
      setupModulesRegistry();
      if($.dlcList && !$.dlcList.__dlcBound){
        $.dlcList.addEventListener('change', handleDlcToggle);
        $.dlcList.__dlcBound = true;
      }
      applyInitialModules();
      renderModuleList();
      offline();
      render();
      loop();
      if(state.meta.autosave){
        autosaveTimer = setInterval(() => {
          if(state.meta.autosave) save();
        }, 10000);
      }
      window.addEventListener('beforeunload', save);
    }

    boot();
})();


























