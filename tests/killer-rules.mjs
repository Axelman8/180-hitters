import assert from 'node:assert/strict';
import {newSonnyMatch,applySonnyTurn,sonnyAutoCommit} from '../dist/sonny-games.js';
import {chooseBotTarget} from '../dist/bot.js';
const d=(number,mult=1)=>({number,mult});
let s=newSonnyMatch(['A','B','C'],'killer',2);
for(const number of [3,1,2])s=applySonnyTurn(s,{hits:[d(number)]});
assert.equal(s.active,2);assert.equal(s.killerStage,'playing');
// A triple activates Killer. The two remaining darts can attack immediately.
s=applySonnyTurn(s,{hits:[d(3,3),d(1,2),d(1)]});
assert.ok(s.players[2].killerActivated);assert.ok(s.players[0].killerEliminated);assert.equal(s.active,1);
s=applySonnyTurn(s,{hits:[d(0),d(0),d(0)]});assert.equal(s.active,2);
assert.ok(sonnyAutoCommit(s,[d(2,3)]));
const won=applySonnyTurn(s,{hits:[d(2,3),d(3),d(0)]});
assert.equal(won.phase,'won');assert.equal(won.winner,2);assert.equal(won.history.at(-1).darts,1);assert.equal(won.history.at(-1).input.hits.length,1);
assert.equal(chooseBotTarget(s).number,2);assert.equal(chooseBotTarget(s).mult,3);
// Loading an existing six-letter match does not change its original rules.
let old=newSonnyMatch(['A','B'],'killer');delete old.killerRules;
old=applySonnyTurn(old,{hits:[d(5)]});old=applySonnyTurn(old,{hits:[d(6)]});
old=applySonnyTurn(old,{hits:[d(5,3),d(5,2),d(5)]});
assert.equal(old.players[0].killerLetters,3);assert.equal(old.players[0].killerActivated,false);
console.log('PASS: three-hit Killer activation, doubles/triples, three lives, eliminated-player skip, immediate win, BOT attack and saved six-letter compatibility');
