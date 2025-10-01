// Globale seedcatalogus (30 soorten)
(function(){
    const SEEDS = [
      {id:'basic',    icon:'🌱',  name:'Basiszaad',        crop:'Groente',         yield:[4,6],  grow:20},
      {id:'onion',    icon:'🧅',  name:'Uienzaad',         crop:'Uien',            yield:[3,5],  grow:22},
      {id:'pumpkin',  icon:'🎃',  name:'Pompoenzaad',      crop:'Pompoenen',       yield:[2,3],  grow:28},
      {id:'carrot',   icon:'🥕',  name:'Wortelzaad',       crop:'Wortels',         yield:[4,7],  grow:20},
      {id:'potato',   icon:'🥔',  name:'Aardappelzaad',    crop:'Aardappelen',     yield:[3,6],  grow:22},
      {id:'wheat',    icon:'🌾',  name:'Tarwezaad',        crop:'Tarwe',           yield:[5,9],  grow:24},
      {id:'corn',     icon:'🌽',  name:'Maïszaad',         crop:'Maïs',            yield:[3,5],  grow:24},
      {id:'tomato',   icon:'🍅',  name:'Tomatenzaad',      crop:'Tomaten',         yield:[4,7],  grow:23},
      {id:'lettuce',  icon:'🥬',  name:'Slazaad',          crop:'Sla',             yield:[4,8],  grow:18},
      {id:'cabbage',  icon:'🥬',  name:'Koolzaad',         crop:'Kool',            yield:[2,4],  grow:26},
      {id:'beet',     icon:'🪻',  name:'Bietenzaad',       crop:'Bieten',          yield:[4,6],  grow:21},
      {id:'radish',   icon:'🥗',  name:'Radijszaad',       crop:'Radijs',          yield:[5,9],  grow:17},
      {id:'pepper',   icon:'🫑',  name:'Paprikazaad',      crop:'Paprika',         yield:[3,6],  grow:25},
      {id:'cucumber', icon:'🥒',  name:'Komkommerzaad',    crop:'Komkommers',      yield:[3,5],  grow:23},
      {id:'garlic',   icon:'🧄',  name:'Knoflookteentje',  crop:'Knoflook',        yield:[3,6],  grow:24},
      {id:'leek',     icon:'🥬',  name:'Preizaad',         crop:'Prei',            yield:[3,5],  grow:24},
      {id:'pea',      icon:'🟢',  name:'Erwtzaad',         crop:'Erwten',          yield:[6,10], grow:19},
      {id:'bean',     icon:'🫘',  name:'Bonenzaad',        crop:'Bonen',           yield:[6,10], grow:21},
      {id:'spinach',  icon:'🥬',  name:'Spinaziezaad',     crop:'Spinazie',        yield:[5,9],  grow:16},
      {id:'broccoli', icon:'🥦',  name:'Broccolizaad',     crop:'Broccoli',        yield:[2,4],  grow:26},
      {id:'cauli',    icon:'🥦',  name:'Bloemkoolzaad',    crop:'Bloemkool',       yield:[2,4],  grow:27},
      {id:'chili',    icon:'🌶️', name:'Chilizaad',        crop:'Chili',           yield:[3,6],  grow:24},
      {id:'eggplant', icon:'🍆',  name:'Auberginezaad',    crop:'Aubergines',      yield:[3,5],  grow:25},
      {id:'melon',    icon:'🍈',  name:'Meloenzaad',       crop:'Meloenen',        yield:[1,2],  grow:30},
      {id:'straw',    icon:'🍓',  name:'Aardbeienzaad',    crop:'Aardbeien',       yield:[3,6],  grow:24},
      {id:'blue',     icon:'🫐',  name:'Blauwebessen-zaad',crop:'Blauwe bessen',   yield:[2,4],  grow:28},
      {id:'rasp',     icon:'🍇',  name:'Frambozen-zaad',   crop:'Frambozen',       yield:[2,4],  grow:28},
      {id:'basil',    icon:'🌿',  name:'Basilicumzaad',    crop:'Basilicum',       yield:[5,9],  grow:16},
      {id:'sunflower',icon:'🌻',  name:'Zonnebloemzaad',   crop:'Zonnebloemen',    yield:[1,3],  grow:27},
      {id:'barley',   icon:'🌾',  name:'Gerstzaad',        crop:'Gerst',           yield:[5,9],  grow:24},
    ];
    const SEED_BY_ID = Object.fromEntries(SEEDS.map(seed => [seed.id, seed]));
    window.SEEDS = SEEDS;
    window.SEED_BY_ID = SEED_BY_ID;
})();
