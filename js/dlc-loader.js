(function(global){
  if(!global) return;
  const registry = global.__HOMESTEAD_DLC_MODULES = Array.isArray(global.__HOMESTEAD_DLC_MODULES)
    ? global.__HOMESTEAD_DLC_MODULES
    : [];

  const api = {
    register(definition){
      if(!definition || typeof definition !== 'object'){
        throw new Error('HomesteadDLC.register verwacht een object');
      }
      const { id } = definition;
      if(!id || typeof id !== 'string'){
        throw new Error('DLC module vereist een string id');
      }
      if(registry.some(module => module.id === id)){
        console.warn(`[HomesteadDLC] Module met id "${id}" is al geregistreerd.`);
        return;
      }
      registry.push(Object.freeze(definition));
    },
    list(){
      return registry.slice();
    }
  };

  global.HomesteadDLC = api;
})(window);
