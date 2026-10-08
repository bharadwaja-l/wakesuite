/* WakeSuite V9.2 module registry */
(function(){
  const modules=new Map();
  window.WakeSuiteModules={
    register(name,module){modules.set(name,module||{});return module;},
    get(name){return modules.get(name)||null;},
    has(name){return modules.has(name);},
    list(){return [...modules.keys()];}
  };
})();
