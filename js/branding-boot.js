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
// Esconde a página inteira até site.js confirmar (no fim do <body>) se o
// site está público ou se esse visitante tem permissão de ver um site
// privado — sem isso, o conteúdo apareceria por um instante antes do
// portão de login entrar. Ver .access-gate em css/site.css (visibility:
// visible força a exceção — é a única coisa que aparece nesse meio-tempo).
//
// SÓ esconde se o cache diz que o site PODE estar privado, ou se ainda não
// existe cache nenhum (primeira visita) — o caso comum (site público, que é
// o padrão) nunca fica com flash nenhum depois da primeira visita.
try{
  var cfg=JSON.parse(localStorage.getItem('familia_branding_v1')||'null');
  if(!cfg||cfg.mightBePrivate!==false){
    document.documentElement.classList.add('site-checking-access');
  }
}catch(e){
  document.documentElement.classList.add('site-checking-access');
}
