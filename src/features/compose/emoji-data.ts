// Emojis unicode courants, par catégorie. Chaque entrée : « caractère nom(s) » ; les noms français et anglais servent à la recherche.
export interface EmojiEntry {
  char: string;
  name: string;
  categoryId: string;
}

export interface EmojiCategory {
  id: string;
  title: string;
  icon: string;
  entries: EmojiEntry[];
}

const SMILEYS = [
  "😀 sourire grin", "😃 grand-sourire", "😄 rire-yeux", "😁 dents", "😆 rire-fort", "😅 sueur", "🤣 mort-de-rire",
  "😂 larmes-de-joie", "🙂 leger-sourire", "🙃 renverse", "😉 clin-doeil", "😊 content", "😇 ange", "🥰 amoureux",
  "😍 yeux-coeur", "🤩 etoiles", "😘 bisou", "😋 miam", "😛 tire-langue", "😜 clin-langue", "🤪 fou", "😎 cool lunettes",
  "🤓 geek", "🧐 monocle", "🤔 pensif thinking", "🤨 sourcil", "😐 neutre", "😑 blase", "😶 muet", "😏 narquois",
  "😒 mecontent", "🙄 yeux-au-ciel", "😬 grimace", "🤥 menteur", "😌 soulage", "😔 triste", "😪 sommeil", "🤤 bave",
  "😴 dodo sleep", "😷 masque", "🤒 malade", "🤕 blesse", "🤢 nause", "🤮 vomi", "🥵 chaud", "🥶 froid", "🥴 ivre",
  "😵 etourdi", "🤯 esprit-explose", "🥳 fete", "😤 vapeur", "😡 rage", "🤬 jurons", "😱 choc", "😨 effraye",
  "😰 sueur-froide", "😭 pleurs", "😢 pleure", "🤗 calin hug", "🤭 oups", "🤫 chut", "💀 cranne skull", "👻 fantome",
  "👽 alien", "🤖 robot", "💩 caca", "😈 diable", "🙈 singe-yeux", "🙉 singe-oreilles", "🙊 singe-bouche",
];

const PEOPLE = [
  "👋 salut main", "🤚 main-levee", "✋ stop", "👌 ok", "✌️ victoire", "🤞 doigts-croises", "🤟 je-taime",
  "🤘 rock", "🤙 appelle-moi", "👈 gauche", "👉 droite", "👆 haut", "👇 bas", "👍 pouce thumbs-up", "👎 pouce-bas thumbs-down",
  "✊ poing", "👊 poing-frappe", "👏 bravo applaudir", "🙌 hourra", "🤝 poignee-de-main", "🙏 merci priere",
  "💪 muscle", "🧠 cerveau", "👀 yeux", "👂 oreille", "👃 nez", "👄 bouche", "👶 bebe", "🧑 personne",
  "🙋 question", "🤦 facepalm", "🤷 bof shrug", "🙆 ok-geste", "🙅 non-geste", "💅 vernis", "🫶 coeur-mains",
];

const NATURE = [
  "🐶 chien", "🐱 chat", "🐭 souris", "🐹 hamster", "🐰 lapin", "🦊 renard", "🐻 ours", "🐼 panda", "🐨 koala",
  "🐯 tigre", "🦁 lion", "🐮 vache", "🐷 cochon", "🐸 grenouille", "🐵 singe", "🐔 poulet", "🐧 pingouin", "🐦 oiseau",
  "🦆 canard", "🦉 hibou", "🐺 loup", "🐴 cheval", "🦄 licorne", "🐝 abeille", "🐛 chenille", "🦋 papillon", "🐢 tortue",
  "🐍 serpent", "🐙 pieuvre", "🐬 dauphin", "🐳 baleine", "🌸 fleur", "🌲 sapin", "🌳 arbre", "🍀 trefle", "🌵 cactus",
  "🌊 vague", "🌙 lune", "⭐ etoile", "☀️ soleil", "🌈 arc-en-ciel", "❄️ flocon",
];

const FOOD = [
  "🍎 pomme", "🍐 poire", "🍊 orange", "🍋 citron", "🍌 banane", "🍉 pasteque", "🍇 raisin", "🍓 fraise", "🍒 cerise",
  "🍑 peche", "🥭 mangue", "🍍 ananas", "🥥 coco", "🥝 kiwi", "🍅 tomate", "🥑 avocat", "🍕 pizza", "🍔 burger",
  "🍟 frites", "🌭 hot-dog", "🌮 taco", "🌯 wrap", "🥗 salade", "🍝 pates", "🍜 nouilles", "🍣 sushi", "🍩 donut",
  "🍪 cookie biscuit", "🎂 gateau", "🍰 part-de-gateau", "🍫 chocolat", "🍿 popcorn", "☕ cafe", "🍺 biere", "🍷 vin",
  "🥂 champagne toast", "🍹 cocktail", "🥐 croissant",
];

const ACTIVITY = [
  "⚽ foot", "🏀 basket", "🏈 football-americain", "⚾ baseball", "🎾 tennis", "🏐 volley", "🎱 billard", "🏓 ping-pong",
  "🎯 cible fleche", "🎳 bowling", "🎮 manette jeu", "🕹️ joystick", "🎲 de", "🧩 puzzle", "🎭 theatre", "🎨 peinture art",
  "🎬 clap film", "🎤 micro karaoke", "🎧 casque musique", "🎵 note", "🎶 notes", "🎸 guitare", "🎹 piano", "🥁 tambour",
  "🏆 trophee", "🥇 medaille-or", "🥈 medaille-argent", "🥉 medaille-bronze", "🏁 arrivee damier", "🎉 fete confettis",
  "🎁 cadeau",
];

const TRAVEL = [
  "🚗 voiture", "🚕 taxi", "🚌 bus", "🏎️ voiture-de-course", "🚓 police", "🚑 ambulance", "🚒 pompiers", "🚲 velo",
  "🛴 trottinette", "🚀 fusee", "🛸 ovni", "✈️ avion", "🚁 helicoptere", "⛵ voilier", "🚢 bateau", "🏠 maison",
  "🏢 immeuble", "🗼 tour", "🗺️ carte", "⛰️ montagne", "🏝️ ile", "⚓ ancre", "🌍 terre", "🧭 boussole",
];

const OBJECTS = [
  "💡 ampoule idee", "🔦 lampe", "📌 punaise", "📎 trombone", "🔒 cadenas", "🔑 cle", "🔧 cle-a-molette", "🔨 marteau",
  "⚙️ engrenage", "🧲 aimant", "💊 pilule", "📱 telephone", "💻 ordinateur", "⌨️ clavier", "🖥️ ecran", "💾 disquette",
  "📷 appareil-photo", "📹 camera", "📺 television", "📻 radio", "⏰ reveil", "⌛ sablier", "📅 calendrier", "📚 livres",
  "📝 note", "✏️ crayon", "🖊️ stylo", "💰 argent", "💎 diamant", "🛒 panier", "🎈 ballon", "🔔 cloche", "📦 colis",
];

const SYMBOLS = [
  "❤️ coeur-rouge", "🧡 coeur-orange", "💛 coeur-jaune", "💚 coeur-vert", "💙 coeur-bleu", "💜 coeur-violet",
  "🖤 coeur-noir", "💔 coeur-brise", "💯 cent", "🔥 feu", "✨ etincelles", "💥 boom", "💫 etoile-filante", "💬 bulle",
  "💤 zzz", "✅ valide", "❌ non croix", "❓ question", "❗ exclamation", "⚠️ attention", "⛔ interdit", "🚫 interdit",
  "➡️ fleche", "⬅️ fleche-gauche", "🔁 repeter", "♻️ recycler", "✔️ coche", "➕ plus", "➖ moins", "🆗 ok",
  "🆕 nouveau", "🔴 rond-rouge", "🟢 rond-vert", "🔵 rond-bleu",
];

const FLAGS = [
  "🚩 drapeau-rouge", "🏳️ drapeau-blanc", "🏴 drapeau-noir", "🇫🇷 france", "🇧🇪 belgique", "🇨🇭 suisse", "🇨🇦 canada",
  "🇩🇪 allemagne", "🇪🇸 espagne", "🇮🇹 italie", "🇬🇧 royaume-uni", "🇺🇸 etats-unis", "🇯🇵 japon", "🇧🇷 bresil",
];

const ICON_RECENT = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2";
const ICON_SMILEYS = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01";
const ICON_PEOPLE = "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0";
const ICON_NATURE = "M5 19c0-8 6-14 14-14 0 8-6 14-14 14zM5 19l7-7";
const ICON_FOOD = "M5 8h11v5a5 5 0 0 1-10 0zM16 9h2a2 2 0 0 1 0 4h-2";
const ICON_ACTIVITY = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3a14 14 0 0 1 0 18";
const ICON_TRAVEL = "M5 16h14v-4l-2-5H7l-2 5zM7 16v2M17 16v2";
const ICON_OBJECTS = "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5V16h8v-2.5A6 6 0 0 0 12 3z";
const ICON_SYMBOLS = "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z";
const ICON_FLAGS = "M5 21V4h11l-2 4 2 4H5";

function parse(categoryId: string, lines: string[]): EmojiEntry[] {
  return lines.map((line) => {
    const cut = line.indexOf(" ");
    return { char: line.slice(0, cut), name: line.slice(cut + 1), categoryId };
  });
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  { id: "smileys", title: "Smileys", icon: ICON_SMILEYS, entries: parse("smileys", SMILEYS) },
  { id: "personnes", title: "Personnes", icon: ICON_PEOPLE, entries: parse("personnes", PEOPLE) },
  { id: "nature", title: "Nature", icon: ICON_NATURE, entries: parse("nature", NATURE) },
  { id: "nourriture", title: "Nourriture", icon: ICON_FOOD, entries: parse("nourriture", FOOD) },
  { id: "activites", title: "Activités", icon: ICON_ACTIVITY, entries: parse("activites", ACTIVITY) },
  { id: "voyages", title: "Voyages", icon: ICON_TRAVEL, entries: parse("voyages", TRAVEL) },
  { id: "objets", title: "Objets", icon: ICON_OBJECTS, entries: parse("objets", OBJECTS) },
  { id: "symboles", title: "Symboles", icon: ICON_SYMBOLS, entries: parse("symboles", SYMBOLS) },
  { id: "drapeaux", title: "Drapeaux", icon: ICON_FLAGS, entries: parse("drapeaux", FLAGS) },
];

export const RECENT_ICON = ICON_RECENT;

export const ALL_EMOJIS: EmojiEntry[] = EMOJI_CATEGORIES.flatMap((c) => c.entries);
