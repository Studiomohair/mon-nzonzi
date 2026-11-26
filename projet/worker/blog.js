// Blog pédagogique (SEO) : articles écrits en HTML simple, sans données utilisateur.
// Chaque article : slug (adresse /blog/<slug>), titre de page (title, < 60 signes),
// description (meta, ~150 signes), contenu, questions fréquentes (données structurées FAQ).
// Les pratiques varient selon les familles et les régions : le rappeler dans chaque texte.
// Rendu : fonctions blogIndexPage / articlePage de catalog.js.

export const blogArticles = [
  {
    slug: 'c-est-quoi-un-nzonzi',
    title: 'C’est quoi un nzonzi ?',
    seoTitle: 'C’est quoi un nzonzi ? Le porte-parole de la dot',
    description: 'Le nzonzi est le porte-parole d’une famille lors de la dot. Origine du mot, rôle pendant la cérémonie, qualités attendues : on vous explique simplement.',
    kicker: 'Les bases',
    lead: 'Le nzonzi est la personne qui parle au nom d’une famille pendant la dot. Sans lui, pas de dialogue entre les deux familles.',
    published: '2026-11-26',
    minutes: 4,
    art: 'voices',
    takeaways: [
      'Le nzonzi est le porte-parole et le médiateur d’une famille.',
      'Chaque famille a le sien : celle du futur marié et celle de la future mariée.',
      'Il connaît les coutumes, parle avec respect et cherche toujours l’accord.',
    ],
    body: `
<h2>Une définition simple</h2>
<p>Un <strong>nzonzi</strong>, c’est un <strong>porte-parole</strong>. Pendant une cérémonie de dot, il parle au nom de sa famille, présente ses demandes, écoute celles de l’autre famille et aide tout le monde à trouver un accord.</p>
<p>Le mot vient du <strong>kikongo</strong>, la langue des Bakongo, présents en République démocratique du Congo, en République du Congo et en Angola. Il est lié à l’idée de parler, de discuter et de plaider. Le nzonzi est donc, mot pour mot, « celui qui parle » pour les autres.</p>
<p>Aujourd’hui, à Kinshasa comme dans la diaspora, beaucoup de familles congolaises utilisent ce mot pour désigner le porte-parole de la dot, même hors du monde kongo. D’autres communautés ont leurs propres mots et leurs propres usages.</p>

<h2>Que fait le nzonzi pendant la dot ?</h2>
<p>Pendant la cérémonie, les parents et les futurs mariés parlent peu. Ce sont les nzonzi qui échangent. Leur rôle :</p>
<ul>
  <li><strong>Présenter la famille</strong> qu’il représente et la raison de la visite.</li>
  <li><strong>Transmettre ou recevoir la liste de la dot</strong>, puis en discuter point par point.</li>
  <li><strong>Négocier avec respect</strong> : chaque demande se discute, sans jamais humilier l’autre famille.</li>
  <li><strong>Apaiser les tensions</strong> quand un point bloque, avec une image, un proverbe ou un trait d’humour.</li>
  <li><strong>Faire respecter les étapes</strong> et les coutumes propres à la famille.</li>
</ul>
<p>Cet art de la parole et de la négociation porte un nom : le <a href="/blog/c-est-quoi-le-kinzonzi">kinzonzi</a>.</p>

<h2>Un nzonzi pour chaque famille</h2>
<p>Lors d’une dot, il y a en général <strong>deux nzonzi</strong> : un pour la famille du futur marié, un pour la famille de la future mariée. Ils se répondent, se testent parfois, et avancent ensemble vers un accord. Selon les familles, le nzonzi peut être aidé par d’autres membres de la famille ou par des aînés qui se concertent avec lui.</p>

<h2>Les qualités d’un bon nzonzi</h2>
<ul>
  <li>Il <strong>connaît les coutumes</strong> de la famille qu’il représente.</li>
  <li>Il <strong>parle la langue</strong> attendue (kikongo, lingala, tshiluba, swahili, français…).</li>
  <li>Il reste <strong>calme et patient</strong>, même quand la discussion se tend.</li>
  <li>Il a le <strong>sens de la formule</strong> et sait utiliser les proverbes.</li>
  <li>Il est <strong>discret</strong> : ce qui se dit pendant la dot reste dans les familles.</li>
</ul>
<p>Pour savoir qui peut tenir ce rôle, lisez notre article <a href="/blog/qui-peut-faire-le-kinzonzi">Qui peut faire le kinzonzi ?</a></p>

<h2>Pourquoi faire appel à un nzonzi aujourd’hui ?</h2>
<p>Traditionnellement, le nzonzi est un aîné ou un proche de la famille. Mais en France et en Europe, beaucoup de familles n’ont pas toujours cette personne à côté d’elles : les oncles sont restés au pays, personne ne maîtrise assez la langue ou les codes, ou la famille préfère une personne neutre et expérimentée.</p>
<p>C’est pour cela que Mon Nzonzi existe : vous aider à trouver un nzonzi qui parle vos langues et connaît vos coutumes, près de chez vous.</p>`,
    faq: [
      { q: 'Quelle est la différence entre un nzonzi et un témoin ?', a: 'Le témoin accompagne les mariés, surtout au mariage civil ou religieux. Le nzonzi, lui, parle au nom de la famille pendant la dot et mène la négociation avec l’autre famille.' },
      { q: 'Le nzonzi est-il payé ?', a: 'Cela dépend des familles. Quand c’est un proche, il reçoit souvent un remerciement. Quand la famille fait appel à un nzonzi extérieur, une rémunération est convenue à l’avance.' },
      { q: 'Faut-il parler kikongo pour être nzonzi ?', a: 'Non. Le mot vient du kikongo, mais la cérémonie se déroule dans la langue des familles : lingala, kikongo, tshiluba, swahili, français, ou un mélange.' },
    ],
    related: ['c-est-quoi-le-kinzonzi', 'qui-peut-faire-le-kinzonzi', 'la-dot-c-est-quoi'],
  },
  {
    slug: 'c-est-quoi-le-kinzonzi',
    title: 'C’est quoi le kinzonzi ?',
    seoTitle: 'C’est quoi le kinzonzi ? L’art de la parole congolais',
    description: 'Le kinzonzi est l’art de la parole et de la négociation des nzonzi, au cœur de la dot congolaise. Origine, déroulé, proverbes : tout comprendre en 5 minutes.',
    kicker: 'Tradition',
    lead: 'Le kinzonzi, c’est l’art de la parole : une manière de dialoguer, de négocier et de régler les différends par les mots, transmise de génération en génération.',
    published: '2026-11-26',
    minutes: 5,
    art: 'circle',
    takeaways: [
      'Le kinzonzi est l’art du nzonzi : parler, convaincre et réconcilier.',
      'Il vient de la tradition kongo, où l’on réglait les affaires importantes par la palabre.',
      'Pendant la dot, c’est l’échange entre les porte-parole des deux familles.',
    ],
    body: `
<h2>Le mot kinzonzi</h2>
<p>En kikongo, on ajoute souvent le préfixe <strong>ki-</strong> à un mot pour parler d’une manière de faire, d’un art. Si le <a href="/blog/c-est-quoi-un-nzonzi">nzonzi</a> est celui qui parle, le <strong>kinzonzi</strong> est donc <strong>l’art de parler</strong> : l’éloquence, la négociation, la palabre.</p>
<p>Le mot désigne à la fois ce savoir-faire et le moment où il s’exerce : on dit qu’on « fait le kinzonzi » quand les porte-parole prennent la parole.</p>

<h2>Une tradition de la palabre</h2>
<p>Chez les Bakongo, les affaires importantes se réglaient traditionnellement par la parole : un mariage, un conflit de famille, une question de terre. Les familles se réunissaient, chacune avec son orateur, et la discussion durait le temps qu’il fallait. Le but n’était pas d’écraser l’autre, mais de trouver une solution acceptable pour tous.</p>
<p>Les meilleurs orateurs étaient respectés pour leur sagesse, leur mémoire des coutumes et leur maîtrise des <strong>proverbes</strong>. Un proverbe bien placé permet de dire une chose délicate sans blesser, ou de rappeler une règle sans faire la leçon.</p>

<h2>Comment se déroule le kinzonzi pendant la dot ?</h2>
<p>Chaque famille a ses habitudes, mais on retrouve souvent ces moments :</p>
<ol>
  <li><strong>Les salutations</strong> : on se présente, on salue les aînés, on remercie l’autre famille de son accueil.</li>
  <li><strong>L’annonce</strong> : le nzonzi de la famille du futur marié explique pourquoi elle est venue.</li>
  <li><strong>La discussion de la dot</strong> : la liste est reprise point par point. Chaque nzonzi plaide, propose, refuse parfois.</li>
  <li><strong>Les concertations</strong> : quand un point bloque, une famille peut demander à se retirer quelques minutes pour se consulter.</li>
  <li><strong>L’accord</strong> : quand les deux parties sont satisfaites, on l’annonce, et la fête peut commencer.</li>
</ol>
<p>Le kinzonzi peut être solennel, mais aussi plein d’humour. Les joutes verbales entre nzonzi font souvent partie du spectacle, et les invités les attendent.</p>

<h2>Les valeurs du kinzonzi</h2>
<ul>
  <li><strong>Le respect</strong> : on peut être ferme sans jamais humilier l’autre famille.</li>
  <li><strong>La patience</strong> : on prend le temps d’écouter avant de répondre.</li>
  <li><strong>L’humilité</strong> : le nzonzi parle pour sa famille, pas pour lui-même.</li>
  <li><strong>La recherche de l’accord</strong> : à la fin, deux familles doivent repartir unies.</li>
</ul>

<h2>Le kinzonzi aujourd’hui</h2>
<p>Le kinzonzi reste très vivant, au Congo comme dans la diaspora. Il s’adapte : les cérémonies sont parfois plus courtes, se déroulent en français ou dans plusieurs langues, et réunissent des familles d’origines différentes. Mais l’esprit reste le même : une parole qui rassemble.</p>
<p>Vous préparez une dot et vous cherchez quelqu’un pour tenir ce rôle ? Lisez <a href="/blog/qui-peut-faire-le-kinzonzi">qui peut faire le kinzonzi</a>, puis découvrez les nzonzi de l’annuaire.</p>`,
    faq: [
      { q: 'Le kinzonzi existe-t-il seulement en RDC ?', a: 'Non. Il vient de la tradition kongo, présente en RDC, en République du Congo et en Angola. D’autres peuples d’Afrique centrale ont leurs propres traditions de palabre.' },
      { q: 'Combien de temps dure le kinzonzi pendant une dot ?', a: 'Cela va de moins d’une heure à toute une journée. Tout dépend des familles, de la liste de la dot et de la façon dont la discussion avance.' },
      { q: 'Le kinzonzi est-il réservé à la dot ?', a: 'Non. Traditionnellement, il servait aussi à régler des conflits de famille ou de terre. Aujourd’hui, on le voit surtout lors des mariages coutumiers.' },
    ],
    related: ['c-est-quoi-un-nzonzi', 'qui-peut-faire-le-kinzonzi', 'etapes-du-mariage-en-rdc'],
  },
  {
    slug: 'la-dot-c-est-quoi',
    title: 'La dot, c’est quoi ?',
    seoTitle: 'La dot congolaise, c’est quoi ? Sens, liste et déroulé',
    description: 'La dot scelle l’union de deux familles. Ce qu’elle représente, ce que contient souvent la liste, qui la verse et ce qu’elle vaut en France : nos explications.',
    kicker: 'Les bases',
    lead: 'La dot, ce sont des biens et de l’argent offerts par la famille du futur marié à la famille de la future mariée. C’est d’abord un geste qui unit deux familles.',
    published: '2026-11-26',
    minutes: 5,
    art: 'gift',
    takeaways: [
      'La dot unit deux familles : ce n’est pas l’achat d’une personne.',
      'La liste est remise par la famille de la future mariée et elle varie beaucoup.',
      'En France, seul le mariage civil en mairie a une valeur légale.',
    ],
    body: `
<h2>Le sens de la dot</h2>
<p>Dans la tradition congolaise, le mariage n’unit pas seulement deux personnes : il unit <strong>deux familles</strong>. La dot est le geste qui scelle cette alliance. La famille du futur marié montre son respect et sa reconnaissance envers les parents qui ont élevé la future mariée.</p>
<p>La dot n’est <strong>pas un prix</strong> et ce n’est pas l’achat d’une femme. C’est un engagement public, devant les deux familles, qui donne au mariage sa reconnaissance coutumière.</p>

<h2>Que contient la liste de la dot ?</h2>
<p>C’est la famille de la future mariée qui établit et remet la <strong>liste de la dot</strong>. Son contenu change beaucoup d’une famille et d’une région à l’autre. On y trouve souvent :</p>
<ul>
  <li><strong>une somme d’argent</strong> ;</li>
  <li><strong>des tenues pour le père</strong> (costume, chemise, chaussures…) ;</li>
  <li><strong>des tenues pour la mère</strong> (pagnes, foulard, chaussures…) ;</li>
  <li><strong>des boissons</strong> à partager entre les familles ;</li>
  <li>parfois des <strong>animaux ou des objets symboliques</strong> (chèvre, outils, ustensiles, lampe…).</li>
</ul>
<p>Certaines familles ajoutent des cadeaux pour les oncles, les tantes, les frères et sœurs. D’autres demandent une dot très simple. Il n’y a pas de liste « officielle » valable pour tout le monde.</p>

<h2>Qui verse la dot ?</h2>
<p>La dot est apportée par <strong>la famille du futur marié</strong>. Aujourd’hui, c’est souvent le futur marié lui-même qui en finance la plus grande partie, avec l’aide de sa famille. Elle est remise pendant la <strong>cérémonie de la dot</strong>, aussi appelée mariage coutumier.</p>

<h2>Une dot, ça se négocie ?</h2>
<p>Oui, et c’est même une partie importante de la cérémonie. La liste peut être discutée, allégée ou complétée. Cette discussion est menée par les <a href="/blog/c-est-quoi-un-nzonzi">nzonzi</a> des deux familles, dans les règles du <a href="/blog/c-est-quoi-le-kinzonzi">kinzonzi</a> : avec respect, patience et parfois beaucoup d’humour. Dans de nombreuses familles, une partie de la dot peut être remise plus tard, si les deux familles sont d’accord.</p>

<h2>La dot en RDC et en France</h2>
<p>En République démocratique du Congo, la dot a une place dans la loi : le <strong>Code de la famille</strong> en fait une condition du mariage, qui ne peut être célébré que si elle a été versée, au moins en partie.</p>
<p>En France, la dot <strong>n’a pas de valeur légale</strong>. Seul le mariage civil célébré en mairie est reconnu par la loi. La cérémonie de la dot reste pourtant un moment essentiel pour de nombreuses familles congolaises de France, qui l’organisent avant ou après la mairie.</p>
<p>Pour voir où la dot se place dans l’ensemble du mariage, lisez <a href="/blog/etapes-du-mariage-en-rdc">les étapes du mariage en RDC</a>.</p>`,
    faq: [
      { q: 'Combien coûte une dot congolaise ?', a: 'Il n’y a pas de montant standard. Tout dépend de la famille de la future mariée, de ses coutumes, du pays où se déroule la cérémonie et de la négociation entre les nzonzi.' },
      { q: 'Peut-on verser la dot en plusieurs fois ?', a: 'Dans de nombreuses familles, oui : une partie est remise le jour de la cérémonie et le reste plus tard. Cela se décide entre les deux familles, souvent par l’intermédiaire des nzonzi.' },
      { q: 'La dot est-elle obligatoire en France ?', a: 'Non. En France, seul le mariage civil a une valeur légale. La dot est une tradition familiale que chacun choisit de faire ou non.' },
    ],
    related: ['etapes-du-mariage-en-rdc', 'c-est-quoi-un-nzonzi', 'c-est-quoi-le-kinzonzi'],
  },
  {
    slug: 'etapes-du-mariage-en-rdc',
    title: 'Les étapes du mariage en RDC',
    seoTitle: 'Les étapes du mariage en RDC : de la présentation à la fête',
    description: 'Présentation, liste de la dot, mariage coutumier, mairie, église, fête : les grandes étapes du mariage congolais (RDC), expliquées simplement.',
    kicker: 'Mariage',
    lead: 'Un mariage congolais se vit en plusieurs temps. Voici les grandes étapes les plus courantes, de la première visite à la fête.',
    published: '2026-11-26',
    minutes: 6,
    art: 'steps',
    takeaways: [
      'Le mariage se fait souvent en trois temps : coutumier, civil, religieux.',
      'Tout commence par la présentation et la remise de la liste de la dot.',
      'L’ordre et le détail des étapes changent selon les familles.',
    ],
    body: `
<p>Chaque famille a ses habitudes, et l’ordre des étapes peut changer, surtout dans la diaspora. Voici le déroulé le plus courant, pour vous repérer.</p>

<h2>1. La présentation : « frapper à la porte »</h2>
<p>Le futur marié, accompagné de quelques membres de sa famille, se présente à la famille de la future mariée pour demander officiellement sa main. On dit souvent qu’il vient « frapper à la porte ». Il apporte en général une lettre et un présent, comme des boissons. C’est la première rencontre officielle entre les deux familles.</p>

<h2>2. La remise de la liste de la dot</h2>
<p>Si la demande est acceptée, la famille de la future mariée se réunit et prépare la <a href="/blog/la-dot-c-est-quoi">liste de la dot</a>. Elle la remet ensuite à la famille du futur marié, parfois lors d’une rencontre dédiée. Les deux familles fixent aussi une date pour la cérémonie.</p>

<h2>3. La préparation</h2>
<p>La famille du futur marié rassemble ce que contient la liste. Chaque famille choisit son <a href="/blog/c-est-quoi-un-nzonzi">nzonzi</a>, c’est-à-dire son porte-parole. On prépare aussi le lieu, les tenues, le repas et les invités.</p>

<h2>4. La cérémonie de la dot (mariage coutumier)</h2>
<p>C’est le grand moment. Les deux familles se retrouvent, et les nzonzi mènent le <a href="/blog/c-est-quoi-le-kinzonzi">kinzonzi</a> : salutations, présentation de la dot, négociation, accord. Selon les familles, on retrouve aussi :</p>
<ul>
  <li>la <strong>présentation de la future mariée</strong> à la famille de son futur mari ;</li>
  <li>les <strong>conseils des aînés</strong> aux futurs époux ;</li>
  <li>des <strong>bénédictions</strong> et des gestes symboliques ;</li>
  <li>un <strong>repas</strong> partagé et de la musique.</li>
</ul>
<p>Une fois la dot acceptée, le couple est considéré comme marié selon la coutume.</p>

<h2>5. Le mariage civil</h2>
<p>En RDC, le mariage est célébré ou enregistré devant un officier de l’état civil. En France, le mariage civil se fait <strong>à la mairie</strong>, et c’est le seul qui a une valeur légale.</p>

<h2>6. Le mariage religieux</h2>
<p>Beaucoup de couples se marient aussi à l’église, au temple ou selon leur religion. Cette étape est facultative et dépend de la foi de chacun.</p>

<h2>7. La fête</h2>
<p>La réception réunit les deux familles, les amis et souvent toute une communauté : discours, danses, repas, musique. Pour beaucoup, c’est le jour où tout le monde célèbre ensemble l’union des deux familles.</p>

<h2>Et dans la diaspora ?</h2>
<p>En France et en Europe, les familles adaptent souvent le calendrier : la dot peut avoir lieu quelques semaines avant la mairie, le même week-end, ou au pays. Certaines familles regroupent plusieurs étapes en une seule journée. L’important est que les deux familles soient d’accord sur le déroulé.</p>`,
    faq: [
      { q: 'Dans quel ordre se font la dot, la mairie et l’église ?', a: 'Le plus souvent : la dot d’abord, puis le mariage civil, puis le mariage religieux. Mais l’ordre varie selon les familles et les contraintes de calendrier.' },
      { q: 'Peut-on faire la dot en France ?', a: 'Oui. De nombreuses familles congolaises organisent la cérémonie de la dot en France, à domicile ou dans une salle, avec un nzonzi pour chaque famille.' },
      { q: 'Combien de temps entre la présentation et la dot ?', a: 'Il n’y a pas de règle. Cela peut aller de quelques semaines à plus d’un an, selon le temps nécessaire pour préparer la dot et réunir les familles.' },
    ],
    related: ['la-dot-c-est-quoi', 'c-est-quoi-un-nzonzi', 'qui-peut-faire-le-kinzonzi'],
  },
  {
    slug: 'qui-peut-faire-le-kinzonzi',
    title: 'Qui peut faire le kinzonzi ?',
    seoTitle: 'Qui peut faire le kinzonzi ? Choisir son nzonzi pour la dot',
    description: 'Un oncle, un aîné, un ami de la famille ou un nzonzi expérimenté ? Qui peut porter la parole pendant la dot, et comment bien choisir votre nzonzi.',
    kicker: 'Conseils',
    lead: 'Porter la parole d’une famille pendant la dot est une grande responsabilité. Traditionnellement confiée à un aîné, elle peut aujourd’hui revenir à différentes personnes.',
    published: '2026-11-26',
    minutes: 5,
    art: 'people',
    takeaways: [
      'Traditionnellement, c’est un aîné respecté, souvent un oncle.',
      'Aujourd’hui, un proche ou un nzonzi extérieur expérimenté peut tenir ce rôle.',
      'Le plus important : la confiance de la famille et la connaissance des coutumes.',
    ],
    body: `
<h2>Traditionnellement, un aîné de la famille</h2>
<p>Le rôle de <a href="/blog/c-est-quoi-un-nzonzi">nzonzi</a> revenait traditionnellement à un <strong>aîné respecté</strong> : un oncle, un grand frère ou un notable de la famille. Chez les Bakongo, où la famille s’organise souvent par la lignée de la mère, l’<strong>oncle maternel</strong> a fréquemment une place importante dans les affaires de mariage.</p>
<p>Ce qui comptait : la sagesse, la connaissance de l’histoire de la famille, et la capacité à parler en public avec autorité et retenue.</p>

<h2>Aujourd’hui, plusieurs possibilités</h2>
<ul>
  <li><strong>Un proche de la famille</strong> : oncle, tante, cousin, grand frère.</li>
  <li><strong>Un ami de confiance</strong> qui connaît bien la famille et ses coutumes.</li>
  <li><strong>Un nzonzi extérieur expérimenté</strong>, quand personne dans la famille n’est disponible ou à l’aise avec ce rôle, ou quand la famille préfère une personne neutre.</li>
</ul>
<p>Le choix appartient à chaque famille. Il n’y a pas une seule bonne réponse.</p>

<h2>Et les femmes ?</h2>
<p>Dans beaucoup de familles, la parole publique pendant la dot a longtemps été tenue par des hommes. Mais les femmes y ont toujours eu un rôle important : les mamans, les tantes et les grandes sœurs conseillent, préparent et prennent aussi la parole à certains moments. Aujourd’hui, des familles confient le rôle de porte-parole à une femme. Là encore, c’est la coutume de chaque famille qui décide.</p>

<h2>Les qualités à rechercher</h2>
<ul>
  <li><strong>La confiance de la famille</strong> : il parle en son nom, il doit connaître ses attentes et ses limites.</li>
  <li><strong>La connaissance des coutumes</strong> de la famille et de sa région d’origine.</li>
  <li><strong>La langue</strong> : lingala, kikongo, tshiluba, swahili, français… selon les familles présentes.</li>
  <li><strong>Le sens du <a href="/blog/c-est-quoi-le-kinzonzi">kinzonzi</a></strong> : écouter, répondre avec à-propos, utiliser les proverbes.</li>
  <li><strong>Le calme et le respect</strong>, même face à un nzonzi coriace.</li>
  <li><strong>La discrétion</strong> sur tout ce qui se dit pendant la cérémonie.</li>
</ul>

<h2>Les questions à poser avant de choisir</h2>
<ul>
  <li>Quelles langues parlez-vous ? Connaissez-vous nos coutumes ?</li>
  <li>Avez-vous déjà mené des dots ? Pour quelles familles ?</li>
  <li>Pouvez-vous rencontrer la famille avant la cérémonie pour la préparer ?</li>
  <li>Vous déplacez-vous ? À quelles conditions ?</li>
  <li>Quelle est votre rémunération, et qu’est-ce qu’elle comprend ?</li>
</ul>

<h2>Trouver un nzonzi près de chez vous</h2>
<p>Sur Mon Nzonzi, chaque profil est vérifié par notre équipe avant d’être publié. Vous pouvez filtrer par région, par langue et par communauté, lire la présentation de chaque nzonzi et le contacter directement depuis sa fiche.</p>`,
    faq: [
      { q: 'Une femme peut-elle être nzonzi ?', a: 'Cela dépend des familles. Le rôle a longtemps été tenu surtout par des hommes, mais des familles confient aujourd’hui la parole à une femme, et les femmes ont toujours eu un rôle important dans la dot.' },
      { q: 'Peut-on faire appel à un nzonzi qui ne fait pas partie de la famille ?', a: 'Oui. C’est de plus en plus courant, surtout dans la diaspora, quand aucun aîné n’est disponible ou quand la famille préfère une personne neutre et expérimentée.' },
      { q: 'Le futur marié peut-il parler lui-même pendant la dot ?', a: 'En général, non : ce sont les nzonzi qui mènent l’échange. Les futurs mariés interviennent à des moments précis, quand la coutume le prévoit.' },
    ],
    related: ['c-est-quoi-un-nzonzi', 'c-est-quoi-le-kinzonzi', 'etapes-du-mariage-en-rdc'],
  },
];
