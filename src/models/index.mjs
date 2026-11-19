import { Crystal } from './crystal.mjs';
import { Bigram } from './bigram.mjs';
import { Organisms } from './organisms.mjs';
export const MODELS = { crystal: Crystal };
Object.assign(MODELS, { [Bigram.id]: Bigram, [Organisms.id]: Organisms });
import { Climate } from './climate.mjs';
MODELS[Climate.id] = Climate;
