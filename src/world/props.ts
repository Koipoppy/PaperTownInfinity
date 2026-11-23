// Prop catalogue. Cards are cut-paper planes; houses/windmill/bridge are small 3D paper models.
export type CardType =
  | 'tree_oak'
  | 'tree_pine'
  | 'bush'
  | 'flowers'
  | 'grass'
  | 'rock'
  | 'mushroom'
  | 'reeds'
  | 'lily'
  | 'fence'
  | 'signpost'
  | 'haystack'
  | 'cart'
  | 'beehive'
  | 'lantern'
  | 'cat'
  | 'dog'
  | 'sheep'
  | 'duck';

export type PropType = CardType | 'house_small' | 'house_tall' | 'windmill' | 'bridge';

export const CARD_TYPES: CardType[] = [
  'tree_oak',
  'tree_pine',
  'bush',
  'flowers',
  'grass',
  'rock',
  'mushroom',
  'reeds',
  'lily',
  'fence',
  'signpost',
  'haystack',
  'cart',
  'beehive',
  'lantern',
  'cat',
  'dog',
  'sheep',
  'duck',
];

export interface PropDef {
  /** world width / height of the cut-out */
  w: number;
  h: number;
  card: boolean;
  /** collision radius when risen; 0 = walk-through */
  radius: number;
  /** printed footprint size on the page */
  print?: number;
}

export const PROP_DEFS: Record<PropType, PropDef> = {
  tree_oak: { w: 1.1, h: 1.45, card: true, radius: 0.22 },
  tree_pine: { w: 0.95, h: 1.65, card: true, radius: 0.2 },
  bush: { w: 0.75, h: 0.5, card: true, radius: 0.18 },
  flowers: { w: 0.55, h: 0.4, card: true, radius: 0 },
  grass: { w: 0.38, h: 0.34, card: true, radius: 0 },
  rock: { w: 0.62, h: 0.4, card: true, radius: 0.18 },
  mushroom: { w: 0.3, h: 0.32, card: true, radius: 0 },
  reeds: { w: 0.5, h: 0.72, card: true, radius: 0 },
  lily: { w: 0.45, h: 0.3, card: true, radius: 0 },
  fence: { w: 0.95, h: 0.46, card: true, radius: 0.1 },
  signpost: { w: 0.55, h: 0.9, card: true, radius: 0.08 },
  haystack: { w: 0.65, h: 0.5, card: true, radius: 0.2 },
  cart: { w: 0.7, h: 0.45, card: true, radius: 0.18 },
  beehive: { w: 0.45, h: 0.5, card: true, radius: 0.1 },
  lantern: { w: 0.4, h: 0.9, card: true, radius: 0.06 },
  cat: { w: 0.34, h: 0.34, card: true, radius: 0.06 },
  dog: { w: 0.4, h: 0.34, card: true, radius: 0.08 },
  sheep: { w: 0.44, h: 0.36, card: true, radius: 0.08 },
  duck: { w: 0.3, h: 0.26, card: true, radius: 0 },
  house_small: { w: 1.05, h: 0.88, card: true, radius: 0.42 },
  house_tall: { w: 0.9, h: 1.12, card: true, radius: 0.38 },
  windmill: { w: 0.95, h: 1.3, card: true, radius: 0.3 },
  bridge: { w: 1.9, h: 0.5, card: false, radius: 0 },
};
