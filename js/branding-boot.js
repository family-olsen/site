// Aplica a paleta de cores em cache ANTES da primeira pintura da página —
// carregado no <head>, antes do body existir, de propósito. site.js roda no
// fim do <body> e busca a versão atual no banco (mais lenta, depois de já
// ter pintado), então sem isso toda navegação entre páginas piscaria a cor
// padrão por uma fração de segundo antes de trocar pro tema personalizado.
// Só a primeiríssima visita (sem cache ainda) ou uma troca de tema recém-
// salva ficam sujeitas a essa piscada — depois disso, sempre instantâneo.
(function(){
  try{
    var c=JSON.parse(localStorage.getItem('familia_branding_v1')||'null');
    if(c&&c.vars){
      var root=document.documentElement.style;
      for(var k in c.vars) root.setProperty(k,c.vars[k]);
    }
  }catch(e){}
})();
