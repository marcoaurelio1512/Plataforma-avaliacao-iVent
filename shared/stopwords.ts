/**
 * Stopwords do português (forma normalizada: minúsculas, sem acento).
 * Termos técnicos protegidos nunca são removidos, mesmo que coincidam.
 */
export const PT_STOPWORDS = new Set(
  `a à ao aos aquela aquelas aquele aqueles aquilo as às ate até com como contra da das de dela delas dele deles depois do dos e é ela elas ele eles em entre era eram essa essas esse esses esta está estao estão estas este estes eu foi fomos for foram fosse fossem fui ha há isso isto ja já lhe lhes mais mas me mesmo meu meus minha minhas muito muita muitos muitas na nas nao não nem no nos nós nossa nossas nosso nossos num numa o os ou para pela pelas pelo pelos por qual quando que quem se sem ser seu seus si so só sua suas tambem também te tem têm tinha tinham to tu tua tuas um uma umas uns voce você voces vocês vos sao são seja sejam sera será seria seriam ter teve tive tenho temos tinha estar estava estavam estive esteve estou sobre ainda apenas assim cada aqui ali la lá onde porque pois entao então bem bom boa bons boas pouco pouca poucos poucas algum alguma alguns algumas outro outra outros outras todo toda todos todas tudo nada coisa coisas vez vezes quanto quanta quantos quantas tao tão sim acho achei fica ficou faz fazer feito feita pode podem poderia poderiam deve devem deveria deveriam vai vão ir sendo sido ver vi forma algo aquilo ate após apos durante desde quase mim comigo lo la los las ne né tipo etc pra pro pras pros dá da dar the of and to in is it`
    .split(/\s+/)
    .map((w) => w.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase())
    .filter(Boolean),
);

/** Nome do próprio produto: aparece em quase todo comentário e não informa. */
export const DEFAULT_EXTRA_STOPWORDS = ["ivent", "neoped"];
