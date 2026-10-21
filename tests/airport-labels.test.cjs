'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),J=require('../journey-model');
test('airport city labels use familiar airport names and explicit display corrections without rewriting endpoints',()=>{
 const stn={iata:'STN',name:'Stansted Airport',city:'Essex',lat:51.885,lon:.235,id:'original'},gha={iata:'GHA',name:'Noumerat',city:'El Atteuf',lat:32.384,lon:3.794},before=structuredClone([stn,gha]);
 assert.equal(J.airportCity(stn),'London Stansted');assert.equal(J.airportCity(gha),'Ghardaïa');assert.deepEqual([stn,gha],before);
 const edited={...stn,displayName:'London Stansted Airport',displayCity:'Stansted'};assert.match(J.airportDetails(edited),/London Stansted Airport, Stansted/);assert.equal(edited.id,stn.id);assert.equal(edited.lat,stn.lat);assert.equal(J.airportLabel(edited),'STN');
});
