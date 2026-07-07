import { system, world, EntityComponentTypes, EquipmentSlot, ItemStack } from '@minecraft/server';
import { tc as Ot, ItemUtils as y } from '../ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';
import { FaucetTableRecipes } from '../recipes/recipes.js';
import { CASTING_TABLE_PROGRESS } from './cast_table_state.js';

const defaultMessages = {
    empty: ["To begin, insert a Cast. Available types: Sand, Red Sand, or Gold.", "The casting process can be initiated with Stone Parts. Give it a try!", "Time to create something! Place a Cast or try using Stone Tools."],
    sand: ["Stone Parts are needed to complete the Sand Cast.", "To continue, insert Stone Parts or a Seared Brick into the Sand Cast.", "The sand is ready to be shaped. What will you add: Stone Parts or a Seared Brick?"],
};
const messageStates = {
    "0,0,0": { messages: defaultMessages.empty },
    "0,0,1": { messages: defaultMessages.sand },
    "0,0,2": { messages: defaultMessages.sand },
};
const defaultAutoUpdateTimer = 100;
const autoUpdateStatesSequence = {};
const autoUpdateStates = {
    "0,1,15": { newState: [0, 10, 8], timer: 100 },
    "0,2,0": { newState: [0, 10, 9], timer: 100 },
    "0,2,1": { newState: [0, 10, 10], timer: 100 },
    "0,2,2": { newState: [0, 10, 11], timer: 100 },
    "0,2,3": { newState: [0, 10, 12], timer: 100 },
    "0,2,4": { newState: [0, 10, 13], timer: 100 },
    "0,2,5": { newState: [0, 10, 14], timer: 100 },
    "0,2,6": { newState: [0, 10, 15], timer: 100 },
    "0,2,7": { newState: [0, 11, 0], timer: 100 },
    "0,2,8": { newState: [0, 11, 1], timer: 100 },
    "0,2,9": { newState: [0, 11, 2], timer: 100 },
    "0,2,10": { newState: [0, 11, 3], timer: 100 },
    "0,2,11": { newState: [0, 11, 4], timer: 100 },
    "0,2,12": { newState: [0, 11, 5], timer: 100 },
    "0,2,13": { newState: [0, 11, 6], timer: 100 },
    "0,2,14": { newState: [0, 11, 7], timer: 100 },
    "0,2,15": { newState: [0, 11, 8], timer: 100 },
    "0,3,0": { newState: [0, 11, 9], timer: 100 },
    "0,3,1": { newState: [0, 11, 10], timer: 100 },
    "0,3,2": { newState: [0, 11, 11], timer: 100 },
    "0,3,3": { newState: [0, 11, 12], timer: 100 },
    "0,3,4": { newState: [0, 11, 13], timer: 100 },
    "0,3,5": { newState: [0, 11, 14], timer: 100 },
    "0,3,6": { newState: [0, 11, 15], timer: 100 },
    "0,3,7": { newState: [0, 12, 0], timer: 100 },
    "0,3,8": { newState: [0, 12, 1], timer: 100 },
    "0,3,9": { newState: [0, 12, 2], timer: 100 },
    "0,3,10": { newState: [0, 12, 3], timer: 100 },
    "0,3,11": { newState: [0, 12, 4], timer: 100 },
    "0,3,12": { newState: [0, 12, 5], timer: 100 },
    "0,3,13": { newState: [0, 12, 6], timer: 100 },
    "0,3,14": { newState: [0, 12, 7], timer: 100 },
    "0,3,15": { newState: [0, 12, 8], timer: 100 },
    "0,4,0": { newState: [0, 12, 9], timer: 100 },
    "0,4,1": { newState: [0, 12, 10], timer: 100 },
    "0,4,2": { newState: [0, 12, 11], timer: 100 },
    "0,4,3": { newState: [0, 12, 12], timer: 100 },
    "0,4,4": { newState: [0, 12, 13], timer: 100 },
    "0,4,5": { newState: [0, 12, 14], timer: 100 },
    "0,4,6": { newState: [0, 12, 15], timer: 100 },
    "0,4,7": { newState: [0, 13, 0], timer: 100 },
    "0,4,8": { newState: [0, 13, 1], timer: 100 },
    "0,4,9": { newState: [0, 13, 2], timer: 100 },
    "0,4,10": { newState: [0, 13, 3], timer: 100 },
    "0,4,11": { newState: [0, 13, 4], timer: 100 },
    "0,4,12": { newState: [0, 13, 5], timer: 100 },
    "0,4,13": { newState: [0, 13, 6], timer: 100 },
    "0,4,14": { newState: [0, 13, 7], timer: 100 },
    "0,4,15": { newState: [0, 13, 8], timer: 100 },
    "0,5,0": { newState: [0, 13, 9], timer: 100 },
    "0,5,1": { newState: [0, 13, 10], timer: 100 },
    "0,5,2": { newState: [0, 13, 11], timer: 100 },
    "0,5,3": { newState: [0, 13, 12], timer: 100 },
    "0,5,4": { newState: [0, 13, 13], timer: 100 },
    "0,5,5": { newState: [0, 13, 14], timer: 100 },
    "0,5,6": { newState: [0, 13, 15], timer: 100 },
    "0,5,7": { newState: [0, 14, 0], timer: 100 },
    "0,5,8": { newState: [0, 14, 1], timer: 100 },
    "0,5,9": { newState: [0, 14, 2], timer: 100 },
    "0,5,10": { newState: [0, 14, 3], timer: 100 },
    "0,5,11": { newState: [0, 14, 4], timer: 100 },
    "0,5,12": { newState: [0, 14, 5], timer: 100 },
    "0,5,13": { newState: [0, 14, 6], timer: 100 },
    "0,5,14": { newState: [0, 14, 7], timer: 100 },
    "0,5,15": { newState: [0, 14, 8], timer: 100 },
    "0,6,0": { newState: [0, 14, 9], timer: 100 },
    "0,6,1": { newState: [0, 14, 10], timer: 100 },
    "0,6,2": { newState: [0, 14, 11], timer: 100 },
    "0,6,3": { newState: [0, 14, 12], timer: 100 },
    "0,6,4": { newState: [0, 14, 13], timer: 100 },
    "0,6,5": { newState: [0, 14, 14], timer: 100 },
    "0,6,6": { newState: [0, 14, 15], timer: 100 },
    "0,6,7": { newState: [0, 15, 0], timer: 100 },
    "0,6,8": { newState: [0, 15, 1], timer: 100 },
    "0,6,9": { newState: [0, 15, 2], timer: 100 },
    "0,6,10": { newState: [0, 15, 3], timer: 100 },
    "0,6,11": { newState: [0, 15, 4], timer: 100 },
    "0,6,12": { newState: [0, 15, 5], timer: 100 },
    "0,6,13": { newState: [0, 15, 6], timer: 100 },
    "0,6,14": { newState: [0, 15, 7], timer: 100 },
    "0,6,15": { newState: [0, 15, 8], timer: 100 },
    "0,7,0": { newState: [0, 15, 9], timer: 100 },
    "0,7,1": { newState: [0, 15, 10], timer: 100 },
    "0,7,2": { newState: [0, 15, 11], timer: 100 },
    "0,7,3": { newState: [0, 15, 12], timer: 100 },
    "0,7,4": { newState: [0, 15, 13], timer: 100 },
    "0,7,5": { newState: [0, 15, 14], timer: 100 },
    "0,7,6": { newState: [0, 15, 15], timer: 100 },
    "0,7,7": { newState: [1, 0, 0], timer: 100 },
    "0,7,8": { newState: [1, 0, 1], timer: 100 },
    "0,7,9": { newState: [1, 0, 2], timer: 100 },
    "0,7,10": { newState: [1, 0, 3], timer: 100 },
    "0,7,11": { newState: [1, 0, 4], timer: 100 },
    "0,7,12": { newState: [1, 0, 5], timer: 100 },
    "0,7,13": { newState: [1, 0, 6], timer: 100 },
    "0,7,14": { newState: [1, 0, 7], timer: 100 },
    "0,7,15": { newState: [1, 0, 8], timer: 100 },
    "0,8,0": { newState: [1, 0, 9], timer: 100 },
    "0,8,1": { newState: [1, 0, 10], timer: 100 },
    "0,8,2": { newState: [1, 0, 11], timer: 100 },
    "0,8,3": { newState: [1, 0, 12], timer: 100 },
    "0,8,4": { newState: [1, 0, 13], timer: 100 },
    "0,8,5": { newState: [1, 0, 14], timer: 100 },
    "0,8,6": { newState: [1, 0, 15], timer: 100 },
    "0,8,7": { newState: [1, 1, 0], timer: 100 },
    "0,8,8": { newState: [1, 1, 1], timer: 100 },
    "0,8,9": { newState: [1, 1, 2], timer: 100 },
    "0,8,10": { newState: [1, 1, 3], timer: 100 },
    "0,8,11": { newState: [1, 1, 4], timer: 100 },
    "0,8,12": { newState: [1, 1, 5], timer: 100 },
    "0,8,13": { newState: [1, 1, 6], timer: 100 },
    "0,8,14": { newState: [1, 1, 7], timer: 100 },
    "0,8,15": { newState: [1, 1, 8], timer: 100 },
    "0,9,0": { newState: [1, 1, 9], timer: 100 },
    "0,9,1": { newState: [1, 1, 10], timer: 100 },
    "0,9,2": { newState: [1, 1, 11], timer: 100 },
    "0,9,3": { newState: [1, 1, 12], timer: 100 },
    "0,9,4": { newState: [1, 1, 13], timer: 100 },
    "0,9,5": { newState: [1, 1, 14], timer: 100 },
    "0,9,6": { newState: [1, 1, 15], timer: 100 },
    "0,9,7": { newState: [1, 2, 0], timer: 100 },
    "0,9,8": { newState: [1, 2, 1], timer: 100 },
    "0,9,9": { newState: [1, 2, 2], timer: 100 },
    "0,9,10": { newState: [1, 2, 3], timer: 100 },
    "0,9,11": { newState: [1, 2, 4], timer: 100 },
    "0,9,12": { newState: [1, 2, 5], timer: 100 },
    "0,9,13": { newState: [1, 2, 6], timer: 100 },
    "0,9,14": { newState: [1, 2, 7], timer: 100 },
    "0,9,15": { newState: [1, 2, 8], timer: 100 },
    "0,10,0": { newState: [1, 2, 9], timer: 100 },
    "0,10,1": { newState: [1, 2, 10], timer: 100 },
    "0,10,2": { newState: [1, 2, 11], timer: 100 },
    "0,10,3": { newState: [1, 2, 12], timer: 100 },
    "0,10,4": { newState: [1, 2, 13], timer: 100 },
    "0,10,5": { newState: [1, 2, 14], timer: 100 },
    "0,10,6": { newState: [1, 2, 15], timer: 100 },
    "0,10,7": { newState: [1, 3, 0], timer: 100 },
    "1,4,13": { newState: [1, 13, 6], timer: 100 },
    "1,4,14": { newState: [1, 13, 7], timer: 100 },
    "1,4,15": { newState: [1, 13, 8], timer: 100 },
    "1,5,0": { newState: [1, 13, 9], timer: 100 },
    "1,5,1": { newState: [1, 13, 10], timer: 100 },
    "1,5,2": { newState: [1, 13, 11], timer: 100 },
    "1,5,3": { newState: [1, 13, 12], timer: 100 },
    "1,5,4": { newState: [1, 13, 13], timer: 100 },
    "1,5,5": { newState: [1, 13, 14], timer: 100 },
    "1,5,6": { newState: [1, 13, 15], timer: 100 },
    "1,5,7": { newState: [1, 14, 0], timer: 100 },
    "1,5,8": { newState: [1, 14, 1], timer: 100 },
    "1,5,9": { newState: [1, 14, 2], timer: 100 },
    "1,5,10": { newState: [1, 14, 3], timer: 100 },
    "1,5,11": { newState: [1, 14, 4], timer: 100 },
    "1,5,12": { newState: [1, 14, 5], timer: 100 },
    "1,5,13": { newState: [1, 14, 6], timer: 100 },
    "1,5,14": { newState: [1, 14, 7], timer: 100 },
    "1,5,15": { newState: [1, 14, 8], timer: 100 },
    "1,6,0": { newState: [1, 14, 9], timer: 100 },
    "1,6,1": { newState: [1, 14, 10], timer: 100 },
    "1,6,2": { newState: [1, 14, 11], timer: 100 },
    "1,6,3": { newState: [1, 14, 12], timer: 100 },
    "1,6,4": { newState: [1, 14, 13], timer: 100 },
    "1,6,5": { newState: [1, 14, 14], timer: 100 },
    "1,6,6": { newState: [1, 14, 15], timer: 100 },
    "1,6,7": { newState: [1, 15, 0], timer: 100 },
    "1,6,8": { newState: [1, 15, 1], timer: 100 },
    "1,6,9": { newState: [1, 15, 2], timer: 100 },
    "1,6,10": { newState: [1, 15, 3], timer: 100 },
    "1,6,11": { newState: [1, 15, 4], timer: 100 },
    "1,6,12": { newState: [1, 15, 5], timer: 100 },
    "1,6,13": { newState: [1, 15, 6], timer: 100 },
    "1,6,14": { newState: [1, 15, 7], timer: 100 },
    "1,6,15": { newState: [1, 15, 8], timer: 100 },
    "1,7,0": { newState: [1, 15, 9], timer: 100 },
    "1,7,1": { newState: [1, 15, 10], timer: 100 },
    "1,7,2": { newState: [1, 15, 11], timer: 100 },
    "1,7,3": { newState: [1, 15, 12], timer: 100 },
    "1,7,4": { newState: [1, 15, 13], timer: 100 },
    "1,7,5": { newState: [1, 15, 14], timer: 100 },
    "1,7,6": { newState: [1, 15, 15], timer: 100 },
    "1,7,7": { newState: [2, 0, 0], timer: 100 },
    "1,7,8": { newState: [2, 0, 1], timer: 100 },
    "1,7,9": { newState: [2, 0, 2], timer: 100 },
    "1,7,10": { newState: [2, 0, 3], timer: 100 },
    "1,7,11": { newState: [2, 0, 4], timer: 100 },
    "1,7,12": { newState: [2, 0, 5], timer: 100 },
    "1,7,13": { newState: [2, 0, 6], timer: 100 },
    "1,7,14": { newState: [2, 0, 7], timer: 100 },
    "1,7,15": { newState: [2, 0, 8], timer: 100 },
    "1,8,0": { newState: [2, 0, 9], timer: 100 },
    "1,8,1": { newState: [2, 0, 10], timer: 100 },
    "1,8,2": { newState: [2, 0, 11], timer: 100 },
    "1,8,3": { newState: [2, 0, 12], timer: 100 },
    "1,8,4": { newState: [2, 0, 13], timer: 100 },
    "1,8,5": { newState: [2, 0, 14], timer: 100 },
    "1,8,6": { newState: [2, 0, 15], timer: 100 },
    "1,8,7": { newState: [2, 1, 0], timer: 100 },
    "1,8,8": { newState: [2, 1, 1], timer: 100 },
    "1,8,9": { newState: [2, 1, 2], timer: 100 },
    "1,8,10": { newState: [2, 1, 3], timer: 100 },
    "1,8,11": { newState: [2, 1, 4], timer: 100 },
    "1,8,12": { newState: [2, 1, 5], timer: 100 },
    "1,8,13": { newState: [2, 1, 6], timer: 100 },
    "1,8,14": { newState: [2, 1, 7], timer: 100 },
    "1,8,15": { newState: [2, 1, 8], timer: 100 },
    "1,9,0": { newState: [2, 1, 9], timer: 100 },
    "1,9,1": { newState: [2, 1, 10], timer: 100 },
    "1,9,2": { newState: [2, 1, 11], timer: 100 },
    "1,9,3": { newState: [2, 1, 12], timer: 100 },
    "1,9,4": { newState: [2, 1, 13], timer: 100 },
    "1,9,5": { newState: [2, 1, 14], timer: 100 },
    "1,9,6": { newState: [2, 1, 15], timer: 100 },
    "1,9,7": { newState: [2, 2, 0], timer: 100 },
    "1,9,8": { newState: [2, 2, 1], timer: 100 },
    "1,9,9": { newState: [2, 2, 2], timer: 100 },
    "1,9,10": { newState: [2, 2, 3], timer: 100 },
    "1,9,11": { newState: [2, 2, 4], timer: 100 },
    "1,9,12": { newState: [2, 2, 5], timer: 100 },
    "1,9,13": { newState: [2, 2, 6], timer: 100 },
    "1,9,14": { newState: [2, 2, 7], timer: 100 },
    "1,9,15": { newState: [2, 2, 8], timer: 100 },
    "1,10,0": { newState: [2, 2, 9], timer: 100 },
    "1,10,1": { newState: [2, 2, 10], timer: 100 },
    "1,10,2": { newState: [2, 2, 11], timer: 100 },
    "1,10,3": { newState: [2, 2, 12], timer: 100 },
    "1,10,4": { newState: [2, 2, 13], timer: 100 },
    "1,10,5": { newState: [2, 2, 14], timer: 100 },
    "1,10,6": { newState: [2, 2, 15], timer: 100 },
    "1,10,7": { newState: [2, 3, 0], timer: 100 },
    "1,10,8": { newState: [2, 3, 1], timer: 100 },
    "1,10,9": { newState: [2, 3, 2], timer: 100 },
    "1,10,10": { newState: [2, 3, 3], timer: 100 },
    "1,10,11": { newState: [2, 3, 4], timer: 100 },
    "1,10,12": { newState: [2, 3, 5], timer: 100 },
    "1,10,13": { newState: [2, 3, 6], timer: 100 },
    "1,10,14": { newState: [2, 3, 7], timer: 100 },
    "1,10,15": { newState: [2, 3, 8], timer: 100 },
    "1,11,0": { newState: [2, 3, 9], timer: 100 },
    "1,11,1": { newState: [2, 3, 10], timer: 100 },
    "1,11,2": { newState: [2, 3, 11], timer: 100 },
    "1,11,3": { newState: [2, 3, 12], timer: 100 },
    "1,11,4": { newState: [2, 3, 13], timer: 100 },
    "1,11,5": { newState: [2, 3, 14], timer: 100 },
    "1,11,6": { newState: [2, 3, 15], timer: 100 },
    "1,11,7": { newState: [2, 4, 0], timer: 100 },
    "1,11,8": { newState: [2, 4, 1], timer: 100 },
    "1,11,9": { newState: [2, 4, 2], timer: 100 },
    "1,11,10": { newState: [2, 4, 3], timer: 100 },
    "1,11,11": { newState: [2, 4, 4], timer: 100 },
    "1,11,12": { newState: [2, 4, 5], timer: 100 },
    "1,11,13": { newState: [2, 4, 6], timer: 100 },
    "1,11,14": { newState: [2, 4, 7], timer: 100 },
    "1,11,15": { newState: [2, 4, 8], timer: 100 },
    "1,12,0": { newState: [2, 4, 9], timer: 100 },
    "1,12,1": { newState: [2, 4, 10], timer: 100 },
    "1,12,2": { newState: [2, 4, 11], timer: 100 },
    "1,12,3": { newState: [2, 4, 12], timer: 100 },
    "1,12,4": { newState: [2, 4, 13], timer: 100 },
    "1,12,5": { newState: [2, 4, 14], timer: 100 },
    "1,12,6": { newState: [2, 4, 15], timer: 100 },
    "1,12,7": { newState: [2, 5, 0], timer: 100 },
    "1,12,8": { newState: [2, 5, 1], timer: 100 },
    "1,12,9": { newState: [2, 5, 2], timer: 100 },
    "1,12,10": { newState: [2, 5, 3], timer: 100 },
    "1,12,11": { newState: [2, 5, 4], timer: 100 },
    "1,12,12": { newState: [2, 5, 5], timer: 100 },
    "1,12,13": { newState: [2, 5, 6], timer: 100 },
    "1,12,14": { newState: [2, 5, 7], timer: 100 },
    "1,12,15": { newState: [2, 5, 8], timer: 100 },
    "1,13,0": { newState: [2, 5, 9], timer: 100 },
    "1,13,1": { newState: [2, 5, 10], timer: 100 },
    "1,13,2": { newState: [2, 5, 11], timer: 100 },
    "1,13,3": { newState: [2, 5, 12], timer: 100 },
    "1,13,4": { newState: [2, 5, 13], timer: 100 },
    "1,13,5": { newState: [2, 5, 14], timer: 100 },
    "2,6,13": { newState: [2, 7, 11], timer: 100 },
    "2,6,14": { newState: [2, 7, 12], timer: 100 },
    "2,6,15": { newState: [2, 7, 13], timer: 100 },
    "2,7,0": { newState: [2, 7, 14], timer: 100 },
    "2,7,1": { newState: [2, 7, 15], timer: 100 },
    "2,7,2": { newState: [2, 8, 0], timer: 100 },
    "2,7,3": { newState: [2, 8, 1], timer: 100 },
    "2,7,4": { newState: [2, 8, 2], timer: 100 },
    "2,7,5": { newState: [2, 8, 3], timer: 100 },
    "2,7,6": { newState: [2, 8, 4], timer: 100 },
    "2,7,7": { newState: [2, 8, 5], timer: 100 },
    "2,7,8": { newState: [2, 8, 6], timer: 100 },
    "2,7,9": { newState: [2, 8, 7], timer: 100 },
    "2,7,10": { newState: [2, 8, 8], timer: 100 },
    "2,8,9": { newState: [3, 1, 2], timer: 100 },
    "2,8,10": { newState: [3, 1, 3], timer: 100 },
    "2,8,11": { newState: [3, 1, 4], timer: 100 },
    "2,8,12": { newState: [3, 1, 5], timer: 100 },
    "2,8,13": { newState: [3, 1, 6], timer: 100 },
    "2,8,14": { newState: [3, 1, 7], timer: 100 },
    "2,8,15": { newState: [3, 1, 8], timer: 100 },
    "2,9,0": { newState: [3, 1, 9], timer: 100 },
    "2,9,1": { newState: [3, 1, 10], timer: 100 },
    "2,9,2": { newState: [3, 1, 11], timer: 100 },
    "2,9,3": { newState: [3, 1, 12], timer: 100 },
    "2,9,4": { newState: [3, 1, 13], timer: 100 },
    "2,9,5": { newState: [3, 1, 14], timer: 100 },
    "2,9,6": { newState: [3, 1, 15], timer: 100 },
    "2,9,7": { newState: [3, 2, 0], timer: 100 },
    "2,9,8": { newState: [3, 2, 1], timer: 100 },
    "2,9,9": { newState: [3, 2, 2], timer: 100 },
    "2,9,10": { newState: [3, 2, 3], timer: 100 },
    "2,9,11": { newState: [3, 2, 4], timer: 100 },
    "2,9,12": { newState: [3, 2, 5], timer: 100 },
    "2,9,13": { newState: [3, 2, 6], timer: 100 },
    "2,9,14": { newState: [3, 2, 7], timer: 100 },
    "2,9,15": { newState: [3, 2, 8], timer: 100 },
    "2,10,0": { newState: [3, 2, 9], timer: 100 },
    "2,10,1": { newState: [3, 2, 10], timer: 100 },
    "2,10,2": { newState: [3, 2, 11], timer: 100 },
    "2,10,3": { newState: [3, 2, 12], timer: 100 },
    "2,10,4": { newState: [3, 2, 13], timer: 100 },
    "2,10,5": { newState: [3, 2, 14], timer: 100 },
    "2,10,6": { newState: [3, 2, 15], timer: 100 },
    "2,10,7": { newState: [3, 3, 0], timer: 100 },
    "2,10,8": { newState: [3, 3, 1], timer: 100 },
    "2,10,9": { newState: [3, 3, 2], timer: 100 },
    "2,10,10": { newState: [3, 3, 3], timer: 100 },
    "2,10,11": { newState: [3, 3, 4], timer: 100 },
    "2,10,12": { newState: [3, 3, 5], timer: 100 },
    "2,10,13": { newState: [3, 3, 6], timer: 100 },
    "2,10,14": { newState: [3, 3, 7], timer: 100 },
    "2,10,15": { newState: [3, 3, 8], timer: 100 },
    "2,11,0": { newState: [3, 3, 9], timer: 100 },
    "2,11,1": { newState: [3, 3, 10], timer: 100 },
    "2,11,2": { newState: [3, 3, 11], timer: 100 },
    "2,11,3": { newState: [3, 3, 12], timer: 100 },
    "2,11,4": { newState: [3, 3, 13], timer: 100 },
    "2,11,5": { newState: [3, 3, 14], timer: 100 },
    "2,11,6": { newState: [3, 3, 15], timer: 100 },
    "2,11,7": { newState: [3, 4, 0], timer: 100 },
    "2,11,8": { newState: [3, 4, 1], timer: 100 },
    "2,11,9": { newState: [3, 4, 2], timer: 100 },
    "2,11,10": { newState: [3, 4, 3], timer: 100 },
    "2,11,11": { newState: [3, 4, 4], timer: 100 },
    "2,11,12": { newState: [3, 4, 5], timer: 100 },
    "2,11,13": { newState: [3, 4, 6], timer: 100 },
    "2,11,14": { newState: [3, 4, 7], timer: 100 },
    "2,11,15": { newState: [3, 4, 8], timer: 100 },
    "2,12,0": { newState: [3, 4, 9], timer: 100 },
    "2,12,1": { newState: [3, 4, 10], timer: 100 },
    "2,12,2": { newState: [3, 4, 11], timer: 100 },
    "2,12,3": { newState: [3, 4, 12], timer: 100 },
    "2,12,4": { newState: [3, 4, 13], timer: 100 },
    "2,12,5": { newState: [3, 4, 14], timer: 100 },
    "2,12,6": { newState: [3, 4, 15], timer: 100 },
    "2,12,7": { newState: [3, 5, 0], timer: 100 },
    "2,12,8": { newState: [3, 5, 1], timer: 100 },
    "2,12,9": { newState: [3, 5, 2], timer: 100 },
    "2,12,10": { newState: [3, 5, 3], timer: 100 },
    "2,12,11": { newState: [3, 5, 4], timer: 100 },
    "2,12,12": { newState: [3, 5, 5], timer: 100 },
    "2,12,13": { newState: [3, 5, 6], timer: 100 },
    "2,12,14": { newState: [3, 5, 7], timer: 100 },
    "2,12,15": { newState: [3, 5, 8], timer: 100 },
    "2,13,0": { newState: [3, 5, 9], timer: 100 },
    "2,13,1": { newState: [3, 5, 10], timer: 100 },
    "2,13,2": { newState: [3, 5, 11], timer: 100 },
    "2,13,3": { newState: [3, 5, 12], timer: 100 },
    "2,13,4": { newState: [3, 5, 13], timer: 100 },
    "2,13,5": { newState: [3, 5, 14], timer: 100 },
    "2,13,6": { newState: [3, 5, 15], timer: 100 },
    "2,13,7": { newState: [3, 6, 0], timer: 100 },
    "2,13,8": { newState: [3, 6, 1], timer: 100 },
    "2,13,9": { newState: [3, 6, 2], timer: 100 },
    "2,13,10": { newState: [3, 6, 3], timer: 100 },
    "2,13,11": { newState: [3, 6, 4], timer: 100 },
    "2,13,12": { newState: [3, 6, 5], timer: 100 },
    "2,13,13": { newState: [3, 6, 6], timer: 100 },
    "2,13,14": { newState: [3, 6, 7], timer: 100 },
    "2,13,15": { newState: [3, 6, 8], timer: 100 },
    "2,14,0": { newState: [3, 6, 9], timer: 100 },
    "2,14,1": { newState: [3, 6, 10], timer: 100 },
    "2,14,2": { newState: [3, 6, 11], timer: 100 },
    "2,14,3": { newState: [3, 6, 12], timer: 100 },
    "2,14,4": { newState: [3, 6, 13], timer: 100 },
    "2,14,5": { newState: [3, 6, 14], timer: 100 },
    "2,14,6": { newState: [3, 6, 15], timer: 100 },
    "2,14,7": { newState: [3, 7, 0], timer: 100 },
    "2,14,8": { newState: [3, 7, 1], timer: 100 },
    "2,14,9": { newState: [3, 7, 2], timer: 100 },
    "2,14,10": { newState: [3, 7, 3], timer: 100 },
    "2,14,11": { newState: [3, 7, 4], timer: 100 },
    "2,14,12": { newState: [3, 7, 5], timer: 100 },
    "2,14,13": { newState: [3, 7, 6], timer: 100 },
    "2,14,14": { newState: [3, 7, 7], timer: 100 },
    "2,14,15": { newState: [3, 7, 8], timer: 100 },
    "2,15,0": { newState: [3, 7, 9], timer: 100 },
    "2,15,1": { newState: [3, 7, 10], timer: 100 },
    "2,15,2": { newState: [3, 7, 11], timer: 100 },
    "2,15,3": { newState: [3, 7, 12], timer: 100 },
    "2,15,4": { newState: [3, 7, 13], timer: 100 },
    "2,15,5": { newState: [3, 7, 14], timer: 100 },
    "2,15,6": { newState: [3, 7, 15], timer: 100 },
    "2,15,7": { newState: [3, 8, 0], timer: 100 },
    "2,15,8": { newState: [3, 8, 1], timer: 100 },
    "2,15,9": { newState: [3, 8, 2], timer: 100 },
    "2,15,10": { newState: [3, 8, 3], timer: 100 },
    "2,15,11": { newState: [3, 8, 4], timer: 100 },
    "2,15,12": { newState: [3, 8, 5], timer: 100 },
    "2,15,13": { newState: [3, 8, 6], timer: 100 },
    "2,15,14": { newState: [3, 8, 7], timer: 100 },
    "2,15,15": { newState: [3, 8, 8], timer: 100 },
    "3,0,0": { newState: [3, 8, 9], timer: 100 },
    "3,0,1": { newState: [3, 8, 10], timer: 100 },
    "3,0,2": { newState: [3, 8, 11], timer: 100 },
    "3,0,3": { newState: [3, 8, 12], timer: 100 },
    "3,0,4": { newState: [3, 8, 13], timer: 100 },
    "3,0,5": { newState: [3, 8, 14], timer: 100 },
    "3,0,6": { newState: [3, 8, 15], timer: 100 },
    "3,0,7": { newState: [3, 9, 0], timer: 100 },
    "3,0,8": { newState: [3, 9, 1], timer: 100 },
    "3,0,9": { newState: [3, 9, 2], timer: 100 },
    "3,0,10": { newState: [3, 9, 3], timer: 100 },
    "3,0,11": { newState: [3, 9, 4], timer: 100 },
    "3,0,12": { newState: [3, 9, 5], timer: 100 },
    "3,0,13": { newState: [3, 9, 6], timer: 100 },
    "3,0,14": { newState: [3, 9, 7], timer: 100 },
    "3,0,15": { newState: [3, 9, 8], timer: 100 },
    "3,1,0": { newState: [3, 9, 9], timer: 100 },
    "3,1,1": { newState: [3, 9, 10], timer: 100 },
    "3,9,13": { newState: [3, 10, 9], timer: 100 },
    "3,9,14": { newState: [3, 10, 10], timer: 100 },
    "3,9,15": { newState: [3, 10, 11], timer: 100 },
    "3,10,0": { newState: [3, 10, 12], timer: 100 },
    "3,10,1": { newState: [3, 10, 13], timer: 100 },
    "3,10,2": { newState: [3, 10, 14], timer: 100 },
    "3,10,3": { newState: [3, 10, 15], timer: 100 },
    "3,10,4": { newState: [3, 11, 0], timer: 100 },
    "3,10,5": { newState: [3, 11, 1], timer: 100 },
    "3,10,6": { newState: [3, 11, 2], timer: 100 },
    "3,10,7": { newState: [3, 11, 3], timer: 100 },
    "3,10,8": { newState: [3, 11, 4], timer: 100 },
    "3,11,7": { newState: [3, 12, 3], timer: 100 },
    "3,11,8": { newState: [3, 12, 4], timer: 100 },
    "3,11,9": { newState: [3, 12, 5], timer: 100 },
    "3,11,10": { newState: [3, 12, 6], timer: 100 },
    "3,11,11": { newState: [3, 12, 7], timer: 100 },
    "3,11,12": { newState: [3, 12, 8], timer: 100 },
    "3,11,13": { newState: [3, 12, 9], timer: 100 },
    "3,11,14": { newState: [3, 12, 10], timer: 100 },
    "3,11,15": { newState: [3, 12, 11], timer: 100 },
    "3,12,0": { newState: [3, 12, 12], timer: 100 },
    "3,12,1": { newState: [3, 12, 13], timer: 100 },
    "3,12,2": { newState: [3, 12, 14], timer: 100 },
    "3,13,2": { newState: [3, 13, 14], timer: 100 },
    "3,13,3": { newState: [3, 13, 15], timer: 100 },
    "3,13,4": { newState: [3, 14, 0], timer: 100 },
    "3,13,5": { newState: [3, 14, 1], timer: 100 },
    "3,13,6": { newState: [3, 14, 2], timer: 100 },
    "3,13,7": { newState: [3, 14, 3], timer: 100 },
    "3,13,8": { newState: [3, 14, 4], timer: 100 },
    "3,13,9": { newState: [3, 14, 5], timer: 100 },
    "3,13,10": { newState: [3, 14, 6], timer: 100 },
    "3,13,11": { newState: [3, 14, 7], timer: 100 },
    "3,13,12": { newState: [3, 14, 8], timer: 100 },
    "3,13,13": { newState: [3, 14, 9], timer: 100 },
    "3,13,0": { newState: [3, 13, 1], timer: 100 },
    "3,14,10": { newState: [3, 14, 11], timer: 100 },
    "3,14,12": { newState: [3, 14, 13], timer: 100 },
    "3,14,14": { newState: [3, 14, 15], timer: 100 },
    "3,15,0": { newState: [3, 15, 11], timer: 100 },
    "3,15,1": { newState: [3, 15, 12], timer: 100 },
    "3,15,2": { newState: [3, 15, 13], timer: 100 },
    "3,15,3": { newState: [3, 15, 14], timer: 100 },
    "3,15,4": { newState: [3, 15, 15], timer: 100 },
    "3,15,5": { newState: [4, 0, 0], timer: 100 },
    "3,15,6": { newState: [4, 0, 1], timer: 100 },
    "3,15,7": { newState: [4, 0, 2], timer: 100 },
    "3,15,8": { newState: [4, 0, 3], timer: 100 },
    "3,15,9": { newState: [4, 0, 3], timer: 100 },
    "3,15,10": { newState: [4, 0, 5], timer: 100 },
    "4,0,6": { newState: [4, 1, 1], timer: 100 },
    "4,0,7": { newState: [4, 1, 2], timer: 100 },
    "4,0,8": { newState: [4, 1, 3], timer: 100 },
    "4,0,9": { newState: [4, 1, 4], timer: 100 },
    "4,0,10": { newState: [4, 1, 5], timer: 100 },
    "4,0,11": { newState: [4, 1, 6], timer: 100 },
    "4,0,12": { newState: [4, 1, 7], timer: 100 },
    "4,0,13": { newState: [4, 1, 8], timer: 100 },
    "4,0,14": { newState: [4, 1, 9], timer: 100 },
    "4,0,15": { newState: [4, 1, 10], timer: 100 },
    "4,1,0": { newState: [4, 1, 11], timer: 100 },
    "4,1,12": { newState: [4, 2, 7], timer: 100 },
    "4,1,13": { newState: [4, 2, 8], timer: 100 },
    "4,1,14": { newState: [4, 2, 9], timer: 100 },
    "4,1,15": { newState: [4, 2, 10], timer: 100 },
    "4,2,0": { newState: [4, 2, 11], timer: 100 },
    "4,2,1": { newState: [4, 2, 12], timer: 100 },
    "4,2,2": { newState: [4, 2, 13], timer: 100 },
    "4,2,3": { newState: [4, 2, 14], timer: 100 },
    "4,2,4": { newState: [4, 2, 15], timer: 100 },
    "4,2,5": { newState: [4, 3, 0], timer: 100 },
    "4,2,6": { newState: [4, 3, 1], timer: 100 },
    "4,3,2": { newState: [4, 3, 3], timer: 100 },
};
let stateProgression = [];
const values = [{
        condition: [3, 14, 11],
        returnItem: "ftb_tc:cheese_ingot",
        sound: "random.pop",
    },
    {
        condition: [3, 14, 13],
        returnItem: "ftb_tc:cheese_ingot",
        sound: "random.pop",
    },
    {
        condition: [3, 14, 15],
        returnItems: [{ itemId: "ftb_tc:cheese_ingot", amount: 2 }],
        newState: [2, 8, 5],
        sound: "random.pop",
    },
    {
        condition: [0, 1, 11],
        item: "ftb_tc:copper_can_milk",
        newState: [3, 14, 10],
        returnItem: "ftb_tc:copper_can_empty",
        sound: "bucket.empty_milk",
    },
    {
        condition: [1, 4, 9],
        item: "ftb_tc:copper_can_milk",
        newState: [3, 14, 12],
        returnItem: "ftb_tc:copper_can_empty",
        sound: "bucket.empty_milk",
    },
    {
        condition: [2, 8, 5],
        item: "ftb_tc:copper_can_milk",
        newState: [3, 14, 14],
        returnItem: "ftb_tc:copper_can_empty",
        sound: "bucket.empty_milk",
    }];
values.forEach(value => {
    {
        stateProgression.push(value);
    }
});
for (const recipe of FaucetTableRecipes.RECIPES) {
    stateProgression.push({
        condition: recipe.wantedState,
        item: Ot("copper_can_" + recipe.fluid.id),
        newState: recipe.outputState,
        sound: "bucket.empty_lava",
        returnItem: "ftb_tc:copper_can_empty",
    });
}
for (let castingtableprogress of CASTING_TABLE_PROGRESS) {
    stateProgression.push(castingtableprogress);
}
// ============================
//         TRACKERS
// ============================
const autoUpdateTrackers = new Map();
const sequenceTrackers = new Map();
function getBlockLocationKey(block) {
    return `${block.location.x},${block.location.y},${block.location.z}`;
}
function triggerEffects(block, dimension, config) {
    if (config.sound) {
        dimension.playSound(config.sound, { x: block.location.x + 0.5, y: block.location.y + 1, z: block.location.z + 0.5 });
    }
    if (config.particle) {
        dimension.spawnParticle(config.particle, { x: block.location.x + 0.5, y: block.location.y + 1, z: block.location.z + 0.5 });
    }
    if (config.message) {
        for (const player of dimension.getPlayers({ location: block.location, maxDistance: 8 })) {
            player.sendMessage(config.message);
        }
    }
}
function giveItemToPlayer(player, itemId, amount = 1) {
    const item = new ItemStack(itemId, amount);
    const inventoryComponent = player.getComponent(EntityComponentTypes.Inventory);
    if (inventoryComponent)
        inventoryComponent.container?.addItem(item);
}
function getBlockStateKey(permutation) {
    return [
        permutation.getState("ftb_tc:state_1"),
        permutation.getState("ftb_tc:state_2"),
        permutation.getState("ftb_tc:state_3"),
    ].join(",");
}
function setBlockState(block, newState) {
    let updatedPermutation = block.permutation;
    ["ftb_tc:state_1", "ftb_tc:state_2", "ftb_tc:state_3"].forEach((state, index) => {
        updatedPermutation = updatedPermutation.withState(state, newState[index]);
    });
    block.setPermutation(updatedPermutation);
}
// ============================
//     TRACKER CLEANUP
// ============================
system.runInterval(() => {
    const dimension = world.getDimension("overworld");
    autoUpdateTrackers.forEach((_, key) => {
        const [x, y, z] = key.split(",").map(Number);
        const block = dimension.getBlock({ x, y, z });
        if (!block || block.typeId === "minecraft:air")
            autoUpdateTrackers.delete(key);
    });
    sequenceTrackers.forEach((_, key) => {
        const [x, y, z] = key.split(",").map(Number);
        const block = dimension.getBlock({ x, y, z });
        if (!block || block.typeId === "minecraft:air")
            sequenceTrackers.delete(key);
    });
}, 200);
// ============================
//   CASTING BASIN COMPONENT
// ============================
class CastingTableComponent {
    constructor() {
        this.onPlayerInteract = (event) => {
            if (!event.player || !event.block)
                return;
            const block = event.block;
            const permutation = block.permutation;
            const equipment = event.player.getComponent(EntityComponentTypes.Equippable);
            if (!equipment)
                return;
            const mainHand = equipment.getEquipment(EquipmentSlot.Mainhand);
            const itemType = mainHand?.typeId ?? null;
            const currentState = getBlockStateKey(permutation);
            getBlockLocationKey(block);
            for (const step of stateProgression) {
                if (step.condition.join(",") === currentState && (step.item === itemType || !step.item)) {
                    setBlockState(block, step.newState ?? [0, 0, 0]);
                    event.dimension.playSound(step.sound ?? "use.stone", { x: block.location.x + 0.5, y: block.location.y + 1, z: block.location.z + 0.5 });
                    if (step.returnItem)
                        giveItemToPlayer(event.player, step.returnItem, 1);
                    if (step.item && step.item !== "TIMER")
                        equipment.setEquipment(EquipmentSlot.Mainhand, y.shrinkItemStack((mainHand)));
                    if (step.returnItems) {
                        for (const ret of step.returnItems) {
                            giveItemToPlayer(event.player, ret.itemId, ret.amount ?? 1);
                        }
                    }
                    return;
                }
            }
            const msgState = messageStates[currentState];
            if (msgState) {
                const msg = Array.isArray(msgState.messages)
                    ? msgState.messages[Math.floor(Math.random() * msgState.messages.length)]
                    : msgState.messages;
                event.player.sendMessage(msg);
            }
            event.dimension.playSound("vr.stutterturn", { x: block.location.x + 0.5, y: block.location.y + 1, z: block.location.z + 0.5 });
        };
        this.onTick = (event) => {
            const block = event.block;
            const permutation = block.permutation;
            const stateKey = [
                permutation.getState("ftb_tc:state_1"),
                permutation.getState("ftb_tc:state_2"),
                permutation.getState("ftb_tc:state_3"),
            ].join(",");
            const blockKey = getBlockLocationKey(block);
            // === Auto Update ===
            if (stateKey in autoUpdateStates) {
                const data = autoUpdateStates[stateKey];
                const timer = data.timer ?? defaultAutoUpdateTimer;
                const nextTick = autoUpdateTrackers.get(blockKey);
                if (nextTick === undefined) {
                    // First time seeing this block → initialize and wait for timer
                    autoUpdateTrackers.set(blockKey, system.currentTick + timer);
                    return;
                }
                if (system.currentTick < nextTick)
                    return;
                // Time to update state
                setBlockState(block, data.newState ?? [0, 0, 0]);
                triggerEffects(block, event.dimension, data);
                autoUpdateTrackers.set(blockKey, system.currentTick + timer);
                return;
            }
            // === Sequence update ===
            const runningSeq = sequenceTrackers.get(blockKey);
            if (runningSeq) {
                const sequenceData = autoUpdateStatesSequence[runningSeq.sequenceId];
                if (!sequenceData) {
                    sequenceTrackers.delete(blockKey);
                    return;
                }
                if (system.currentTick < runningSeq.nextTick)
                    return;
                const step = sequenceData.sequence[runningSeq.index];
                if (!step)
                    return;
                setBlockState(block, step.state ?? [0, 0, 0]);
                triggerEffects(block, event.dimension, step);
                runningSeq.index++;
                if (runningSeq.index >= sequenceData.sequence.length) {
                    if (sequenceData.loop) {
                        runningSeq.index = 0;
                    }
                    else {
                        sequenceTrackers.delete(blockKey);
                        return;
                    }
                }
                const nextStep = sequenceData.sequence[runningSeq.index];
                runningSeq.nextTick = system.currentTick + (nextStep?.timer ?? defaultAutoUpdateTimer);
                sequenceTrackers.set(blockKey, runningSeq);
                return;
            }
            // === Start new sequence if defined ===
            if (stateKey in autoUpdateStatesSequence) {
                const sequenceData = autoUpdateStatesSequence[stateKey];
                sequenceTrackers.set(blockKey, {
                    sequenceId: stateKey,
                    index: 0,
                    nextTick: system.currentTick + (sequenceData.initialTimer ?? defaultAutoUpdateTimer),
                });
            }
        };
    }
}

export { CastingTableComponent };
