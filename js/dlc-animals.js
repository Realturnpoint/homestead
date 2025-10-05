(function(global){
  if(!global || !global.HomesteadDLC) return;

  const COSTS = {
    cow: { wood: 40, veggies: 20, metal: 5 },
    pig: { wood: 35, veggies: 15 }
  };
  const PRODUCTION = {
    cow: 1 / 90,
    pig: 1 / 180
  };

  global.HomesteadDLC.register({
    id: 'dlc-animals',
    name: 'Boerderijdieren+',
    version: '1.0.0',
    description: 'Voegt koeien, varkens, melk en varkensvlees toe.',
    defaultEnabled: false,
    hooks: {
      init(ctx){
        ctx.registerIcon('cow', '&#x1F404;');
        ctx.registerIcon('pig', '&#x1F416;');
        ctx.registerIcon('milk', '&#x1F95B;');
        ctx.registerIcon('pork', '&#x1F356;');

        const { state } = ctx;
        if(!state.animals) state.animals = { chickens: 0, eggsReady: 0 };
        if(typeof state.animals.cows !== 'number') state.animals.cows = 0;
        if(typeof state.animals.cowMilkReady !== 'number') state.animals.cowMilkReady = 0;
        if(typeof state.animals.pigs !== 'number') state.animals.pigs = 0;
        if(typeof state.animals.pigMeatReady !== 'number') state.animals.pigMeatReady = 0;
        if(typeof state.resources.milk !== 'number') state.resources.milk = 0;
        if(typeof state.resources.pork !== 'number') state.resources.pork = 0;

        const doc = ctx.document || document;
        const kpi = doc.querySelector('.kpi');
        if(!kpi) return;

        let card = doc.getElementById('dlcAnimalsCard');
        if(card) card.remove();

        card = doc.createElement('div');
        card.className = 'card';
        card.id = 'dlcAnimalsCard';
        card.innerHTML = `
          <div class="center"><strong>Extra vee</strong> <span class="small" data-livestock-status>geen dieren</span></div>
          <div class="row stack">
            <div class="row">
              <button data-buy-cow>Koop koe (40 hout, 20 groente, 5 platen)</button>
              <button data-collect-milk disabled>Melk verzamelen</button>
            </div>
            <div class="row">
              <button data-buy-pig>Koop varken (35 hout, 15 groente)</button>
              <button data-collect-pork disabled>Vlees verzamelen</button>
            </div>
          </div>
          <p class="small" data-milk-line>Melk klaar: 0</p>
          <p class="small" data-pork-line>Vlees klaar: 0</p>
        `;
        kpi.appendChild(card);

        const elements = {
          card,
          status: card.querySelector('[data-livestock-status]'),
          milkLine: card.querySelector('[data-milk-line]'),
          porkLine: card.querySelector('[data-pork-line]'),
          buyCowBtn: card.querySelector('[data-buy-cow]'),
          collectMilkBtn: card.querySelector('[data-collect-milk]'),
          buyPigBtn: card.querySelector('[data-buy-pig]'),
          collectPorkBtn: card.querySelector('[data-collect-pork]')
        };
        ctx.elements = elements;

        const buyCow = () => {
          if(state.resources.wood < COSTS.cow.wood) return ctx.warn(`Benodigd: ${COSTS.cow.wood} hout`);
          if((state.resources.veggies || 0) < COSTS.cow.veggies) return ctx.warn(`Benodigd: ${COSTS.cow.veggies} groente`);
          if((state.resources.metalPlates || 0) < COSTS.cow.metal) return ctx.warn(`Benodigd: ${COSTS.cow.metal} metalen platen`);
          state.resources.wood -= COSTS.cow.wood;
          state.resources.veggies -= COSTS.cow.veggies;
          state.resources.metalPlates -= COSTS.cow.metal;
          state.animals.cows += 1;
          ctx.log(`${ctx.icons.cow || '&#x1F404;'} Je koopt een koe.`);
          ctx.render();
        };

        const collectMilk = () => {
          const ready = Math.floor(state.animals.cowMilkReady || 0);
          if(ready <= 0) return ctx.warn('Nog geen melk klaar.');
          const stored = ctx.addInventoryResource('milk', ready);
          if(stored <= 0) return;
          state.animals.cowMilkReady -= stored;
          ctx.log(`${ctx.icons.milk || '&#x1F95B;'} Je verzamelt ${ctx.fmt(stored)} melk.`);
          ctx.render();
        };

        const buyPig = () => {
          if(state.resources.wood < COSTS.pig.wood) return ctx.warn(`Benodigd: ${COSTS.pig.wood} hout`);
          if((state.resources.veggies || 0) < COSTS.pig.veggies) return ctx.warn(`Benodigd: ${COSTS.pig.veggies} groente`);
          state.resources.wood -= COSTS.pig.wood;
          state.resources.veggies -= COSTS.pig.veggies;
          state.animals.pigs += 1;
          ctx.log(`${ctx.icons.pig || '&#x1F416;'} Je koopt een varken.`);
          ctx.render();
        };

        const collectPork = () => {
          const ready = Math.floor(state.animals.pigMeatReady || 0);
          if(ready <= 0) return ctx.warn('Nog geen vlees klaar.');
          const stored = ctx.addInventoryResource('pork', ready);
          if(stored <= 0) return;
          state.animals.pigMeatReady -= stored;
          ctx.log(`${ctx.icons.pork || '&#x1F356;'} Je verzamelt ${ctx.fmt(stored)} vlees.`);
          ctx.render();
        };

        elements.buyCowBtn.addEventListener('click', buyCow);
        elements.collectMilkBtn.addEventListener('click', collectMilk);
        elements.buyPigBtn.addEventListener('click', buyPig);
        elements.collectPorkBtn.addEventListener('click', collectPork);

        ctx.addCleanup(() => {
          elements.buyCowBtn.removeEventListener('click', buyCow);
          elements.collectMilkBtn.removeEventListener('click', collectMilk);
          elements.buyPigBtn.removeEventListener('click', buyPig);
          elements.collectPorkBtn.removeEventListener('click', collectPork);
        });
      },
      render(ctx){
        const elements = ctx.elements;
        if(!elements) return;
        const { state } = ctx;
        const cows = state.animals.cows || 0;
        const pigs = state.animals.pigs || 0;
        const milkReady = Math.floor(state.animals.cowMilkReady || 0);
        const porkReady = Math.floor(state.animals.pigMeatReady || 0);
        const milkStock = ctx.fmt(Math.floor(state.resources.milk || 0));
        const porkStock = ctx.fmt(Math.floor(state.resources.pork || 0));

        const parts = [];
        if(cows > 0) parts.push(`${cows} koe${cows === 1 ? '' : 'ien'}`);
        if(pigs > 0) parts.push(`${pigs} varken${pigs === 1 ? '' : 's'}`);
        elements.status.textContent = parts.length ? parts.join(', ') : 'geen dieren';

        elements.milkLine.textContent = `Melk klaar: ${ctx.fmt(milkReady)} (voorraad: ${milkStock})`;
        elements.porkLine.textContent = `Vlees klaar: ${ctx.fmt(porkReady)} (voorraad: ${porkStock})`;
        elements.collectMilkBtn.disabled = milkReady <= 0;
        elements.collectPorkBtn.disabled = porkReady <= 0;
      },
      tick(ctx, dt){
        const { state } = ctx;
        if((state.animals.cows || 0) > 0){
          state.animals.cowMilkReady = (state.animals.cowMilkReady || 0) + dt * (state.animals.cows * PRODUCTION.cow);
          const cap = Math.max(1, state.animals.cows * 5);
          if(state.animals.cowMilkReady > cap) state.animals.cowMilkReady = cap;
        }
        if((state.animals.pigs || 0) > 0){
          state.animals.pigMeatReady = (state.animals.pigMeatReady || 0) + dt * (state.animals.pigs * PRODUCTION.pig);
          const cap = Math.max(1, state.animals.pigs * 3);
          if(state.animals.pigMeatReady > cap) state.animals.pigMeatReady = cap;
        }
      },
      reset(ctx){
        if(!ctx || !ctx.state) return;
        ctx.state.animals.cowMilkReady = 0;
        ctx.state.animals.pigMeatReady = 0;
      },
      teardown(ctx){
        if(ctx.elements && ctx.elements.card){
          ctx.elements.card.remove();
          ctx.elements = null;
        }
      }
    }
  });
})(window);
